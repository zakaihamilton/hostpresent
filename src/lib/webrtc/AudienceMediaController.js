import {
  assignedIncomingEdge,
  MAX_GUEST_PUBLISHERS,
  MEDIA_CONTROL,
  MEDIA_HEALTH_INTERVAL_MS,
  MEDIA_PROTOCOL_VERSION,
  MEDIA_REPAIR_DELAY_MS,
  validMediaPlan,
} from "./audienceProtocol";
import { applyEdgeQuality } from "./audienceQuality";
import { buildRelayTrees } from "./relayTopology";

const capability = () => ({
  foreground:
    typeof document === "undefined" || document.visibilityState === "visible",
  desktop:
    typeof navigator === "undefined" ||
    !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  forwarding: true,
});
const connected = (call) =>
  call?.peerConnection?.connectionState === "connected" ||
  ["connected", "completed"].includes(call?.peerConnection?.iceConnectionState);

// All control travels on authenticated, direct host data channels. Media calls
// contain routing identifiers only; they confer no authority on their sender.
export class AudienceMediaController {
  constructor({
    isHost,
    localId,
    hostId,
    getPeer,
    getLocalStream,
    sendControl,
    onStream,
    onState,
    rejectPeer = () => {},
    now = Date.now,
    createId = () => crypto.randomUUID(),
  }) {
    Object.assign(this, {
      isHost,
      localId,
      hostId,
      getPeer,
      getLocalStream,
      sendControl,
      onStream,
      onState,
      rejectPeer,
      now,
      createId,
    });
    this.members = new Map();
    this.guests = new Set();
    this.requests = new Set();
    this.edges = [];
    this.blocked = new Set();
    this.failures = new Map();
    this.streams = new Map();
    this.incoming = new Map();
    this.pending = new Map();
    this.outgoing = new Map();
    this.retired = new Map();
    this.retiredEpochs = new Set();
    this.epoch = isHost ? createId() : "";
    this.revision = 0;
    this.plan = null;
    this.focusedId = hostId;
    this.hostConnected = isHost;
    this.requested = false;
    this.disposed = false;
    this.queue = Promise.resolve();
    this.timer = setInterval(() => this.tick(), MEDIA_HEALTH_INTERVAL_MS);
    this.publishState();
  }
  publishState() {
    const state = {
      canPublish:
        this.hostConnected &&
        (this.isHost || Boolean(this.plan?.publishers.includes(this.localId))),
      publishRequested: this.requested,
      publishingRequests: [...this.requests],
      publisherIds: this.plan?.publishers ?? [],
      mediaEpoch: this.epoch,
      mediaProtocol: MEDIA_PROTOCOL_VERSION,
      mediaEdges: this.edges.length,
      mediaOutgoing: this.outgoing.size,
      mediaIncoming: this.incoming.size,
      fallbackEdges: this.isHost
        ? this.edges.filter((edge) => edge.fallback).length
        : (this.plan?.edges ?? []).filter(
            (edge) => edge.childId === this.localId && edge.fallback,
          ).length,
      recovering:
        [...this.pending.values()].some((record) => !record.ready) ||
        (this.plan?.edges ?? []).some(
          (edge) =>
            edge.childId === this.localId &&
            this.incoming.get(edge.sourceId)?.edge.id !== edge.id,
        ),
      mediaProtocolError: this.protocolError || "",
    };
    const signature = JSON.stringify(state);
    if (signature !== this.stateSignature) {
      this.stateSignature = signature;
      this.onState(state);
    }
  }
  failureExpired(edgeId) {
    if (!this.failures.has(edgeId)) {
      this.failures.set(edgeId, this.now());
    }
    return this.now() - this.failures.get(edgeId) >= MEDIA_REPAIR_DELAY_MS;
  }
  restartEpoch() {
    if (!this.isHost || this.disposed) return;
    this.guests.clear();
    this.requests.clear();
    this.failures.clear();
    this.blocked.clear();
    this.clearMedia();
    this.edges = [];
    this.epoch = this.createId();
    this.revision = 0;
    this.rebuild();
  }
  connectionOpen(id) {
    if (this.disposed) return;
    if (this.isHost)
      this.members.set(id, { id, joined: this.now(), negotiated: false });
    else {
      this.hostConnected = true;
      this.controlOpenedAt = this.now();
      this.sendControl(this.hostId, {
        type: MEDIA_CONTROL.HELLO,
        participantId: this.localId,
        version: MEDIA_PROTOCOL_VERSION,
        ...capability(),
      });
    }
    this.publishState();
  }
  connectionClose(id) {
    if (this.disposed) return;
    if (this.isHost) {
      this.members.delete(id);
      this.guests.delete(id);
      this.requests.delete(id);
      this.rebuild();
    } else {
      this.hostConnected = false;
      this.requested = false;
      this.clearMedia();
      this.plan = null;
      this.publishState();
    }
  }
  handleControl(senderId, message) {
    if (this.disposed) return;
    if (this.isHost) {
      const member = this.members.get(senderId);
      if (!member || message.participantId !== senderId) return;
      if (message.type === MEDIA_CONTROL.HELLO) {
        if (message.version !== MEDIA_PROTOCOL_VERSION) {
          this.rejectIncompatible(senderId);
          return;
        }
        Object.assign(member, {
          negotiated: true,
          ...this.readCapability(message),
          lastHealth: this.now(),
        });
        this.rebuild();
      } else if (
        member.negotiated &&
        message.type === MEDIA_CONTROL.REQUEST &&
        typeof message.request === "boolean"
      ) {
        if (message.request && !this.guests.has(senderId))
          this.requests.add(senderId);
        else {
          this.requests.delete(senderId);
          this.guests.delete(senderId);
        }
        this.rebuild();
      } else if (member.negotiated && message.type === MEDIA_CONTROL.HEALTH) {
        const before = JSON.stringify(this.readCapability(member));
        Object.assign(member, this.readCapability(message), {
          lastHealth: this.now(),
        });
        let needsRepair =
          before !== JSON.stringify(this.readCapability(member));
        if (Array.isArray(message.edges) && message.edges.length <= 4) {
          for (const edge of this.edges.filter(
            (item) => item.childId === senderId,
          )) {
            const report = message.edges.find(
              (item) => item?.id === edge.id && typeof item.ready === "boolean",
            );
            if (report?.ready) this.failures.delete(edge.id);
            else if (this.failureExpired(edge.id)) {
              this.blocked.add(
                `${edge.sourceId}:${edge.parentId}:${edge.childId}`,
              );
              this.edges = this.edges.filter((item) => item.id !== edge.id);
              needsRepair = true;
            }
          }
        }
        if (needsRepair) this.rebuild();
      }
    } else if (senderId === this.hostId && this.hostConnected) {
      if (message.type === MEDIA_CONTROL.RELOAD) {
        this.protocolError =
          "Media protocol changed. Reload this page to join.";
        this.connectionClose(senderId);
      } else if (
        message.type === MEDIA_CONTROL.PLAN &&
        validMediaPlan(message, this.localId, this.hostId)
      ) {
        if (
          this.retiredEpochs.has(message.epoch) ||
          (message.epoch === this.epoch && message.revision <= this.revision)
        )
          return;
        if (this.epoch && message.epoch !== this.epoch) {
          this.retiredEpochs.add(this.epoch);
          this.clearMedia();
          this.requested = false;
        }
        this.epoch = message.epoch;
        this.revision = message.revision;
        this.applyPlan(message);
      }
    }
  }
  readCapability(message) {
    return {
      foreground: message.foreground === true,
      desktop: message.desktop === true,
      forwarding: message.forwarding === true,
    };
  }
  rejectIncompatible(id) {
    this.sendControl(id, {
      type: MEDIA_CONTROL.RELOAD,
      version: MEDIA_PROTOCOL_VERSION,
    });
    this.rejectPeer(id);
  }
  requestPublishing(request = true) {
    if (this.isHost || !this.hostConnected || !this.plan) return false;
    this.requested = request;
    this.sendControl(this.hostId, {
      type: MEDIA_CONTROL.REQUEST,
      participantId: this.localId,
      request,
    });
    if (!request) {
      // Stop sending immediately; do not wait for the host's acknowledgment.
      this.applyPlan({
        ...this.plan,
        publishers: this.plan.publishers.filter((id) => id !== this.localId),
        edges: this.plan.edges.filter((edge) => edge.sourceId !== this.localId),
      });
    }
    this.publishState();
    return true;
  }
  approve(id) {
    if (
      !this.isHost ||
      !this.members.get(id)?.negotiated ||
      !this.requests.has(id) ||
      this.guests.size >= MAX_GUEST_PUBLISHERS
    )
      return false;
    this.guests.add(id);
    this.requests.delete(id);
    this.rebuild();
    return true;
  }
  revoke(id) {
    if (!this.isHost) return false;
    this.guests.delete(id);
    this.requests.delete(id);
    this.rebuild();
    return true;
  }
  focus(id) {
    if (!this.isHost || id === this.focusedId) return;
    this.focusedId = id || this.hostId;
    this.rebuild();
  }
  rebuild() {
    if (!this.isHost || this.disposed) return;
    const members = [...this.members.values()].filter(
      (item) => item.negotiated,
    );
    const publishers = [this.hostId, ...this.guests];
    this.edges = buildRelayTrees({
      hostId: this.hostId,
      members,
      publishers,
      previous: this.edges,
      blocked: this.blocked,
      createId: this.createId,
    });
    this.revision += 1;
    const makePlan = (id) => ({
      type: MEDIA_CONTROL.PLAN,
      version: MEDIA_PROTOCOL_VERSION,
      epoch: this.epoch,
      revision: this.revision,
      publishers,
      focusedId: this.focusedId,
      edges: this.edges.filter(
        (edge) => edge.parentId === id || edge.childId === id,
      ),
    });
    // Receivers get assignments before senders initiate calls. A sender retries
    // rejected early calls until the independent data channels catch up.
    for (const member of members)
      this.sendControl(member.id, makePlan(member.id));
    this.applyPlan(makePlan(this.localId));
  }
  applyPlan(plan) {
    this.plan = plan;
    this.focusedId = plan.focusedId || this.hostId;
    if (plan.publishers.includes(this.localId)) this.requested = false;
    for (const [sourceId, record] of this.incoming) {
      if (
        !plan.publishers.includes(sourceId) ||
        !plan.edges.some(
          (edge) => edge.childId === this.localId && edge.sourceId === sourceId,
        )
      ) {
        this.incoming.delete(sourceId);
        record.call.close();
        this.streams.delete(sourceId);
        this.onStream(sourceId, null);
      }
    }
    for (const sourceId of this.streams.keys()) {
      if (!plan.publishers.includes(sourceId)) {
        this.streams.delete(sourceId);
        this.onStream(sourceId, null);
      }
    }
    for (const [id, record] of this.pending) {
      if (!plan.edges.some((edge) => edge.id === id)) {
        this.pending.delete(id);
        record.call.close();
      }
    }
    for (const [id, record] of this.outgoing) {
      if (
        !plan.edges.some(
          (edge) => edge.id === id && edge.parentId === this.localId,
        )
      ) {
        this.outgoing.delete(id);
        if (plan.publishers.includes(record.edge.sourceId))
          this.retired.set(id, { ...record, expires: this.now() + 10_000 });
        else record.call.close();
      }
    }
    for (const [id, record] of this.retired) {
      if (!plan.publishers.includes(record.edge.sourceId)) {
        this.retired.delete(id);
        record.call.close();
      }
    }
    this.publishState();
    void this.sync();
  }
  handleCall(call) {
    const edge = assignedIncomingEdge(this.plan, call, this.localId);
    if (
      this.disposed ||
      !this.hostConnected ||
      !edge ||
      edge.sourceId === this.localId
    ) {
      call.close();
      return false;
    }
    const oldPending = this.pending.get(edge.id);
    if (oldPending) oldPending.call.close();
    const record = { call, edge, ready: false };
    this.pending.set(edge.id, record);
    call.on("stream", (stream) => {
      if (
        this.disposed ||
        this.pending.get(edge.id) !== record ||
        !this.plan?.edges.some((item) => item.id === edge.id)
      )
        return;
      const previous = this.incoming.get(edge.sourceId);
      record.ready = true;
      this.pending.delete(edge.id);
      this.incoming.set(edge.sourceId, record);
      this.streams.set(edge.sourceId, stream);
      this.onStream(edge.sourceId, stream);
      if (previous && previous !== record) previous.call.close();
      this.publishState();
      void this.sync();
    });
    const closed = () => {
      if (this.pending.get(edge.id) === record) this.pending.delete(edge.id);
      if (this.incoming.get(edge.sourceId) === record) {
        this.incoming.delete(edge.sourceId);
        // Keep the last feed during repair, but never forward ended tracks.
      }
      this.publishState();
    };
    call.on("close", closed);
    call.on("error", closed);
    call.answer(); // Receive only: never capture or send a listener's devices.
    this.publishState();
    return true;
  }
  sync() {
    this.queue = this.queue.catch(() => {}).then(() => this.syncNow());
    return this.queue;
  }
  async syncNow() {
    if (this.disposed || !this.plan || !this.hostConnected) return;
    const epoch = this.epoch;
    const local = this.plan.publishers.includes(this.localId)
      ? await this.getLocalStream()
      : null;
    if (this.disposed || epoch !== this.epoch) return;
    const hostEdges = this.isHost
      ? [
          ...this.edges.filter((edge) => edge.parentId === this.hostId),
          ...[...this.retired.values()]
            .map((record) => record.edge)
            .filter((edge) => edge.parentId === this.hostId),
        ]
      : [];
    for (const edge of this.plan.edges.filter(
      (item) => item.parentId === this.localId,
    )) {
      const stream =
        edge.sourceId === this.localId
          ? local
          : this.streams.get(edge.sourceId);
      if (
        !stream ||
        !stream.getTracks().some((track) => track.readyState === "live")
      )
        continue;
      let record = this.outgoing.get(edge.id);
      const senders = record?.call.peerConnection?.getSenders() ?? [];
      const tracks = stream
        .getTracks()
        .filter((track) => track.readyState === "live");
      if (
        record &&
        tracks.some(
          (track) =>
            !senders.some(
              (sender) =>
                (sender.track?.kind ?? sender._hostPresentKind) === track.kind,
            ),
        )
      ) {
        this.outgoing.delete(edge.id);
        this.retired.set(`${edge.id}:replacement:${this.createId()}`, {
          ...record,
          expires: this.now() + 10_000,
        });
        record = null;
      }
      if (!record) {
        const call = this.getPeer()?.call(edge.childId, stream, {
          metadata: {
            version: MEDIA_PROTOCOL_VERSION,
            epoch: this.epoch,
            edgeId: edge.id,
            sourceId: edge.sourceId,
          },
        });
        if (!call) continue;
        record = { call, edge, started: this.now() };
        this.outgoing.set(edge.id, record);
        const close = () => {
          if (this.outgoing.get(edge.id) === record)
            this.outgoing.delete(edge.id);
          this.publishState();
        };
        call.on("close", close);
        call.on("error", close);
      } else {
        for (const sender of senders) {
          const kind = sender.track?.kind ?? sender._hostPresentKind;
          if (!kind) continue;
          sender._hostPresentKind = kind;
          const track = tracks.find((item) => item.kind === kind) ?? null;
          if (track !== sender.track) {
            try {
              await sender.replaceTrack(track);
            } catch {
              record.call.close();
              this.outgoing.delete(edge.id);
            }
          }
        }
      }
      await applyEdgeQuality(record.call, edge, {
        hostId: this.hostId,
        focusedId: this.focusedId,
        hostEdges,
      });
    }
    for (const record of this.retired.values()) {
      await applyEdgeQuality(record.call, record.edge, {
        hostId: this.hostId,
        focusedId: this.focusedId,
        hostEdges,
      });
    }
    this.publishState();
  }
  tick() {
    if (this.disposed) return;
    if (this.isHost) {
      let changed = false;
      for (const member of this.members.values()) {
        if (
          !member.negotiated &&
          this.now() - member.joined >= MEDIA_REPAIR_DELAY_MS
        )
          this.rejectIncompatible(member.id);
        if (
          member.negotiated &&
          this.now() - member.lastHealth >= MEDIA_REPAIR_DELAY_MS &&
          member.forwarding
        ) {
          member.forwarding = false;
          changed = true;
        }
      }
      // The host is a required monitoring leaf for every guest source. Its
      // failed incoming edges need a new identifier too, even without a guest
      // health report for that leaf.
      for (const edge of this.edges.filter(
        (item) => item.childId === this.hostId,
      )) {
        const record = this.incoming.get(edge.sourceId);
        if (record?.edge.id === edge.id && connected(record.call))
          this.failures.delete(edge.id);
        else if (this.failureExpired(edge.id)) {
          this.edges = this.edges.filter((item) => item.id !== edge.id);
          this.failures.delete(edge.id);
          changed = true;
        }
      }
      if (changed) this.rebuild();
    } else if (
      this.hostConnected &&
      !this.plan &&
      this.now() - this.controlOpenedAt >= MEDIA_REPAIR_DELAY_MS
    ) {
      this.protocolError =
        "This host uses an incompatible media protocol. Reload both host and attendee pages.";
      this.publishState();
    } else if (this.hostConnected && this.plan) {
      this.sendControl(this.hostId, {
        type: MEDIA_CONTROL.HEALTH,
        participantId: this.localId,
        ...capability(),
        edges: this.plan.edges
          .filter((edge) => edge.childId === this.localId)
          .map((edge) => ({
            id: edge.id,
            ready:
              this.incoming.get(edge.sourceId)?.edge.id === edge.id &&
              connected(this.incoming.get(edge.sourceId)?.call),
          })),
      });
    }
    for (const [id, record] of this.retired)
      if (this.now() >= record.expires) {
        this.retired.delete(id);
        record.call.close();
      }
    for (const [id, record] of this.outgoing) {
      if (
        !connected(record.call) &&
        this.now() - record.started >= MEDIA_REPAIR_DELAY_MS
      ) {
        this.outgoing.delete(id);
        record.call.close();
      }
    }
    void this.sync();
  }
  clearMedia() {
    const records = [
      ...this.incoming.values(),
      ...this.pending.values(),
      ...this.outgoing.values(),
      ...this.retired.values(),
    ];
    const sources = [...this.streams.keys()];
    this.incoming.clear();
    this.pending.clear();
    this.outgoing.clear();
    this.retired.clear();
    this.streams.clear();
    for (const record of records) record.call.close();
    for (const id of sources) this.onStream(id, null);
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.clearMedia();
    this.hostConnected = false;
    this.plan = null;
    this.publishState();
  }
}

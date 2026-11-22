import { AudienceCallManager, isCallConnected } from "./AudienceCallManager";
import { AudienceHostCoordinator } from "./AudienceHostCoordinator";
import {
  MEDIA_CONTROL,
  MEDIA_HEALTH_INTERVAL_MS,
  MEDIA_PROTOCOL_VERSION,
  MEDIA_REPAIR_DELAY_MS,
  validMediaPlan,
} from "./audienceProtocol";

export type AudienceMediaState = {
  canPublish: boolean;
  publishRequested: boolean;
  publishingRequests: string[];
  publisherIds: string[];
  mediaEpoch: string;
  mediaProtocol: number;
  mediaEdges: number;
  mediaOutgoing: number;
  mediaIncoming: number;
  fallbackEdges: number;
  recovering: boolean;
  mediaProtocolError: string;
};

const capability = () => ({
  foreground:
    typeof document === "undefined" || document.visibilityState === "visible",
  desktop:
    typeof navigator === "undefined" ||
    !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  forwarding: true,
});

// All control travels on authenticated, direct host data channels. Media calls
// contain routing identifiers only; they confer no authority on their sender.
export class AudienceMediaController {
  declare isHost: boolean;
  declare localId: string;
  declare hostId: string;
  declare getPeer: () => any;
  declare getLocalStream: () => any;
  declare sendControl: (id: string, message: any) => void;
  declare onStream: (...args: any[]) => void;
  declare onState: (state: AudienceMediaState) => void;
  declare rejectPeer: (...args: any[]) => void;
  declare now: () => number;
  declare createId: () => string;
  declare members: Map<string, any>;
  declare guests: Set<string>;
  declare requests: Set<string>;
  declare blocked: Set<string>;
  declare failures: Map<string, number>;
  declare streams: Map<string, any>;
  declare incoming: Map<string, any>;
  declare pending: Map<string, any>;
  declare outgoing: Map<string, any>;
  declare retired: Map<string, any>;
  declare retiredEpochs: Set<string>;
  declare epoch: string;
  declare revision: number;
  declare plan: any;
  declare focusedId: string;
  declare hostConnected: boolean;
  declare requested: boolean;
  declare disposed: boolean;
  declare queue: Promise<any>;
  declare timer: ReturnType<typeof setInterval>;
  declare controlOpenedAt: number;
  declare protocolError: string | undefined;
  declare stateSignature: string | undefined;
  private declare calls: AudienceCallManager;
  private declare host: AudienceHostCoordinator;

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
  }: {
    isHost?: any;
    localId?: any;
    hostId?: any;
    getPeer?: any;
    getLocalStream?: any;
    sendControl?: any;
    onStream?: any;
    onState?: any;
    rejectPeer?: any;
    now?: any;
    createId?: any;
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
    this.retiredEpochs = new Set();
    this.epoch = isHost ? createId() : "";
    this.revision = 0;
    this.plan = null;
    this.focusedId = hostId;
    this.hostConnected = isHost;
    this.requested = false;
    this.disposed = false;
    this.queue = Promise.resolve();

    this.calls = new AudienceCallManager({
      isHost,
      localId,
      hostId,
      getPeer,
      getLocalStream,
      onStream,
      now,
      createId,
      isDisposed: () => this.disposed,
      isHostConnected: () => this.hostConnected,
      getPlan: () => this.plan,
      getEpoch: () => this.epoch,
      getFocusedId: () => this.focusedId,
      getEdges: () => this.edges,
      onPlanApplied: (plan) => {
        this.plan = plan;
        this.focusedId = plan.focusedId || this.hostId;
        if (plan.publishers.includes(this.localId)) this.requested = false;
      },
      publishState: () => this.publishState(),
      sync: () => this.sync(),
    });
    this.host = new AudienceHostCoordinator({
      localId,
      hostId,
      sendControl,
      rejectPeer,
      now,
      createId,
      isDisposed: () => this.disposed,
      getEpoch: () => this.epoch,
      setEpoch: (epoch) => {
        this.epoch = epoch;
      },
      getRevision: () => this.revision,
      setRevision: (revision) => {
        this.revision = revision;
      },
      getFocusedId: () => this.focusedId,
      setFocusedId: (focusedId) => {
        this.focusedId = focusedId;
      },
      getIncoming: () => this.calls.incoming,
      clearMedia: () => this.clearMedia(),
      applyPlan: (plan) => this.applyPlan(plan),
    });

    this.members = this.host.members;
    this.guests = this.host.guests;
    this.requests = this.host.requests;
    this.blocked = this.host.blocked;
    this.failures = this.host.failures;
    this.streams = this.calls.streams;
    this.incoming = this.calls.incoming;
    this.pending = this.calls.pending;
    this.outgoing = this.calls.outgoing;
    this.retired = this.calls.retired;

    this.timer = setInterval(() => this.tick(), MEDIA_HEALTH_INTERVAL_MS);
    this.publishState();
  }

  get edges() {
    return this.host.edges;
  }

  set edges(value: any[]) {
    this.host.edges = value;
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
            (edge: any) => edge.childId === this.localId && edge.fallback,
          ).length,
      recovering:
        [...this.pending.values()].some((record) => !record.ready) ||
        (this.plan?.edges ?? []).some(
          (edge: any) =>
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

  restartEpoch() {
    if (!this.isHost || this.disposed) return;
    this.host.restartEpoch();
  }

  connectionOpen(id: string) {
    if (this.disposed) return;
    if (this.isHost) this.host.registerMember(id);
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

  connectionClose(id: string) {
    if (this.disposed) return;
    if (this.isHost) {
      this.host.removeMember(id);
    } else {
      this.hostConnected = false;
      this.requested = false;
      this.clearMedia();
      this.plan = null;
      this.publishState();
    }
  }

  handleControl(senderId: string, message: any) {
    if (this.disposed) return;
    if (this.isHost) {
      this.host.handleControl(senderId, message);
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
        publishers: this.plan.publishers.filter(
          (id: string) => id !== this.localId,
        ),
        edges: this.plan.edges.filter(
          (edge: any) => edge.sourceId !== this.localId,
        ),
      });
    }
    this.publishState();
    return true;
  }

  approve(id: string) {
    if (!this.isHost) return false;
    return this.host.approve(id);
  }

  revoke(id: string) {
    if (!this.isHost) return false;
    return this.host.revoke(id);
  }

  focus(id: string) {
    if (!this.isHost) return;
    this.host.focus(id);
  }

  rebuild() {
    if (!this.isHost || this.disposed) return;
    this.host.rebuild();
  }

  applyPlan(plan: any) {
    this.calls.applyPlan(plan);
  }

  handleCall(call: any) {
    return this.calls.handleCall(call);
  }

  sync() {
    this.queue = this.queue.catch(() => {}).then(() => this.syncNow());
    return this.queue;
  }

  syncNow() {
    return this.calls.syncNow();
  }

  tick() {
    if (this.disposed) return;
    if (this.isHost) {
      this.host.tickHost();
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
          .filter((edge: any) => edge.childId === this.localId)
          .map((edge: any) => ({
            id: edge.id,
            ready:
              this.incoming.get(edge.sourceId)?.edge.id === edge.id &&
              isCallConnected(this.incoming.get(edge.sourceId)?.call),
          })),
      });
    }
    this.calls.pruneExpiredCalls();
    void this.sync();
  }

  clearMedia() {
    this.calls.clearMedia();
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

import {
  assignedIncomingEdge,
  MEDIA_PROTOCOL_VERSION,
  MEDIA_REPAIR_DELAY_MS,
} from "./audienceProtocol";
import { applyEdgeQuality } from "./audienceQuality";

export const isCallConnected = (call: any): boolean =>
  call?.peerConnection?.connectionState === "connected" ||
  ["connected", "completed"].includes(call?.peerConnection?.iceConnectionState);

export class AudienceCallManager {
  readonly streams = new Map<string, any>();
  readonly incoming = new Map<string, any>();
  readonly pending = new Map<string, any>();
  readonly outgoing = new Map<string, any>();
  readonly retired = new Map<string, any>();

  constructor(
    private readonly context: {
      isHost: boolean;
      localId: string;
      hostId: string;
      getPeer: () => any;
      getLocalStream: () => any;
      onStream: (...args: any[]) => void;
      now: () => number;
      createId: () => string;
      isDisposed: () => boolean;
      isHostConnected: () => boolean;
      getPlan: () => any;
      getEpoch: () => string;
      getFocusedId: () => string;
      getEdges: () => any[];
      onPlanApplied: (plan: any) => void;
      publishState: () => void;
      sync: () => Promise<any>;
    },
  ) {}

  applyPlan(plan: any): void {
    this.context.onPlanApplied(plan);
    for (const [sourceId, record] of this.incoming) {
      if (
        !plan.publishers.includes(sourceId) ||
        !plan.edges.some(
          (edge: any) =>
            edge.childId === this.context.localId && edge.sourceId === sourceId,
        )
      ) {
        this.incoming.delete(sourceId);
        record.call.close();
        this.streams.delete(sourceId);
        this.context.onStream(sourceId, null);
      }
    }
    for (const sourceId of this.streams.keys()) {
      if (!plan.publishers.includes(sourceId)) {
        this.streams.delete(sourceId);
        this.context.onStream(sourceId, null);
      }
    }
    for (const [id, record] of this.pending) {
      if (!plan.edges.some((edge: any) => edge.id === id)) {
        this.pending.delete(id);
        record.call.close();
      }
    }
    for (const [id, record] of this.outgoing) {
      if (
        !plan.edges.some(
          (edge: any) =>
            edge.id === id && edge.parentId === this.context.localId,
        )
      ) {
        this.outgoing.delete(id);
        if (plan.publishers.includes(record.edge.sourceId))
          this.retired.set(id, {
            ...record,
            expires: this.context.now() + 10_000,
          });
        else record.call.close();
      }
    }
    for (const [id, record] of this.retired) {
      if (!plan.publishers.includes(record.edge.sourceId)) {
        this.retired.delete(id);
        record.call.close();
      }
    }
    this.context.publishState();
    void this.context.sync();
  }

  handleCall(call: any): boolean {
    const plan = this.context.getPlan();
    const edge = assignedIncomingEdge(plan, call, this.context.localId);
    if (
      this.context.isDisposed() ||
      !this.context.isHostConnected() ||
      !edge ||
      edge.sourceId === this.context.localId
    ) {
      call.close();
      return false;
    }
    const oldPending = this.pending.get(edge.id);
    if (oldPending) oldPending.call.close();
    const record = { call, edge, ready: false };
    this.pending.set(edge.id, record);
    call.on("stream", (stream: any) => {
      if (
        this.context.isDisposed() ||
        this.pending.get(edge.id) !== record ||
        !this.context.getPlan()?.edges.some((item: any) => item.id === edge.id)
      )
        return;
      const previous = this.incoming.get(edge.sourceId);
      record.ready = true;
      this.pending.delete(edge.id);
      this.incoming.set(edge.sourceId, record);
      this.streams.set(edge.sourceId, stream);
      this.context.onStream(edge.sourceId, stream);
      if (previous && previous !== record) previous.call.close();
      this.context.publishState();
      void this.context.sync();
    });
    const closed = () => {
      if (this.pending.get(edge.id) === record) this.pending.delete(edge.id);
      if (this.incoming.get(edge.sourceId) === record) {
        this.incoming.delete(edge.sourceId);
        // Keep the last feed during repair, but never forward ended tracks.
      }
      this.context.publishState();
    };
    call.on("close", closed);
    call.on("error", closed);
    call.answer(); // Receive only: never capture or send a listener's devices.
    this.context.publishState();
    return true;
  }

  async syncNow(): Promise<void> {
    const plan = this.context.getPlan();
    if (this.context.isDisposed() || !plan || !this.context.isHostConnected())
      return;
    const epoch = this.context.getEpoch();
    const local = plan.publishers.includes(this.context.localId)
      ? await this.context.getLocalStream()
      : null;
    if (this.context.isDisposed() || epoch !== this.context.getEpoch()) return;
    const hostEdges = this.context.isHost
      ? [
          ...this.context
            .getEdges()
            .filter((edge) => edge.parentId === this.context.hostId),
          ...[...this.retired.values()]
            .map((record) => record.edge)
            .filter((edge) => edge.parentId === this.context.hostId),
        ]
      : [];
    for (const edge of plan.edges.filter(
      (item: any) => item.parentId === this.context.localId,
    )) {
      const stream =
        edge.sourceId === this.context.localId
          ? local
          : this.streams.get(edge.sourceId);
      if (
        !stream ||
        !stream.getTracks().some((track: any) => track.readyState === "live")
      )
        continue;
      let record = this.outgoing.get(edge.id);
      const senders = record?.call.peerConnection?.getSenders() ?? [];
      const tracks = stream
        .getTracks()
        .filter((track: any) => track.readyState === "live");
      if (
        record &&
        tracks.some(
          (track: any) =>
            !senders.some(
              (sender: any) =>
                (sender.track?.kind ?? sender._hostPresentKind) === track.kind,
            ),
        )
      ) {
        this.outgoing.delete(edge.id);
        this.retired.set(`${edge.id}:replacement:${this.context.createId()}`, {
          ...record,
          expires: this.context.now() + 10_000,
        });
        record = null;
      }
      if (!record) {
        const call = this.context.getPeer()?.call(edge.childId, stream, {
          metadata: {
            version: MEDIA_PROTOCOL_VERSION,
            epoch: this.context.getEpoch(),
            edgeId: edge.id,
            sourceId: edge.sourceId,
          },
        });
        if (!call) continue;
        record = { call, edge, started: this.context.now() };
        this.outgoing.set(edge.id, record);
        const close = () => {
          if (this.outgoing.get(edge.id) === record)
            this.outgoing.delete(edge.id);
          this.context.publishState();
        };
        call.on("close", close);
        call.on("error", close);
      } else {
        for (const sender of senders) {
          const kind = sender.track?.kind ?? sender._hostPresentKind;
          if (!kind) continue;
          sender._hostPresentKind = kind;
          const track = tracks.find((item: any) => item.kind === kind) ?? null;
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
        hostId: this.context.hostId,
        focusedId: this.context.getFocusedId(),
        hostEdges,
      });
    }
    for (const record of this.retired.values()) {
      await applyEdgeQuality(record.call, record.edge, {
        hostId: this.context.hostId,
        focusedId: this.context.getFocusedId(),
        hostEdges,
      });
    }
    this.context.publishState();
  }

  pruneExpiredCalls(): void {
    const now = this.context.now();
    for (const [id, record] of this.retired) {
      if (now >= record.expires) {
        this.retired.delete(id);
        record.call.close();
      }
    }
    for (const [id, record] of this.outgoing) {
      if (
        !isCallConnected(record.call) &&
        now - record.started >= MEDIA_REPAIR_DELAY_MS
      ) {
        this.outgoing.delete(id);
        record.call.close();
      }
    }
  }

  clearMedia(): void {
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
    for (const id of sources) this.context.onStream(id, null);
  }
}

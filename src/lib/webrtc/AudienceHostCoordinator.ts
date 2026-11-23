import { isCallConnected } from "./AudienceCallManager";
import {
  MAX_GUEST_PUBLISHERS,
  MEDIA_CONTROL,
  MEDIA_PROTOCOL_VERSION,
  MEDIA_REPAIR_DELAY_MS,
} from "./audienceProtocol";
import { buildRelayTrees } from "./relayTopology";

export class AudienceHostCoordinator {
  readonly members = new Map<string, any>();
  readonly guests = new Set<string>();
  readonly requests = new Set<string>();
  readonly blocked = new Set<string>();
  readonly failures = new Map<string, number>();
  edges: any[] = [];

  constructor(
    private readonly context: {
      localId: string;
      hostId: string;
      sendControl: (id: string, message: any) => void;
      rejectPeer: (...args: any[]) => void;
      now: () => number;
      createId: () => string;
      isDisposed: () => boolean;
      getEpoch: () => string;
      setEpoch: (epoch: string) => void;
      getRevision: () => number;
      setRevision: (revision: number) => void;
      getFocusedId: () => string;
      setFocusedId: (focusedId: string) => void;
      getIncoming: () => Map<string, any>;
      clearMedia: () => void;
      applyPlan: (plan: any) => void;
    },
  ) {}

  failureExpired(edgeId: string): boolean {
    if (!this.failures.has(edgeId)) {
      this.failures.set(edgeId, this.context.now());
    }
    return (
      this.context.now() - this.failures.get(edgeId) >= MEDIA_REPAIR_DELAY_MS
    );
  }

  restartEpoch(): void {
    if (this.context.isDisposed()) return;
    this.guests.clear();
    this.requests.clear();
    this.failures.clear();
    this.blocked.clear();
    this.context.clearMedia();
    this.edges = [];
    this.context.setEpoch(this.context.createId());
    this.context.setRevision(0);
    this.rebuild();
  }

  registerMember(id: string): void {
    this.members.set(id, {
      id,
      joined: this.context.now(),
      negotiated: false,
    });
  }

  removeMember(id: string): void {
    this.members.delete(id);
    this.guests.delete(id);
    this.requests.delete(id);
    this.rebuild();
  }

  handleControl(senderId: string, message: any): void {
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
        lastHealth: this.context.now(),
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
        lastHealth: this.context.now(),
      });
      let needsRepair = before !== JSON.stringify(this.readCapability(member));
      if (Array.isArray(message.edges) && message.edges.length <= 4) {
        for (const edge of this.edges.filter(
          (item) => item.childId === senderId,
        )) {
          const report = message.edges.find(
            (item: any) =>
              item?.id === edge.id && typeof item.ready === "boolean",
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
  }

  readCapability(message: any) {
    return {
      foreground: message.foreground === true,
      desktop: message.desktop === true,
      forwarding: message.forwarding === true,
    };
  }

  rejectIncompatible(id: string): void {
    this.context.sendControl(id, {
      type: MEDIA_CONTROL.RELOAD,
      version: MEDIA_PROTOCOL_VERSION,
    });
    this.context.rejectPeer(id);
  }

  approve(id: string): boolean {
    if (
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

  revoke(id: string): boolean {
    this.guests.delete(id);
    this.requests.delete(id);
    this.rebuild();
    return true;
  }

  focus(id: string): void {
    if (id === this.context.getFocusedId()) return;
    this.context.setFocusedId(id || this.context.hostId);
    this.rebuild();
  }

  rebuild(): void {
    if (this.context.isDisposed()) return;
    const members = [...this.members.values()].filter(
      (item) => item.negotiated,
    );
    const publishers = [this.context.hostId, ...this.guests];
    this.edges = buildRelayTrees({
      hostId: this.context.hostId,
      members,
      publishers,
      previous: this.edges,
      blocked: this.blocked,
      createId: this.context.createId,
    });
    const nextRevision = this.context.getRevision() + 1;
    this.context.setRevision(nextRevision);
    const epoch = this.context.getEpoch();
    const focusedId = this.context.getFocusedId();
    const makePlan = (id: string) => ({
      type: MEDIA_CONTROL.PLAN,
      version: MEDIA_PROTOCOL_VERSION,
      epoch,
      revision: nextRevision,
      publishers,
      focusedId,
      edges: this.edges.filter(
        (edge) => edge.parentId === id || edge.childId === id,
      ),
    });
    // Receivers get assignments before senders initiate calls. A sender retries
    // rejected early calls until the independent data channels catch up.
    for (const member of members)
      this.context.sendControl(member.id, makePlan(member.id));
    this.context.applyPlan(makePlan(this.context.localId));
  }

  tickHost(): void {
    let changed = false;
    const now = this.context.now();
    for (const member of this.members.values()) {
      if (!member.negotiated && now - member.joined >= MEDIA_REPAIR_DELAY_MS)
        this.rejectIncompatible(member.id);
      if (
        member.negotiated &&
        now - member.lastHealth >= MEDIA_REPAIR_DELAY_MS &&
        member.forwarding
      ) {
        member.forwarding = false;
        changed = true;
      }
    }
    // The host is a required monitoring leaf for every guest source. Its
    // failed incoming edges need a new identifier too, even without a guest
    // health report for that leaf.
    const incoming = this.context.getIncoming();
    for (const edge of this.edges.filter(
      (item) => item.childId === this.context.hostId,
    )) {
      const record = incoming.get(edge.sourceId);
      if (record?.edge.id === edge.id && isCallConnected(record.call))
        this.failures.delete(edge.id);
      else if (this.failureExpired(edge.id)) {
        this.edges = this.edges.filter((item) => item.id !== edge.id);
        this.failures.delete(edge.id);
        changed = true;
      }
    }
    if (changed) this.rebuild();
  }
}

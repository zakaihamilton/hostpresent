export const MEDIA_PROTOCOL_VERSION = 2;
export const MAX_GUEST_PUBLISHERS = 3;
export const MEDIA_HEALTH_INTERVAL_MS = 2000;
export const MEDIA_REPAIR_DELAY_MS = 5000;
export const MEDIA_CONTROL = Object.freeze({
  HELLO: "media_hello",
  PLAN: "media_plan",
  REQUEST: "publish_request",
  HEALTH: "relay_health",
  RELOAD: "media_reload_required",
} as const);

type MediaControlType = (typeof MEDIA_CONTROL)[keyof typeof MEDIA_CONTROL];

interface MediaPlanEdge {
  id: string;
  parentId: string;
  childId: string;
  sourceId: string;
  fallback: boolean;
  ready?: boolean;
}

interface MediaHealthEdge {
  id: string;
  ready: boolean;
}

export interface MediaControlMessage {
  type: MediaControlType;
  participantId?: string;
  version?: number;
  foreground?: boolean;
  desktop?: boolean;
  forwarding?: boolean;
  epoch?: string;
  revision?: number;
  publishers?: string[];
  focusedId?: string;
  request?: boolean;
  edges?: Array<MediaPlanEdge | MediaHealthEdge>;
  [field: string]: unknown;
}

export interface MediaPlanMessage extends Omit<MediaControlMessage, "type"> {
  type?: typeof MEDIA_CONTROL.PLAN;
  version: number;
  epoch: string;
  revision: number;
  publishers: string[];
  edges: MediaPlanEdge[];
}

const validId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 128;
export function isMediaControl(
  message: unknown,
): message is MediaControlMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  const type = candidate.type;
  if (
    typeof type !== "string" ||
    !Object.values(MEDIA_CONTROL).includes(type as MediaControlType)
  ) {
    return false;
  }
  if (
    (candidate.participantId !== undefined &&
      typeof candidate.participantId !== "string") ||
    (candidate.version !== undefined &&
      typeof candidate.version !== "number") ||
    (candidate.foreground !== undefined &&
      typeof candidate.foreground !== "boolean") ||
    (candidate.desktop !== undefined &&
      typeof candidate.desktop !== "boolean") ||
    (candidate.forwarding !== undefined &&
      typeof candidate.forwarding !== "boolean") ||
    (candidate.epoch !== undefined && typeof candidate.epoch !== "string") ||
    (candidate.revision !== undefined &&
      typeof candidate.revision !== "number") ||
    (candidate.publishers !== undefined &&
      (!Array.isArray(candidate.publishers) ||
        !candidate.publishers.every(
          (publisher) => typeof publisher === "string",
        ))) ||
    (candidate.focusedId !== undefined &&
      typeof candidate.focusedId !== "string") ||
    (candidate.request !== undefined &&
      typeof candidate.request !== "boolean") ||
    (candidate.edges !== undefined &&
      (!Array.isArray(candidate.edges) ||
        !candidate.edges.every((edge) => {
          if (!edge || typeof edge !== "object") return false;
          const edgeData = edge as Record<string, unknown>;
          return (
            typeof edgeData.id === "string" &&
            (edgeData.ready === undefined ||
              typeof edgeData.ready === "boolean") &&
            (edgeData.parentId === undefined ||
              typeof edgeData.parentId === "string") &&
            (edgeData.childId === undefined ||
              typeof edgeData.childId === "string") &&
            (edgeData.sourceId === undefined ||
              typeof edgeData.sourceId === "string") &&
            (edgeData.fallback === undefined ||
              typeof edgeData.fallback === "boolean")
          );
        })))
  ) {
    return false;
  }
  return true;
}
export function validMediaPlan(
  plan: unknown,
  localId: string,
  hostId: string,
): plan is MediaPlanMessage {
  if (!plan || typeof plan !== "object") return false;
  const candidate = plan as Record<string, unknown>;
  if (
    (candidate.type !== undefined && candidate.type !== MEDIA_CONTROL.PLAN) ||
    candidate.version !== MEDIA_PROTOCOL_VERSION ||
    !validId(candidate.epoch) ||
    typeof candidate.revision !== "number" ||
    !Number.isSafeInteger(candidate.revision) ||
    candidate.revision < 1 ||
    !Array.isArray(candidate.publishers) ||
    candidate.publishers.length > 4 ||
    candidate.publishers[0] !== hostId ||
    !candidate.publishers.every(validId) ||
    new Set(candidate.publishers).size !== candidate.publishers.length ||
    !Array.isArray(candidate.edges) ||
    candidate.edges.length > 76
  )
    return false;
  const incoming = new Set();
  const ids = new Set();
  return candidate.edges.every((edge) => {
    if (!edge || typeof edge !== "object") return false;
    const edgeData = edge as Record<string, unknown>;
    if (
      !validId(edgeData.id) ||
      ids.has(edgeData.id) ||
      !validId(edgeData.parentId) ||
      !validId(edgeData.childId) ||
      !(candidate.publishers as unknown[]).includes(edgeData.sourceId) ||
      edgeData.childId === edgeData.sourceId ||
      edgeData.parentId === edgeData.childId ||
      (edgeData.parentId !== localId && edgeData.childId !== localId) ||
      typeof edgeData.fallback !== "boolean"
    )
      return false;
    ids.add(edgeData.id);
    if (edgeData.childId === localId) {
      if (incoming.has(edgeData.sourceId)) return false;
      incoming.add(edgeData.sourceId);
    }
    return true;
  });
}
export function assignedIncomingEdge(plan, call, localId) {
  if (!plan || !Array.isArray(plan.edges)) return null;
  if (
    call?.metadata?.version !== MEDIA_PROTOCOL_VERSION ||
    call.metadata.epoch !== plan?.epoch
  )
    return null;
  return (
    plan.edges.find(
      (edge) =>
        edge.childId === localId &&
        edge.parentId === call.peer &&
        edge.sourceId === call.metadata.sourceId &&
        edge.id === call.metadata.edgeId,
    ) ?? null
  );
}

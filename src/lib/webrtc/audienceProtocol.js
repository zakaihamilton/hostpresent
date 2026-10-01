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
});

const validId = (id) =>
  typeof id === "string" && id.length > 0 && id.length <= 128;
export function isMediaControl(message) {
  return Object.values(MEDIA_CONTROL).includes(message?.type);
}
export function validMediaPlan(plan, localId, hostId) {
  if (
    plan?.version !== MEDIA_PROTOCOL_VERSION ||
    !validId(plan.epoch) ||
    !Number.isSafeInteger(plan.revision) ||
    plan.revision < 1 ||
    !Array.isArray(plan.publishers) ||
    plan.publishers.length > 4 ||
    plan.publishers[0] !== hostId ||
    !plan.publishers.every(validId) ||
    new Set(plan.publishers).size !== plan.publishers.length ||
    !Array.isArray(plan.edges) ||
    plan.edges.length > 76
  )
    return false;
  const incoming = new Set();
  const ids = new Set();
  return plan.edges.every((edge) => {
    if (!edge || typeof edge !== "object") return false;
    if (
      !validId(edge.id) ||
      ids.has(edge.id) ||
      !validId(edge.parentId) ||
      !validId(edge.childId) ||
      !plan.publishers.includes(edge.sourceId) ||
      edge.childId === edge.sourceId ||
      edge.parentId === edge.childId ||
      (edge.parentId !== localId && edge.childId !== localId) ||
      typeof edge.fallback !== "boolean"
    )
      return false;
    ids.add(edge.id);
    if (edge.childId === localId) {
      if (incoming.has(edge.sourceId)) return false;
      incoming.add(edge.sourceId);
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

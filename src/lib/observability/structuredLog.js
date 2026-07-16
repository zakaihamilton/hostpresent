import crypto from "node:crypto";

export function createRequestId() {
  return crypto.randomUUID();
}

// Callers may pass only allow-listed fields. Never add credentials, room IDs,
// request URLs, or caught Error objects to structured events.
export function logServerEvent(event, fields = {}) {
  console.info(JSON.stringify({ level: "info", event, ...fields }));
}

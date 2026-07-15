export const DIAGNOSTIC_EVENT = Object.freeze({
  CONNECTION_FAILURE: "connection_failure",
  MEDIA_PERMISSION_FAILURE: "media_permission_failure",
  RECORDING_EXPORT_FAILURE: "recording_export_failure",
  DIAGNOSTICS_REPORT: "diagnostics_report",
});

const EVENT_VALUES = new Set(Object.values(DIAGNOSTIC_EVENT));
const STATUS_VALUES = new Set(["connected", "connecting", "error", "unknown"]);
const CODE_VALUES = new Set([
  "connection_error",
  "media_permission_error",
  "recording_export_error",
  "diagnostics_requested",
]);

export function validateDiagnosticPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!EVENT_VALUES.has(payload.event) || !CODE_VALUES.has(payload.code)) {
    return null;
  }
  if (!/^[a-z0-9-]{8,64}$/i.test(payload.correlationId ?? "")) return null;
  const details = payload.details ?? {};
  if (
    typeof details !== "object" ||
    !STATUS_VALUES.has(details.connectionStatus ?? "unknown") ||
    !Number.isInteger(details.activeConnections ?? 0) ||
    details.activeConnections < 0 ||
    details.activeConnections > 30 ||
    typeof details.hasTurn !== "boolean"
  ) {
    return null;
  }
  return {
    event: payload.event,
    code: payload.code,
    correlationId: payload.correlationId,
    details: {
      connectionStatus: details.connectionStatus ?? "unknown",
      activeConnections: details.activeConnections ?? 0,
      hasTurn: details.hasTurn,
    },
  };
}

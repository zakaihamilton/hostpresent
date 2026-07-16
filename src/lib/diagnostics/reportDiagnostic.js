const STORAGE_KEY = "hostpresent.diagnosticSessionId";

function createCorrelationId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getDiagnosticSessionId() {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const next = createCorrelationId();
    window.sessionStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return createCorrelationId();
  }
}

export async function reportDiagnostic({ event, code, details }) {
  const response = await fetch("/api/diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      code,
      details,
      correlationId: getDiagnosticSessionId(),
    }),
  });
  if (!response.ok) throw new Error("Diagnostic report could not be sent.");
}

const STORAGE_KEY = "hostpresent.participantDeviceId";

function createDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateParticipantDeviceId() {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && typeof existing === "string" && existing.length <= 128) {
      return existing;
    }
    const next = createDeviceId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return createDeviceId();
  }
}

export const DISPLAY_NAME_STORAGE_KEY = "hostpresent.displayName";
export const PARTICIPANT_MODE_STORAGE_KEY = "hostpresent.participantMode";

export const PARTICIPANT_MODE = {
  AVAILABLE: "available",
  LISTENING: "listening",
};

export const MAX_DISPLAY_NAME_LENGTH = 32;
export const DEFAULT_DISPLAY_NAME = "Guest";

export function normalizeDisplayNameInput(value) {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function resolveDisplayName(value) {
  if (typeof value !== "string") return DEFAULT_DISPLAY_NAME;
  const trimmed = value.trim();
  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH) || DEFAULT_DISPLAY_NAME;
}

export function displayNameInitial(value) {
  return resolveDisplayName(value).charAt(0).toUpperCase();
}

export function loadDisplayName() {
  if (typeof window === "undefined") return "";

  try {
    const stored = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    return typeof stored === "string" ? stored : "";
  } catch {
    return "";
  }
}

export function saveDisplayName(value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DISPLAY_NAME_STORAGE_KEY,
      normalizeDisplayNameInput(value),
    );
  } catch {
    // ignore storage failures
  }
}

export function loadParticipantMode() {
  if (typeof window === "undefined") return PARTICIPANT_MODE.AVAILABLE;

  try {
    const stored = window.localStorage.getItem(PARTICIPANT_MODE_STORAGE_KEY);
    if (stored === PARTICIPANT_MODE.LISTENING) {
      return PARTICIPANT_MODE.LISTENING;
    }
  } catch {
    // ignore storage failures
  }

  return PARTICIPANT_MODE.AVAILABLE;
}

export function saveParticipantMode(mode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PARTICIPANT_MODE_STORAGE_KEY,
      mode === PARTICIPANT_MODE.LISTENING
        ? PARTICIPANT_MODE.LISTENING
        : PARTICIPANT_MODE.AVAILABLE,
    );
  } catch {
    // ignore storage failures
  }
}

export function participantModeLabel(mode) {
  return mode === PARTICIPANT_MODE.LISTENING ? "Listening only" : "Available";
}

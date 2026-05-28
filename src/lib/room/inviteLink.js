import {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./joinCodeFormat.js";

export function buildParticipantInviteLink(joinCode) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const formatted = formatJoinCode(joinCode);
  return `${origin}/#/j/${formatted}`;
}

export function extractJoinCodeFromInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const patterns = [/#\/j\/([^/?#\s]+)/, /\/j\/([^/?#\s]+)/];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && isValidJoinCode(match[1])) {
      return normalizeJoinCode(match[1]);
    }
  }

  const bareCode = trimmed.replace(/\s+/g, "");
  if (isValidJoinCode(bareCode)) {
    return normalizeJoinCode(bareCode);
  }

  return "";
}

export function normalizeRoomIdInput(value) {
  return normalizeJoinCode(value);
}

export function formatRoomIdInput(value) {
  return formatJoinCode(normalizeJoinCode(value));
}

export async function resolveJoinCode(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  const response = await fetch(
    `/api/rooms/resolve?code=${encodeURIComponent(normalized)}`,
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "[E031] Could not resolve join code");
  }
  return response.json();
}

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

export async function resolveJoinCode(joinCode, { deviceId = "" } = {}) {
  const normalized = normalizeJoinCode(joinCode);
  const params = new URLSearchParams({ code: normalized });
  if (deviceId) {
    params.set("deviceId", deviceId);
  }
  const response = await fetch(`/api/rooms/resolve?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (response.status === 409 && payload.status === "waiting") {
    return {
      roomId: payload.roomId ?? null,
      joinCode: payload.joinCode ?? normalized,
      status: "waiting",
      waiting: true,
      participantToken: null,
    };
  }

  if (!response.ok) {
    throw new Error(payload.error ?? "[E031] Could not resolve join code");
  }
  return payload;
}

export async function openHostRoom(hostToken) {
  const response = await fetch("/api/rooms/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: hostToken }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "[E069] Failed to open room");
  }
  return payload;
}

export async function kickParticipantDevice({ hostToken, deviceId }) {
  const response = await fetch("/api/rooms/kick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: hostToken, deviceId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "[E081] Failed to record kick");
  }
  return payload;
}

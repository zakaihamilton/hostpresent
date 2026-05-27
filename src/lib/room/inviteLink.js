import {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./joinCodeFormat.js";

export function buildParticipantInviteLink(joinCode, openProof = null) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const formatted = formatJoinCode(joinCode);
  let link = `${origin}/#/j/${formatted}`;
  if (openProof) {
    link += `?open=${encodeURIComponent(openProof)}`;
  }
  return link;
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

function isValidJoinCodeFromMatch(value) {
  const normalized = normalizeJoinCode(value);
  if (/^[A-Z]{8}$/.test(normalized)) return true;
  return /^[23456789A-Z]{6,12}$/.test(normalized);
}

export function normalizeRoomIdInput(value) {
  return normalizeJoinCode(value);
}

export function extractOpenProofFromInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const fromSearch = url.searchParams.get("open");
    if (fromSearch) return fromSearch;
  } catch {
    // not a full URL
  }

  const hashQueryIndex = trimmed.indexOf("?open=");
  if (hashQueryIndex >= 0) {
    const query = trimmed.slice(hashQueryIndex + 1);
    return new URLSearchParams(query).get("open");
  }

  return null;
}

export async function resolveJoinCode(joinCode, { openProof = null } = {}) {
  const normalized = normalizeJoinCode(joinCode);
  const params = new URLSearchParams({ code: normalized });
  if (openProof) {
    params.set("open", openProof);
  }
  const response = await fetch(`/api/rooms/resolve?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Could not resolve join code");
  }
  return response.json();
}

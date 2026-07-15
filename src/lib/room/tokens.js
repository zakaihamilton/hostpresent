import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeJoinCode } from "./joinCodeFormat.js";
import { ROOM_ROLE } from "./roles.js";

// Room tokens are deliberately shorter lived than the eight-character join
// code. The code remains the durable, stateless participant credential; a
// leaked token therefore has a bounded useful lifetime.
export const ROOM_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export { ROOM_ROLE } from "./roles.js";

export function getSigningSecret() {
  return process.env.ROOM_TOKEN_SECRET?.trim() || null;
}

export function isRoomSigningEncrypted() {
  return Boolean(getSigningSecret());
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function signPayload(payload) {
  const secret = getSigningSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest();
}

function verifySignedPayload(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = signPayload(payloadPart);
  if (!expectedSignature) return null;
  const actualSignature = fromBase64Url(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(payloadPart).toString("utf8"));
  } catch {
    return null;
  }
}

export function signRoomToken({ roomId, role, joinCode = null }) {
  if (!getSigningSecret()) return null;
  const iat = Date.now();
  const exp = iat + ROOM_TOKEN_TTL_MS;
  const payload = {
    roomId,
    role,
    iat,
    exp,
    ...(joinCode ? { joinCode: normalizeJoinCode(joinCode) } : {}),
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = toBase64Url(signPayload(payloadPart));
  return `${payloadPart}.${signaturePart}`;
}

export const TOKEN_FAILURE = {
  MISSING: "missing",
  MALFORMED: "malformed",
  INVALID_SIGNATURE: "invalid_signature",
  INVALID_CLAIMS: "invalid_claims",
  EXPIRED: "expired",
};

function toVerifiedClaims(payload) {
  return {
    roomId: payload.roomId,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
    joinCode: payload.joinCode ?? null,
  };
}

export function inspectRoomToken(token) {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: TOKEN_FAILURE.MISSING };
  }

  if (!token.includes(".")) {
    return { ok: false, reason: TOKEN_FAILURE.MALFORMED };
  }

  const payload = verifySignedPayload(token);
  if (!payload) {
    return { ok: false, reason: TOKEN_FAILURE.INVALID_SIGNATURE };
  }

  if (
    !payload.roomId ||
    (payload.role !== ROOM_ROLE.HOST &&
      payload.role !== ROOM_ROLE.PARTICIPANT) ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number" ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > ROOM_TOKEN_TTL_MS
  ) {
    return { ok: false, reason: TOKEN_FAILURE.INVALID_CLAIMS };
  }

  const verified = toVerifiedClaims(payload);
  if (payload.exp < Date.now()) {
    return { ok: false, reason: TOKEN_FAILURE.EXPIRED, verified };
  }

  return { ok: true, verified };
}

export function verifyRoomToken(token) {
  const inspection = inspectRoomToken(token);
  return inspection.ok ? inspection.verified : null;
}

export function createRoomTokens(roomId, joinCode = null) {
  const hostToken = signRoomToken({ roomId, role: ROOM_ROLE.HOST, joinCode });
  const participantToken = signRoomToken({
    roomId,
    role: ROOM_ROLE.PARTICIPANT,
    joinCode,
  });
  return {
    roomId,
    hostToken,
    participantToken,
  };
}

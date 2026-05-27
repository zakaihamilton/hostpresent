import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeJoinCode } from "./joinCodeFormat.js";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const ROOM_ROLE = {
  HOST: "host",
  PARTICIPANT: "participant",
};

const DEV_FALLBACK_SECRET = "hostpresent-dev-signing-secret";

export function getSigningSecret() {
  return process.env.ROOM_SIGNING_SECRET || DEV_FALLBACK_SECRET;
}

export function isRoomSigningEncrypted() {
  return Boolean(process.env.ROOM_SIGNING_SECRET);
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
  return createHmac("sha256", secret).update(payload).digest();
}

function verifySignedPayload(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = signPayload(payloadPart);
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
  const iat = Date.now();
  const exp = iat + TOKEN_TTL_MS;
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

export function verifyRoomToken(token) {
  const payload = verifySignedPayload(token);
  if (
    !payload?.roomId ||
    (payload.role !== ROOM_ROLE.HOST &&
      payload.role !== ROOM_ROLE.PARTICIPANT) ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    return null;
  }

  return {
    roomId: payload.roomId,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
    joinCode: payload.joinCode ?? null,
  };
}

export function createRoomTokens(roomId, joinCode = null) {
  return {
    roomId,
    hostToken: signRoomToken({ roomId, role: ROOM_ROLE.HOST, joinCode }),
    participantToken: signRoomToken({
      roomId,
      role: ROOM_ROLE.PARTICIPANT,
      joinCode,
    }),
  };
}

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PEER_AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PEER_AUTH_AUDIENCE = "hostpresent-peerjs";
const MAX_TOKEN_LENGTH = 2048;

function getRoomSigningSecret() {
  return process.env.ROOM_TOKEN_SECRET?.trim() || null;
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

function signPayload(payloadPart, secret) {
  return createHmac("sha256", secret).update(payloadPart).digest();
}

export function signPeerAuthToken({ roomId, role, expiresAt }) {
  const secret = getRoomSigningSecret();
  const iat = Date.now();
  if (
    !secret ||
    typeof roomId !== "string" ||
    !roomId ||
    (role !== "host" && role !== "participant") ||
    typeof expiresAt !== "number" ||
    expiresAt <= iat
  ) {
    return null;
  }

  const exp = Math.min(iat + PEER_AUTH_TOKEN_TTL_MS, expiresAt);
  const payloadPart = toBase64Url(
    JSON.stringify({
      aud: PEER_AUTH_AUDIENCE,
      roomId,
      role,
      iat,
      exp,
      jti: randomBytes(16).toString("base64url"),
    }),
  );
  const signaturePart = toBase64Url(signPayload(payloadPart, secret));
  return `${payloadPart}.${signaturePart}`;
}

export function verifyPeerAuthToken(token) {
  const secret = getRoomSigningSecret();
  if (!secret || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payloadPart, signaturePart] = parts;
  const expectedSignature = signPayload(payloadPart, secret);
  const actualSignature = fromBase64Url(signaturePart);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  let claims;
  try {
    claims = JSON.parse(fromBase64Url(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  const now = Date.now();
  if (
    claims?.aud !== PEER_AUTH_AUDIENCE ||
    typeof claims.roomId !== "string" ||
    !claims.roomId ||
    (claims.role !== "host" && claims.role !== "participant") ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" ||
    claims.jti.length !== 22 ||
    claims.exp <= now ||
    claims.iat > now + 60_000 ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > PEER_AUTH_TOKEN_TTL_MS
  ) {
    return null;
  }

  return {
    roomId: claims.roomId,
    role: claims.role,
    iat: claims.iat,
    exp: claims.exp,
  };
}

export function isPeerIdAuthorizedForClaims(peerId, claims) {
  if (typeof peerId !== "string" || !claims?.roomId) return false;
  const hostPeerId = `hp-${claims.roomId}`;
  if (claims.role === "host") return peerId === hostPeerId;
  if (claims.role === "participant") return !peerId.startsWith("hp-");
  return false;
}

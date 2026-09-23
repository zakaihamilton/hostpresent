import { createHmac, timingSafeEqual } from "node:crypto";

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

export function createPeerAuthTicket({
  roomId,
  role,
  issuedAt,
  expiresAt,
  sessionToken,
}) {
  const secret = getRoomSigningSecret();
  const iat = issuedAt;
  if (
    !secret ||
    typeof roomId !== "string" ||
    !roomId ||
    (role !== "host" && role !== "participant") ||
    typeof iat !== "number" ||
    typeof expiresAt !== "number" ||
    expiresAt <= iat ||
    typeof sessionToken !== "string" ||
    !sessionToken ||
    sessionToken.length > MAX_TOKEN_LENGTH
  ) {
    return null;
  }

  const exp = Math.min(iat + PEER_AUTH_TOKEN_TTL_MS, expiresAt);
  const jti = createHmac("sha256", secret)
    .update("hostpresent-peer-session:")
    .update(sessionToken)
    .digest()
    .subarray(0, 16)
    .toString("hex");
  const peerId = role === "host" ? `hp-${roomId}` : `pp-${jti}`;
  const payloadPart = toBase64Url(
    JSON.stringify({
      aud: PEER_AUTH_AUDIENCE,
      roomId,
      role,
      iat,
      exp,
      jti,
      peerId,
    }),
  );
  const signaturePart = toBase64Url(signPayload(payloadPart, secret));
  return { token: `${payloadPart}.${signaturePart}`, peerId };
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
    claims.jti.length !== 32 ||
    typeof claims.peerId !== "string" ||
    claims.peerId !==
      (claims.role === "host" ? `hp-${claims.roomId}` : `pp-${claims.jti}`) ||
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
    peerId: claims.peerId,
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
  };
}

export function isPeerIdAuthorizedForClaims(peerId, claims) {
  if (typeof peerId !== "string" || !claims?.roomId) return false;
  if (claims.role === "host") {
    return peerId === `hp-${claims.roomId}` && peerId === claims.peerId;
  }
  if (claims.role === "participant") {
    return peerId === `pp-${claims.jti}` && peerId === claims.peerId;
  }
  return false;
}

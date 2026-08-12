import { createHmac, timingSafeEqual } from "node:crypto";
import { toBase64Url, fromBase64Url } from "@/lib/utils/base64url";

/** Short-lived token for ICE config access (WebRTC handshake only needs a brief window). */
export const ICE_ROOM_TOKEN_TTL_MS = 5 * 60 * 1000;

function getInternalAuthSecret() {
  return process.env.INTERNAL_AUTH_SECRET?.trim() || null;
}

function signPayload(payloadPart, secret) {
  return createHmac("sha256", secret).update(payloadPart).digest();
}



/**
 * Stateless short-lived room token for /api/media/ice-config.
 * Format: base64url(JSON).base64url(HMAC-SHA256)
 */
export function signIceRoomToken({ roomId }) {
  const secret = getInternalAuthSecret();
  if (!secret || !roomId) return null;

  const iat = Date.now();
  const exp = iat + ICE_ROOM_TOKEN_TTL_MS;
  const payload = { roomId, iat, exp, aud: "ice-config" };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = toBase64Url(signPayload(payloadPart, secret));
  return `${payloadPart}.${signaturePart}`;
}

export function verifyIceRoomToken(token) {
  const secret = getInternalAuthSecret();
  if (!secret || !token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = signPayload(payloadPart, secret);
  const actualSignature = fromBase64Url(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  if (
    payload?.aud !== "ice-config" ||
    !payload?.roomId ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    return null;
  }

  return { roomId: payload.roomId, iat: payload.iat, exp: payload.exp };
}

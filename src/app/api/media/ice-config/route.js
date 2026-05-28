import { NextResponse } from "next/server";
import crypto from "crypto";
import { applySecurityHeaders } from "@/lib/room/apiSecurity";
import { verifyIceRoomToken } from "@/lib/media/iceRoomToken";

export const runtime = "nodejs";

const TURN_CREDENTIAL_TTL_SECONDS = 120;
const GENERIC_FORBIDDEN = { error: "Access denied." };
const GENERIC_SERVER_ERROR = { error: "Media configuration is unavailable." };

function getRoomTokenFromRequest(request) {
  const fromQuery = new URL(request.url).searchParams.get("roomToken");
  if (fromQuery) return fromQuery;

  return (
    request.headers.get("x-room-token")?.trim() ||
    request.headers.get("room-token")?.trim() ||
    null
  );
}

function jsonResponse(body, status) {
  return applySecurityHeaders(NextResponse.json(body, { status }));
}

function forbiddenResponse(reason) {
  console.warn("[api/media/ice-config] forbidden:", reason);
  return jsonResponse(GENERIC_FORBIDDEN, 403);
}

function serverErrorResponse(reason) {
  console.error("[api/media/ice-config] server error:", reason);
  return jsonResponse(GENERIC_SERVER_ERROR, 500);
}

export async function GET(request) {
  const roomToken = getRoomTokenFromRequest(request);
  if (!roomToken) {
    return forbiddenResponse("missing room token");
  }

  if (roomToken.length > 2048) {
    return forbiddenResponse("token too long");
  }

  if (!process.env.INTERNAL_AUTH_SECRET?.trim()) {
    return serverErrorResponse("INTERNAL_AUTH_SECRET is not configured");
  }

  const verified = verifyIceRoomToken(roomToken);
  if (!verified) {
    return forbiddenResponse("invalid or expired room token");
  }

  const turnSecret = process.env.TURN_SECRET_KEY;
  const domain = process.env.TURN_DOMAIN || "hostpresent.duckdns.org";

  if (!turnSecret) {
    return serverErrorResponse("TURN_SECRET_KEY is not configured");
  }

  try {
    const unixTimestamp =
      Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
    const username = `${unixTimestamp}:${verified.roomId}`;

    const credential = crypto
      .createHmac("sha1", turnSecret)
      .update(username)
      .digest("base64");

    return jsonResponse({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: `turn:${domain}:443?transport=udp`,
          username,
          credential,
        },
        {
          urls: `turns:${domain}:443?transport=tcp`,
          username,
          credential,
        },
      ],
    });
  } catch (error) {
    console.error("[api/media/ice-config] credential generation failed", error);
    return serverErrorResponse("credential generation failed");
  }
}

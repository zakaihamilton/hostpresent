import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { verifyIceRoomToken } from "@/lib/media/iceRoomToken";
import {
  createRequestId,
  logServerEvent,
} from "@/lib/observability/structuredLog";
import { applySecurityHeaders } from "@/lib/room/apiSecurity";

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

function forbiddenResponse(requestId, reason) {
  logServerEvent("ice_config_forbidden", { requestId, reason });
  return jsonResponse(GENERIC_FORBIDDEN, 403);
}

function serverErrorResponse(requestId, reason) {
  logServerEvent("ice_config_failed", { requestId, reason });
  return jsonResponse(GENERIC_SERVER_ERROR, 500);
}

export async function GET(request) {
  const requestId = createRequestId();
  const roomToken = getRoomTokenFromRequest(request);
  if (!roomToken) {
    return forbiddenResponse(requestId, "missing_room_token");
  }

  if (roomToken.length > 2048) {
    return forbiddenResponse(requestId, "token_too_long");
  }

  if (!process.env.INTERNAL_AUTH_SECRET?.trim()) {
    return serverErrorResponse(requestId, "internal_auth_unconfigured");
  }

  const verified = verifyIceRoomToken(roomToken);
  if (!verified) {
    return forbiddenResponse(requestId, "invalid_or_expired_token");
  }

  const turnSecret = process.env.TURN_SECRET_KEY;
  const domain = process.env.TURN_DOMAIN || "hostpresent.duckdns.org";

  if (!turnSecret) {
    return serverErrorResponse(requestId, "turn_secret_unconfigured");
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
  } catch {
    return serverErrorResponse(requestId, "credential_generation_failed");
  }
}

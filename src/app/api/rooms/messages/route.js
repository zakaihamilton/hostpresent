import {
  enforceRateLimit,
  guardPostRequest,
  RATE_LIMITS,
  validateJsonPost,
} from "@/lib/room/apiSecurity";
import { canRelayMessage } from "@/lib/room/messageAuth";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";
import { isSignalingMessage } from "@/lib/signaling/messages";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const validation = validateJsonPost(request);
    if (!validation.ok) {
      return jsonError(validation.error, validation.status);
    }

    const ipBlocked = await enforceRateLimit(request, RATE_LIMITS.messages);
    if (ipBlocked) return ipBlocked;

    const body = await readJsonBody(request);
    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const { token, message } = body;
    const auth = verifyRequestToken(token);
    if (auth.error) return auth.error;

    const { verified } = auth;

    const roomBlocked = await enforceRateLimit(request, {
      ...RATE_LIMITS.messagesPerRoom,
      keySuffix: verified.roomId,
    });
    if (roomBlocked) return roomBlocked;

    if (!isSignalingMessage(message)) {
      return jsonError("Invalid message", 400);
    }

    if (!canRelayMessage({ role: verified.role, message })) {
      return jsonError("Forbidden", 403);
    }

    return jsonError(
      "Room messages are relayed over WebRTC data channels",
      410,
    );
  } catch (error) {
    console.error("[api/rooms/messages] relay failed", error);
    return jsonError("Failed to relay message", 500);
  }
}

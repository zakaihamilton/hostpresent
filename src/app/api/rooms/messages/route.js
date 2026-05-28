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
      return jsonError("[E070] Invalid JSON body", 400);
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
      return jsonError("[E071] Invalid message", 400);
    }

    if (!canRelayMessage({ role: verified.role, message })) {
      return jsonError("[E072] Forbidden", 403);
    }

    return jsonError(
      "[E073] Room messages are relayed over WebRTC data channels",
      410,
    );
  } catch (error) {
    console.error("[api/rooms/messages] relay failed", error);
    return jsonError("[E074] Failed to relay message", 500);
  }
}

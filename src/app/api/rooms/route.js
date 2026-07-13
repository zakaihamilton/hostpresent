import { guardPostRequest } from "@/lib/room/apiSecurity";
import { createJoinCode } from "@/lib/room/joinCode";
import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import { jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { ROOM_ROLE, signRoomToken } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = guardPostRequest(request);
  if (blocked) return blocked;

  try {
    const joinCode = createJoinCode();
    const roomId = deriveRoomIdFromJoinCode(joinCode);
    if (!roomId) {
      return jsonError("[E083] Room signing is not configured", 503);
    }
    const hostToken = signRoomToken({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode,
    });
    if (!hostToken)
      return jsonError("[E083] Room signing is not configured", 503);

    return jsonOk({
      roomId,
      hostToken,
      joinCode,
    });
  } catch (error) {
    console.error("[api/rooms] create failed", error);
    return jsonError("[E067] Failed to create room", 500);
  }
}

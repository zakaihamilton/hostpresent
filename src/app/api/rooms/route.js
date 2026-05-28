import { guardPostRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import { createJoinCode } from "@/lib/room/joinCode";
import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import { jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { createRoomRecord } from "@/lib/room/store";
import { ROOM_ROLE, signRoomToken } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = await guardPostRequest(request, RATE_LIMITS.createRoom);
  if (blocked) return blocked;

  try {
    const joinCode = createJoinCode();
    const roomId = deriveRoomIdFromJoinCode(joinCode);
    const hostToken = signRoomToken({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode,
    });
    const participantToken = signRoomToken({
      roomId,
      role: ROOM_ROLE.PARTICIPANT,
      joinCode,
    });
    const room = await createRoomRecord({
      roomId,
      joinCode,
      hostToken,
      participantToken,
    });

    return jsonOk({
      roomId: room.roomId,
      hostToken: room.hostToken,
      participantToken: room.participantToken,
      joinCode: room.joinCode,
    });
  } catch (error) {
    console.error("[api/rooms] create failed", error);
    return jsonError("[E067] Failed to create room", 500);
  }
}

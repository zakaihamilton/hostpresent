import { guardPostRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import { jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { createRoomRecord } from "@/lib/room/store";
import { createRoomId, createRoomTokens } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = await guardPostRequest(request, RATE_LIMITS.createRoom);
  if (blocked) return blocked;

  try {
    const roomId = createRoomId();
    const tokens = createRoomTokens(roomId);
    const room = await createRoomRecord(tokens);

    return jsonOk({
      roomId: room.roomId,
      hostToken: room.hostToken,
      participantToken: room.participantToken,
      joinCode: room.joinCode,
    });
  } catch (error) {
    console.error("[api/rooms] create failed", error);
    return jsonError("Failed to create room", 500);
  }
}

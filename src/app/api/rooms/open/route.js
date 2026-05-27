import {
  guardPostRequest,
  RATE_LIMITS,
} from "@/lib/room/apiSecurity";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";
import {
  getRoomById,
  openRoom,
  restoreRoomFromToken,
  ROOM_STATUS,
} from "@/lib/room/store";
import { ROOM_ROLE } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = await guardPostRequest(request, RATE_LIMITS.open);
  if (blocked) return blocked;

  try {
    const body = await readJsonBody(request);
    const token = body?.token;
    const auth = verifyRequestToken(token);
    if (auth.error) return auth.error;

    const { verified } = auth;
    if (verified.role !== ROOM_ROLE.HOST) {
      return jsonError("Host token required", 403);
    }

    let room = await getRoomById(verified.roomId, {
      joinCode: verified.joinCode,
    });
    if (!room) {
      room = await restoreRoomFromToken({
        roomId: verified.roomId,
        role: verified.role,
        token,
      });
    }

    const opened =
      room.status === ROOM_STATUS.OPEN
        ? room
        : await openRoom(verified.roomId, {
            joinCode: room.joinCode ?? verified.joinCode,
          });

    return jsonOk({
      roomId: verified.roomId,
      status: opened.status,
      openedAt: opened.openedAt,
      joinCode: opened.joinCode ?? null,
      openProof: opened.openProof ?? null,
    });
  } catch (error) {
    console.error("[api/rooms/open] failed", error);
    return jsonError("Failed to open room", 500);
  }
}

import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { getSearchParam, jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { getRoomByJoinCode } from "@/lib/room/store";
import { signRoomOpenProof } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.resolve);
  if (blocked) return blocked;

  const joinCode = normalizeJoinCode(getSearchParam(request, "code") ?? "");
  const openProof = getSearchParam(request, "open");

  if (!isValidJoinCode(joinCode)) {
    return jsonError("Invalid join code", 400);
  }

  const room = await getRoomByJoinCode(joinCode, { openProof });
  if (!room) {
    return jsonError("Room not found", 404);
  }

  let responseOpenProof = openProof;
  if (room.status === "open" && !responseOpenProof && room.openedAt) {
    responseOpenProof = signRoomOpenProof({
      roomId: room.roomId,
      joinCode: room.joinCode,
      openedAt: room.openedAt,
    });
  }

  return jsonOk({
    roomId: room.roomId,
    joinCode: room.joinCode,
    participantToken: room.participantToken,
    status: room.status,
    openProof: room.status === "open" ? responseOpenProof : null,
  });
}

import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { getSearchParam, jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { getRoomByJoinCode } from "@/lib/room/store";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.resolve);
  if (blocked) return blocked;

  const joinCode = normalizeJoinCode(getSearchParam(request, "code") ?? "");

  if (!isValidJoinCode(joinCode)) {
    return jsonError("Invalid join code", 400);
  }

  const room = await getRoomByJoinCode(joinCode);
  if (!room) {
    return jsonError("Room not found", 404);
  }

  return jsonOk({
    roomId: room.roomId,
    joinCode: room.joinCode,
    participantToken: room.participantToken,
    status: room.status,
  });
}

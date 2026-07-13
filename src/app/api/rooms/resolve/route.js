import { isValidJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import { getSearchParam, jsonError, jsonOk } from "@/lib/room/routeHelpers";
import { ROOM_ROLE, signRoomToken } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function GET(request) {
  const joinCode = normalizeJoinCode(getSearchParam(request, "code") ?? "");

  if (!isValidJoinCode(joinCode)) {
    return jsonError("[E075] Invalid join code", 400);
  }

  const roomId = deriveRoomIdFromJoinCode(joinCode);
  if (!roomId) return jsonError("[E083] Room signing is not configured", 503);
  const participantToken = signRoomToken({
    roomId,
    role: ROOM_ROLE.PARTICIPANT,
    joinCode,
  });
  if (!participantToken)
    return jsonError("[E083] Room signing is not configured", 503);

  return jsonOk({
    roomId,
    joinCode,
    participantToken,
  });
}

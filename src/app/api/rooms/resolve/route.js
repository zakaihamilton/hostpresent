import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { getSearchParam, jsonError, jsonOk } from "@/lib/room/routeHelpers";
import {
  getRoomByJoinCode,
  isDeviceKickedFromRoom,
  ROOM_STATUS,
} from "@/lib/room/store";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.resolve);
  if (blocked) return blocked;

  const joinCode = normalizeJoinCode(getSearchParam(request, "code") ?? "");
  const deviceId = (getSearchParam(request, "deviceId") ?? "").trim();

  if (!isValidJoinCode(joinCode)) {
    return jsonError("[E075] Invalid join code", 400);
  }

  const room = await getRoomByJoinCode(joinCode);
  if (!room) {
    return jsonError("[E076] Room not found", 404);
  }

  if (isDeviceKickedFromRoom(room, deviceId)) {
    return jsonOk(
      {
        error:
          "[E078] You were removed from this meeting and cannot rejoin.",
        status: "kicked",
        roomId: room.roomId,
        joinCode: room.joinCode,
      },
      { status: 403 },
    );
  }

  if (room.status === ROOM_STATUS.WAITING) {
    return jsonOk(
      {
        error: "[E079] Waiting for the host to start the meeting.",
        status: ROOM_STATUS.WAITING,
        roomId: room.roomId,
        joinCode: room.joinCode,
      },
      { status: 409 },
    );
  }

  return jsonOk({
    roomId: room.roomId,
    joinCode: room.joinCode,
    participantToken: room.participantToken,
    status: room.status ?? ROOM_STATUS.OPEN,
  });
}

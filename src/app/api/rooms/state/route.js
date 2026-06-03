import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  getSearchParam,
  jsonOk,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";
import {
  getRoomById,
  ROOM_STATUS,
  restoreRoomFromToken,
} from "@/lib/room/store";
import { ROOM_ROLE } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.state);
  if (blocked) return blocked;

  const token = getSearchParam(request, "token");
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;
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

  const iceRoomToken = signIceRoomToken({ roomId: verified.roomId });

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    status: ROOM_STATUS.OPEN,
    openedAt: room.openedAt ?? null,
    createdAt: room.createdAt ?? null,
    joinCode: room.joinCode ?? verified.joinCode ?? null,
    ...(iceRoomToken ? { iceRoomToken } : {}),
  };

  if (verified.role === ROOM_ROLE.HOST) {
    response.participantToken = room.participantToken;
  }

  return jsonOk(response);
}

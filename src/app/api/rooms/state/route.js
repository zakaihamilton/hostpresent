import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  getSearchParam,
  jsonOk,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";
import {
  getRoomById,
  restoreRoomFromToken,
  ROOM_STATUS,
} from "@/lib/room/store";
import { ROOM_ROLE } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.state);
  if (blocked) return blocked;

  const token = getSearchParam(request, "token");
  const openProof = getSearchParam(request, "open");
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;
  let room = await getRoomById(verified.roomId, {
    openProof,
    joinCode: verified.joinCode,
  });
  if (!room) {
    room = await restoreRoomFromToken({
      roomId: verified.roomId,
      role: verified.role,
      token,
    });
    if (openProof) {
      room = await getRoomById(verified.roomId, {
        openProof,
        joinCode: room.joinCode ?? verified.joinCode,
      });
    }
  }

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    status: room.status ?? ROOM_STATUS.WAITING,
    openedAt: room.openedAt ?? null,
    createdAt: room.createdAt ?? null,
    joinCode: room.joinCode ?? verified.joinCode ?? null,
  };

  if (verified.role === ROOM_ROLE.HOST) {
    response.participantToken = room.participantToken;
  }

  if (response.status === "open" && openProof) {
    response.openProof = openProof;
  }

  return jsonOk(response);
}

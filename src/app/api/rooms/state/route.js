import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  getSearchParam,
  issueRenewedRoomTokens,
  jsonOk,
  resolveHostRoomAuth,
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
  const auth = resolveHostRoomAuth(token);
  if (auth.error) return auth.error;

  const { verified, renewHostToken } = auth;
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

  const joinCode = room.joinCode ?? verified.joinCode ?? null;
  let renewedTokens = null;
  if (renewHostToken) {
    renewedTokens = issueRenewedRoomTokens({
      roomId: verified.roomId,
      joinCode,
    });
    room = {
      ...room,
      hostToken: renewedTokens.hostToken,
      participantToken: renewedTokens.participantToken,
    };
  }

  const iceRoomToken = signIceRoomToken({ roomId: verified.roomId });

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    status: ROOM_STATUS.OPEN,
    openedAt: room.openedAt ?? null,
    createdAt: room.createdAt ?? null,
    joinCode,
    ...(iceRoomToken ? { iceRoomToken } : {}),
  };

  if (verified.role === ROOM_ROLE.HOST) {
    response.participantToken =
      renewedTokens?.participantToken ?? room.participantToken;
    if (renewedTokens) {
      response.hostToken = renewedTokens.hostToken;
    }
  }

  return jsonOk(response);
}

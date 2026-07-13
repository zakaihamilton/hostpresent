import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import {
  getSearchParam,
  jsonOk,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function GET(request) {
  const token = getSearchParam(request, "token");
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;

  const iceRoomToken = signIceRoomToken({ roomId: verified.roomId });

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    joinCode: verified.joinCode ?? null,
    ...(iceRoomToken ? { iceRoomToken } : {}),
  };

  return jsonOk(response);
}

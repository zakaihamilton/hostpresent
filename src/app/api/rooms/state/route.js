import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import {
  getBearerToken,
  jsonOk,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function GET(request) {
  const token = getBearerToken(request);
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

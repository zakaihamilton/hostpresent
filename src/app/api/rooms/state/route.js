import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { signPeerAuthToken } from "@/lib/room/peerAuthToken.mjs";
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
  const peerAuthToken = signPeerAuthToken({
    roomId: verified.roomId,
    role: verified.role,
    expiresAt: verified.exp,
  });

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    joinCode: verified.joinCode ?? null,
    ...(iceRoomToken ? { iceRoomToken } : {}),
    ...(peerAuthToken ? { peerAuthToken } : {}),
  };

  return jsonOk(response);
}

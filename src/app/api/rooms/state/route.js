import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { createPeerAuthTicket } from "@/lib/room/peerAuthToken.mjs";
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
  const peerAuthTicket = createPeerAuthTicket({
    roomId: verified.roomId,
    role: verified.role,
    issuedAt: verified.iat,
    expiresAt: verified.exp,
    sessionToken: token,
  });

  const response = {
    roomId: verified.roomId,
    role: verified.role,
    joinCode: verified.joinCode ?? null,
    ...(iceRoomToken ? { iceRoomToken } : {}),
    ...(peerAuthTicket
      ? {
          peerAuthToken: peerAuthTicket.token,
          peerId: peerAuthTicket.peerId,
        }
      : {}),
  };

  return jsonOk(response);
}

import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  getSignalingServerPath,
  isSignalingServerConfigured,
} from "@/lib/webrtc/peerClient";
import { isRoomSigningEncrypted } from "@/lib/room/tokens";
import { jsonOk } from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.config);
  if (blocked) return blocked;

  return jsonOk({
    encrypted: isRoomSigningEncrypted(),
    signaling: "webrtc-peerjs",
    signalingServerConfigured: isSignalingServerConfigured(),
    signalingServerPath: getSignalingServerPath(),
  });
}

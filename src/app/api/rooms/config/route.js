import { guardGetRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  buildPeerJsConfig,
  getSignalingServerHost,
  getSignalingServerPath,
  isSignalingServerConfigured,
} from "@/lib/webrtc/peerClient";
import { isRoomSigningEncrypted } from "@/lib/room/tokens";
import { jsonOk } from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.config);
  if (blocked) return blocked;

  const host = getSignalingServerHost();
  const peerJs = host ? buildPeerJsConfig(host) : null;

  return jsonOk({
    encrypted: isRoomSigningEncrypted(),
    signaling: "webrtc-peerjs",
    signalingServerConfigured: isSignalingServerConfigured(),
    signalingServerPath: getSignalingServerPath(),
    peerJs,
  });
}

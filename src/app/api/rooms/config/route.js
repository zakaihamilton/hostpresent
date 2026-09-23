import { jsonOk } from "@/lib/room/routeHelpers";
import { isRoomSigningConfigured } from "@/lib/room/tokens";
import {
  buildPeerJsConfig,
  getSignalingServerHost,
  getSignalingServerPath,
  isSignalingServerConfigured,
  REQUIRED_SIGNALING_AUTH_MODE,
} from "@/lib/webrtc/peerClient";

export const runtime = "nodejs";

export async function GET(_request) {
  const host = getSignalingServerHost();
  const peerJs = host ? buildPeerJsConfig(host) : null;

  return jsonOk({
    roomSigningConfigured: isRoomSigningConfigured(),
    signaling: "webrtc-peerjs",
    signalingServerConfigured: isSignalingServerConfigured(),
    signalingAuthMode:
      process.env.SIGNALING_AUTH_MODE === REQUIRED_SIGNALING_AUTH_MODE
        ? REQUIRED_SIGNALING_AUTH_MODE
        : null,
    signalingServerPath: getSignalingServerPath(),
    peerJs,
  });
}

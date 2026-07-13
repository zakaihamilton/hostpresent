import { jsonOk } from "@/lib/room/routeHelpers";
import { isRoomSigningEncrypted } from "@/lib/room/tokens";
import {
  buildPeerJsConfig,
  getSignalingServerHost,
  getSignalingServerPath,
  isSignalingServerConfigured,
} from "@/lib/webrtc/peerClient";

export const runtime = "nodejs";

export async function GET(_request) {
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

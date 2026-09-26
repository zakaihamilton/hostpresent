import {
  createRequestId,
  logServerEvent,
} from "@/lib/observability/structuredLog";
import {
  fetchPeerovoPublicConfig,
  PeerovoClientError,
} from "@/lib/peerovo/client";
import { jsonOk } from "@/lib/room/routeHelpers";
import { isRoomSigningConfigured } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function GET() {
  let peerovoConfig = null;
  try {
    peerovoConfig = await fetchPeerovoPublicConfig();
  } catch (error) {
    logServerEvent("peerovo_config_unavailable", {
      requestId: createRequestId(),
      reason:
        error instanceof PeerovoClientError
          ? error.reason
          : "config_unavailable",
    });
  }

  return jsonOk({
    roomSigningConfigured: isRoomSigningConfigured(),
    signaling: "webrtc-peerjs",
    signalingServerConfigured: Boolean(peerovoConfig),
    signalingAuthMode: peerovoConfig?.signalingAuthMode ?? null,
    signalingServerPath: peerovoConfig?.peerJs.path ?? null,
    peerJs: peerovoConfig?.peerJs ?? null,
  });
}

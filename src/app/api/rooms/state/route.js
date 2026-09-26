import {
  createRequestId,
  logServerEvent,
} from "@/lib/observability/structuredLog";
import {
  getPeerovoIceConfigUrl,
  issuePeerovoPeerToken,
  PeerovoClientError,
} from "@/lib/peerovo/client";
import { createHostPresentPeerIdentity } from "@/lib/room/peerIdentity.mjs";
import {
  getBearerToken,
  jsonError,
  jsonOk,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = createRequestId();
  const token = getBearerToken(request);
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;
  const identity = createHostPresentPeerIdentity({
    roomId: verified.roomId,
    role: verified.role,
    sessionToken: token,
  });
  if (!identity) {
    logServerEvent("peerovo_ticket_issue_failed", {
      requestId,
      reason: "peer_identity_unavailable",
    });
    return jsonError("WebRTC connectivity is unavailable.", 503);
  }

  try {
    const ticket = await issuePeerovoPeerToken({
      sessionId: verified.roomId,
      peerId: identity.peerId,
      sessionExpiresAt: verified.exp,
    });
    const iceConfigUrl = getPeerovoIceConfigUrl({
      sessionId: verified.roomId,
      peerId: identity.peerId,
    });
    if (!iceConfigUrl) throw new PeerovoClientError("unconfigured");

    return jsonOk({
      roomId: verified.roomId,
      role: verified.role,
      joinCode: verified.joinCode ?? null,
      peerAuthToken: ticket.peerToken,
      peerId: identity.peerId,
      iceConfigUrl,
    });
  } catch (error) {
    logServerEvent("peerovo_ticket_issue_failed", {
      requestId,
      reason:
        error instanceof PeerovoClientError
          ? error.reason
          : "ticket_unavailable",
    });
    return jsonError("WebRTC connectivity is unavailable.", 503);
  }
}

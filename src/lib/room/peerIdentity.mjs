import { createHmac } from "node:crypto";
import { getSigningSecret } from "./tokens.js";

const MAX_SESSION_TOKEN_LENGTH = 2048;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function createHostPresentPeerIdentity({ roomId, role, sessionToken }) {
  const secret = getSigningSecret();
  if (
    !secret ||
    typeof roomId !== "string" ||
    !RESOURCE_ID_PATTERN.test(roomId) ||
    (role !== "host" && role !== "participant") ||
    typeof sessionToken !== "string" ||
    !sessionToken ||
    sessionToken.length > MAX_SESSION_TOKEN_LENGTH
  ) {
    return null;
  }

  if (role === "host") {
    return { peerId: `hp-${roomId}` };
  }

  const jti = createHmac("sha256", secret)
    .update("hostpresent-peer-session:")
    .update(sessionToken)
    .digest()
    .subarray(0, 16)
    .toString("hex");
  return { peerId: `pp-${jti}` };
}

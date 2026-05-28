const DEFAULT_SIGNALING_PATH = "/myapp";
const DEFAULT_SIGNALING_PORT = 443;

export { DEFAULT_SIGNALING_PATH };

const SIGNALING_CONFIG_HINT =
  "[E015] Set SIGNALING_SERVER_URL to your PeerJS hostname (no https://) in Vercel env vars or .env.local, then redeploy.";

export const SIGNALING_ERROR = {
  NOT_CONFIGURED:
    "[E002] Signaling server is not configured. Set SIGNALING_SERVER_URL on the server to your PeerJS hostname.",
  CONFIG_LOAD_FAILED: "[E001] Could not load signaling configuration.",
  HOST_TIMEOUT: "[E003] Could not reach the PeerJS server in time.",
  HOST_RETRY_EXHAUSTED:
    "[E004] Could not connect to the PeerJS server after several attempts.",
  PARTICIPANT_TIMEOUT: "[E005] Could not connect to the meeting in time.",
  PARTICIPANT_RETRY_EXHAUSTED:
    "[E006] Could not connect to the meeting after several attempts.",
  HOST_ID_RECONNECTING:
    "[E007] Another host session may still be disconnecting. Reconnecting…",
};

export const HOST_SIGNING_REACHABILITY_HINT =
  "[E013] SIGNALING_SERVER_URL is set, but the browser could not connect to the PeerJS server. Confirm the PeerJS process is running, the host/path/port match your env vars, and that WebSockets are allowed.";

export const PARTICIPANT_REACHABILITY_HINT =
  "[E014] Ask the host to join the meeting first. If they are already in the room, the PeerJS server may be down, restarting, or blocked by your network.";

function normalizeSignalingHost(value) {
  if (!value || typeof value !== "string") return null;
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function normalizeSignalingPath(value) {
  if (!value || typeof value !== "string") return DEFAULT_SIGNALING_PATH;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SIGNALING_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function getSignalingServerHost() {
  return normalizeSignalingHost(process.env.SIGNALING_SERVER_URL);
}

export function getSignalingServerPath() {
  return normalizeSignalingPath(process.env.SIGNALING_SERVER_PATH);
}

export function getSignalingConfigHint() {
  return SIGNALING_CONFIG_HINT;
}

export function isSignalingServerConfigured() {
  return Boolean(getSignalingServerHost());
}

export function isWaitingForHostMessage(message) {
  return (
    typeof message === "string" && message.includes("Waiting for the host")
  );
}

export function isSignalingRetryMessage(message) {
  if (!message) return false;
  return (
    message.includes("Retrying…") ||
    message.includes("Reconnecting…") ||
    message === SIGNALING_ERROR.HOST_ID_RECONNECTING
  );
}

export function isSignalingConfigError(message) {
  if (!message) return false;
  return (
    message.includes(SIGNALING_ERROR.NOT_CONFIGURED) ||
    message.includes(SIGNALING_ERROR.CONFIG_LOAD_FAILED)
  );
}

export function isSignalingServerReachabilityError(message) {
  if (!message) return false;
  return (
    message.includes(SIGNALING_ERROR.HOST_TIMEOUT) ||
    message.includes(SIGNALING_ERROR.HOST_RETRY_EXHAUSTED) ||
    message.includes(SIGNALING_ERROR.PARTICIPANT_TIMEOUT) ||
    message.includes(SIGNALING_ERROR.PARTICIPANT_RETRY_EXHAUSTED) ||
    message.includes("Could not reach the signaling server") ||
    message.includes("Unable to connect to the signaling server") ||
    message.includes("Could not connect to the meeting")
  );
}

export function isFatalSignalingError(message) {
  if (!message) return false;
  if (isWaitingForHostMessage(message)) return false;
  if (isSignalingRetryMessage(message)) return false;
  if (isSignalingConfigError(message)) return true;
  if (isSignalingServerReachabilityError(message)) return true;
  return false;
}

export function getSignalingErrorHint(message, { isHost = false } = {}) {
  if (isSignalingConfigError(message)) {
    return SIGNALING_CONFIG_HINT;
  }
  return isHost
    ? HOST_SIGNING_REACHABILITY_HINT
    : PARTICIPANT_REACHABILITY_HINT;
}

export function hostSignalingTimeoutError() {
  return SIGNALING_ERROR.HOST_TIMEOUT;
}

export function hostSignalingRetryExhaustedError() {
  return SIGNALING_ERROR.HOST_RETRY_EXHAUSTED;
}

export function participantSignalingTimeoutError() {
  return SIGNALING_ERROR.PARTICIPANT_TIMEOUT;
}

export function participantSignalingRetryExhaustedError() {
  return SIGNALING_ERROR.PARTICIPANT_RETRY_EXHAUSTED;
}

export const MAX_SIGNALING_RETRIES = 5;
export const SIGNALING_CONNECT_TIMEOUT_MS = 45000;
export const HOST_ID_RETRY_DELAY_MS = 1500;

function readSignalingPortFromEnv() {
  return Number(process.env.SIGNALING_SERVER_PORT ?? DEFAULT_SIGNALING_PORT);
}

function readSignalingSecureFromEnv() {
  return process.env.SIGNALING_SECURE !== "false";
}

export function buildPeerJsConfig(host = getSignalingServerHost()) {
  return {
    host: host ?? "localhost",
    port: readSignalingPortFromEnv(),
    path: getSignalingServerPath(),
    secure: readSignalingSecureFromEnv(),
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    },
  };
}

export function getPeerJsConfigFromApi(payload) {
  const host = normalizeSignalingHost(payload?.host);
  if (!host) return null;
  return {
    host,
    port: Number(payload?.port ?? DEFAULT_SIGNALING_PORT),
    path: normalizeSignalingPath(payload?.path),
    secure: payload?.secure !== false,
    config: payload?.config ?? undefined,
  };
}

export function hostPeerId(roomId) {
  return `hp-${roomId}`;
}

async function loadPeerModule() {
  const { Peer } = await import("peerjs");
  return Peer;
}

let peerModulePromise = null;

export function loadPeer() {
  if (!peerModulePromise) {
    peerModulePromise = loadPeerModule().catch((error) => {
      peerModulePromise = null;
      throw error;
    });
  }
  return peerModulePromise;
}

export function isRetryablePeerError(error) {
  const type = error?.type ?? "";
  return [
    "network",
    "server-error",
    "socket-error",
    "socket-closed",
    "webrtc",
  ].includes(type);
}

export function peerErrorMessage(error, { isHost = false } = {}) {
  const type = error?.type ?? "unknown";

  if (type === "peer-unavailable" && !isHost) {
    return "[E011] Waiting for the host to join…";
  }

  switch (type) {
    case "network":
    case "socket-error":
    case "socket-closed":
      return "[E008] Could not reach the signaling server. Check your connection and try again.";
    case "server-error":
      return "[E009] The signaling server returned an error. It may be restarting.";
    case "peer-unavailable":
      return "[E010] Waiting for participants…";
    default:
      return "[E012] Signaling connection failed. Retrying…";
  }
}

export function connectionRetryDelayMs(attempt) {
  return Math.min(2000 * 2 ** attempt, 15000);
}

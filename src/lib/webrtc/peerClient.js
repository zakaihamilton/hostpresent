const DEFAULT_SIGNALING_PATH = "/myapp";
const DEFAULT_SIGNALING_PORT = 443;

export { DEFAULT_SIGNALING_PATH };

function normalizeSignalingHost(value) {
  if (!value || typeof value !== "string") return null;
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function normalizeSignalingPath(value) {
  if (!value || typeof value !== "string") return DEFAULT_SIGNALING_PATH;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SIGNALING_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function getSignalingServerHost() {
  return (
    normalizeSignalingHost(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL)
  );
}

export function getSignalingServerPath() {
  return normalizeSignalingPath(
    process.env.NEXT_PUBLIC_SIGNALING_SERVER_PATH ??
      process.env.NEXT_PUBLIC_PEERJS_PATH,
  );
}

export function getSignalingConfigError() {
  if (!isSignalingServerConfigured()) {
    return "Signaling server is not configured.";
  }
  return null;
}

export function getSignalingConfigHint() {
  if (isSignalingServerConfigured()) return null;
  return "Add NEXT_PUBLIC_SIGNALING_SERVER_URL to .env.local (hostname only, no https://). Path defaults to /myapp. Restart npm run dev after changes.";
}

export function isSignalingServerConfigured() {
  return Boolean(getSignalingServerHost());
}

export function isWaitingForHostMessage(message) {
  return typeof message === "string" && message.includes("Waiting for the host");
}

export function isFatalSignalingError(message) {
  if (!message) return false;
  if (isWaitingForHostMessage(message)) return false;
  if (message.includes("Signaling server is not configured")) return true;
  if (message.includes("Could not reach the signaling server")) return true;
  if (message.includes("Unable to connect to the signaling server")) return true;
  if (message.includes("Could not connect to the meeting")) return true;
  return false;
}

export const MAX_SIGNALING_RETRIES = 5;
export const SIGNALING_CONNECT_TIMEOUT_MS = 20000;

export function getPeerJsConfig() {
  const host = getSignalingServerHost();

  if (!host && process.env.NODE_ENV === "development") {
    console.warn(
      "[signaling] NEXT_PUBLIC_SIGNALING_SERVER_URL is not set. WebRTC signaling will fail until configured.",
    );
  }

  const port = Number(
    process.env.NEXT_PUBLIC_SIGNALING_SERVER_PORT ??
    process.env.NEXT_PUBLIC_PEERJS_PORT ??
    DEFAULT_SIGNALING_PORT,
  );
  const path = getSignalingServerPath();
  const secure =
    process.env.NEXT_PUBLIC_SIGNALING_SECURE !== "false" &&
    process.env.NEXT_PUBLIC_PEERJS_SECURE !== "false";

  return {
    host: host ?? "localhost",
    port,
    path,
    secure,
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
    peerModulePromise = loadPeerModule();
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
    return "Waiting for the host to join…";
  }

  switch (type) {
    case "network":
    case "socket-error":
    case "socket-closed":
      return "Could not reach the signaling server. Check your connection and try again.";
    case "server-error":
      return "The signaling server returned an error. It may be restarting.";
    case "peer-unavailable":
      return "Waiting for participants…";
    default:
      return "Signaling connection failed. Retrying…";
  }
}

export function connectionRetryDelayMs(attempt) {
  return Math.min(2000 * 2 ** attempt, 15000);
}

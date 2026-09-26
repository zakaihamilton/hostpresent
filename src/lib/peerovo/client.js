const PEEROVO_API_TIMEOUT_MS = 10_000;
const MAX_TICKET_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const TICKET_EXPIRY_SAFETY_MARGIN_MS = 15_000;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const PEEROVO_SIGNALING_AUTH_MODE = "project-session-peerovo-v1";

export class PeerovoClientError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "PeerovoClientError";
    this.reason = reason;
  }
}

function isLoopbackHostname(hostname) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname.toLowerCase());
}

export function getPeerovoSettings(env = process.env) {
  const rawApiUrl = env.PEEROVO_API_URL?.trim();
  const projectId = env.PEEROVO_PROJECT_ID?.trim();
  const projectApiKey = env.PEEROVO_PROJECT_API_KEY;
  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;

  if (
    !rawApiUrl ||
    !projectId ||
    !PROJECT_ID_PATTERN.test(projectId) ||
    typeof projectApiKey !== "string" ||
    Buffer.byteLength(projectApiKey) < 32 ||
    projectApiKey.trim() !== projectApiKey
  ) {
    return null;
  }

  let apiUrl;
  try {
    apiUrl = new URL(rawApiUrl);
  } catch {
    return null;
  }

  const isLocalHttp =
    apiUrl.protocol === "http:" && isLoopbackHostname(apiUrl.hostname);
  if (
    !["https:", "http:"].includes(apiUrl.protocol) ||
    (apiUrl.protocol !== "https:" &&
      (nodeEnv === "production" || !isLocalHttp)) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.pathname !== "/" ||
    apiUrl.search ||
    apiUrl.hash
  ) {
    return null;
  }

  return {
    apiUrl: apiUrl.origin,
    projectId,
    projectApiKey,
  };
}

function peerovoEndpoint(apiUrl, path) {
  return new URL(path, `${apiUrl}/`).toString();
}

async function requestPeerovo(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PEEROVO_API_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    throw new PeerovoClientError("request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new PeerovoClientError("invalid_response");
  }
}

function isValidPeerJsConfig(config) {
  return (
    config &&
    typeof config.host === "string" &&
    config.host.length > 0 &&
    !config.host.includes("/") &&
    Number.isInteger(config.port) &&
    config.port > 0 &&
    config.port <= 65_535 &&
    typeof config.path === "string" &&
    config.path.startsWith("/") &&
    typeof config.key === "string" &&
    config.key.length > 0 &&
    typeof config.secure === "boolean"
  );
}

export async function fetchPeerovoPublicConfig() {
  const settings = getPeerovoSettings();
  if (!settings) throw new PeerovoClientError("unconfigured");

  const response = await requestPeerovo(
    peerovoEndpoint(settings.apiUrl, "/v1/config"),
  );
  if (!response.ok) throw new PeerovoClientError("config_unavailable");

  const payload = await readJson(response);
  if (
    payload?.signalingAuthMode !== PEEROVO_SIGNALING_AUTH_MODE ||
    !isValidPeerJsConfig(payload.peerJs)
  ) {
    throw new PeerovoClientError("invalid_config");
  }

  return {
    signalingAuthMode: PEEROVO_SIGNALING_AUTH_MODE,
    peerJs: payload.peerJs,
  };
}

export function getPeerovoIceConfigUrl({ sessionId, peerId }) {
  const settings = getPeerovoSettings();
  if (
    !settings ||
    typeof sessionId !== "string" ||
    !RESOURCE_ID_PATTERN.test(sessionId) ||
    typeof peerId !== "string" ||
    !RESOURCE_ID_PATTERN.test(peerId)
  ) {
    return null;
  }

  const path = [
    "v1",
    "projects",
    settings.projectId,
    "sessions",
    sessionId,
    "peers",
    peerId,
    "ice-config",
  ]
    .map(encodeURIComponent)
    .join("/");
  return peerovoEndpoint(settings.apiUrl, `/${path}`);
}

export async function issuePeerovoPeerToken({
  sessionId,
  peerId,
  sessionExpiresAt,
}) {
  const settings = getPeerovoSettings();
  if (!settings) throw new PeerovoClientError("unconfigured");

  if (
    typeof sessionId !== "string" ||
    !RESOURCE_ID_PATTERN.test(sessionId) ||
    typeof peerId !== "string" ||
    !RESOURCE_ID_PATTERN.test(peerId) ||
    typeof sessionExpiresAt !== "number" ||
    !Number.isFinite(sessionExpiresAt)
  ) {
    throw new PeerovoClientError("invalid_ticket_request");
  }

  const expiresInSeconds = Math.min(
    MAX_TICKET_LIFETIME_SECONDS,
    Math.floor(
      (sessionExpiresAt - Date.now() - TICKET_EXPIRY_SAFETY_MARGIN_MS) / 1000,
    ),
  );
  if (expiresInSeconds < 1) {
    throw new PeerovoClientError("session_near_expiry");
  }

  const url = peerovoEndpoint(
    settings.apiUrl,
    `/v1/projects/${encodeURIComponent(settings.projectId)}/sessions/${encodeURIComponent(sessionId)}/peers`,
  );
  const response = await requestPeerovo(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.projectApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ peerId, expiresInSeconds }),
  });
  if (response.status !== 201) {
    throw new PeerovoClientError("ticket_unavailable");
  }

  const payload = await readJson(response);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    payload?.projectId !== settings.projectId ||
    payload?.sessionId !== sessionId ||
    payload?.peerId !== peerId ||
    typeof payload.peerToken !== "string" ||
    payload.peerToken.length === 0 ||
    payload.peerToken.length > 2048 ||
    !Number.isInteger(payload.expiresAt) ||
    payload.expiresAt <= nowSeconds ||
    payload.expiresAt > Math.floor(sessionExpiresAt / 1000)
  ) {
    throw new PeerovoClientError("invalid_ticket_response");
  }

  return { peerToken: payload.peerToken, expiresAt: payload.expiresAt };
}

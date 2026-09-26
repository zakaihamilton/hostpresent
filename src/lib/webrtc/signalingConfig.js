import {
  getPeerJsConfigFromApi,
  REQUIRED_SIGNALING_AUTH_MODE,
} from "./peerClient.js";

const CONFIG_FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      ...options,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchIceServers(peerToken, iceConfigUrl) {
  if (
    typeof peerToken !== "string" ||
    !peerToken ||
    typeof iceConfigUrl !== "string"
  ) {
    throw new Error("Could not load secure streaming configuration.");
  }

  let parsedIceConfigUrl;
  try {
    parsedIceConfigUrl = new URL(iceConfigUrl);
  } catch {
    throw new Error("Could not load secure streaming configuration.");
  }
  if (
    !["https:", "http:"].includes(parsedIceConfigUrl.protocol) ||
    parsedIceConfigUrl.username ||
    parsedIceConfigUrl.password ||
    parsedIceConfigUrl.search ||
    parsedIceConfigUrl.hash ||
    !parsedIceConfigUrl.pathname.endsWith("/ice-config")
  ) {
    throw new Error("Could not load secure streaming configuration.");
  }

  const response = await fetchWithTimeout(parsedIceConfigUrl.toString(), {
    headers: { Authorization: `Bearer ${peerToken}` },
    mode: "cors",
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error("Could not load secure streaming configuration.");
  }

  const data = await response.json();
  if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
    throw new Error("Streaming configuration response was invalid.");
  }

  return data.iceServers;
}

export async function fetchPeerJsConfig() {
  const response = await fetchWithTimeout("/api/rooms/config");
  if (!response.ok) {
    throw new Error("[E082] Could not load signaling configuration.");
  }

  const data = await response.json();
  if (!data.signalingServerConfigured) {
    return null;
  }

  if (data.signalingAuthMode !== REQUIRED_SIGNALING_AUTH_MODE) {
    throw new Error("[E084] Authenticated signaling is not configured.");
  }

  return getPeerJsConfigFromApi(data.peerJs);
}

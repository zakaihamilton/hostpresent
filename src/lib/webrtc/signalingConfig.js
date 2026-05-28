import { getPeerJsConfigFromApi } from "./peerClient.js";

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

export async function fetchIceServers() {
  const response = await fetchWithTimeout("/api/media/ice-config");
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

  return getPeerJsConfigFromApi(data.peerJs);
}

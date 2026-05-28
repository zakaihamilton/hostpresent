import { getPeerJsConfigFromApi } from "./peerClient.js";

const CONFIG_FETCH_TIMEOUT_MS = 10000;

export async function fetchPeerJsConfig() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch("/api/rooms/config", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("[E082] Could not load signaling configuration.");
    }

    const data = await response.json();
    if (!data.signalingServerConfigured) {
      return null;
    }

    return getPeerJsConfigFromApi(data.peerJs);
  } finally {
    clearTimeout(timeout);
  }
}

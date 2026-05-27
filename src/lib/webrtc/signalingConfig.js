import { getPeerJsConfigFromApi } from "./peerClient.js";

export async function fetchPeerJsConfig() {
  const response = await fetch("/api/rooms/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load signaling configuration.");
  }

  const data = await response.json();
  if (!data.signalingServerConfigured) {
    return null;
  }

  return getPeerJsConfigFromApi(data.peerJs);
}

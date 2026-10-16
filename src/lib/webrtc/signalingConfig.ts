import type { PeerJsConfig } from "@/lib/room/roomTypes";
import {
  getPeerJsConfigFromApi,
  REQUIRED_SIGNALING_AUTH_MODE,
} from "./peerClient";

const CONFIG_FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
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

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object") return false;
  const server = value as Record<string, unknown>;
  const validUrls =
    typeof server.urls === "string" ||
    (Array.isArray(server.urls) &&
      server.urls.every((url) => typeof url === "string"));
  return (
    validUrls &&
    (server.username === undefined || typeof server.username === "string") &&
    (server.credential === undefined || typeof server.credential === "string")
  );
}

export async function fetchIceServers(
  peerToken: string,
  iceConfigUrl: string,
): Promise<RTCIceServer[]> {
  if (
    typeof peerToken !== "string" ||
    !peerToken ||
    typeof iceConfigUrl !== "string"
  ) {
    throw new Error("Could not load secure streaming configuration.");
  }

  let parsedIceConfigUrl: URL;
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

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("Streaming configuration response was invalid.");
  }
  const iceServers = (data as Record<string, unknown>).iceServers;
  if (
    !Array.isArray(iceServers) ||
    iceServers.length === 0 ||
    !iceServers.every(isIceServer)
  ) {
    throw new Error("Streaming configuration response was invalid.");
  }

  return iceServers;
}

export async function fetchPeerJsConfig(): Promise<PeerJsConfig | null> {
  const response = await fetchWithTimeout("/api/rooms/config");
  if (!response.ok) {
    throw new Error("[E082] Could not load signaling configuration.");
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("[E082] Could not load signaling configuration.");
  }
  const config = data as Record<string, unknown>;
  if (!config.signalingServerConfigured) {
    return null;
  }

  if (config.signalingAuthMode !== REQUIRED_SIGNALING_AUTH_MODE) {
    throw new Error("[E084] Authenticated signaling is not configured.");
  }

  return getPeerJsConfigFromApi(config.peerJs);
}

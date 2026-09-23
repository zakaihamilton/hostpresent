import { loadEnvConfig } from "@next/env";
import { PeerServer } from "peer";
import { WebSocketServer } from "ws";
import {
  isPeerIdAuthorizedForClaims,
  verifyPeerAuthToken,
} from "../src/lib/room/peerAuthToken.mjs";
import { MAX_PARTICIPANT_CONNECTIONS } from "../src/lib/room/peerLimits.mjs";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

if (!process.env.ROOM_TOKEN_SECRET?.trim()) {
  throw new Error("ROOM_TOKEN_SECRET must be configured for signaling auth.");
}

const port = Number(
  process.env.PORT || process.env.SIGNALING_SERVER_PORT || 9000,
);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT or SIGNALING_SERVER_PORT must be a valid TCP port.");
}

const path = process.env.SIGNALING_SERVER_PATH?.trim() || "/";
const key = process.env.SIGNALING_SERVER_KEY?.trim() || "peerjs";
const host = process.env.SIGNALING_SERVER_HOST?.trim() || "0.0.0.0";
const activeParticipantsByRoom = new Map();

function isRoomSlotAvailable(peerId, claims) {
  if (claims?.role !== "participant") return true;
  const activePeerIds = activeParticipantsByRoom.get(claims.roomId);
  return (
    activePeerIds?.has(peerId) ||
    (activePeerIds?.size ?? 0) < MAX_PARTICIPANT_CONNECTIONS
  );
}

function validateUpgrade(info, callback) {
  try {
    const url = new URL(info.req.url || "/", "http://peerjs.local");
    const peerIds = url.searchParams.getAll("id");
    const tokens = url.searchParams.getAll("token");
    const keys = url.searchParams.getAll("key");
    if (peerIds.length !== 1 || tokens.length !== 1 || keys.length !== 1) {
      callback(false, 403, "Access denied");
      return;
    }
    if (keys[0] !== key) {
      callback(false, 403, "Access denied");
      return;
    }

    // PeerServer reads query parameters with Object.fromEntries(), which takes
    // the last value for duplicate keys. Reject duplicates so the ID checked
    // here is exactly the ID PeerServer registers after the upgrade.
    const [peerId] = peerIds;
    const [token] = tokens;
    const claims = verifyPeerAuthToken(token);
    const allowed =
      isPeerIdAuthorizedForClaims(peerId, claims) &&
      isRoomSlotAvailable(peerId, claims);
    callback(
      allowed,
      allowed ? 200 : 403,
      allowed ? undefined : "Access denied",
    );
  } catch {
    callback(false, 403, "Access denied");
  }
}

const peerServer = PeerServer({
  host,
  port,
  path,
  key,
  proxied: process.env.SIGNALING_SERVER_PROXIED === "true",
  createWebSocketServer: (options) =>
    new WebSocketServer({ ...options, verifyClient: validateUpgrade }),
});

peerServer.on("error", (error) => {
  // PeerJS errors may be caused by untrusted signaling traffic. Keep request
  // URLs and client tokens out of logs.
  console.error("[peer-server] signaling error", error?.message || "unknown");
});

peerServer.on("connection", (client) => {
  const claims = verifyPeerAuthToken(client.getToken());
  if (claims?.role !== "participant") return;

  let activePeerIds = activeParticipantsByRoom.get(claims.roomId);
  if (!activePeerIds) {
    activePeerIds = new Set();
    activeParticipantsByRoom.set(claims.roomId, activePeerIds);
  }

  const peerId = client.getId();
  if (
    !activePeerIds.has(peerId) &&
    activePeerIds.size >= MAX_PARTICIPANT_CONNECTIONS
  ) {
    client.getSocket()?.close(1013, "Room is full");
    return;
  }

  activePeerIds.add(peerId);
});

peerServer.on("disconnect", (client) => {
  const claims = verifyPeerAuthToken(client.getToken());
  if (claims?.role !== "participant") return;

  const activePeerIds = activeParticipantsByRoom.get(claims.roomId);
  if (!activePeerIds) return;

  activePeerIds.delete(client.getId());
  if (activePeerIds.size === 0) {
    activeParticipantsByRoom.delete(claims.roomId);
  }
});

console.log(
  `[peer-server] authenticated signaling server listening on ${host}:${port}${path}`,
);

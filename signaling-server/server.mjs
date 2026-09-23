import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PeerServer } from "peer";
import { WebSocketServer } from "ws";
import {
  isPeerIdAuthorizedForClaims,
  verifyPeerAuthToken,
} from "../src/lib/room/peerAuthToken.mjs";
import {
  createParticipantCapacityStore,
  PARTICIPANT_CAPACITY_RENEW_INTERVAL_MS,
} from "./participantCapacity.mjs";

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
const participantCapacity = createParticipantCapacityStore();
const activeParticipantClientsByRoom = new Map();

async function validatePeerUpgrade(info) {
  const url = new URL(info.req.url || "/", "http://peerjs.local");
  const peerIds = url.searchParams.getAll("id");
  const tokens = url.searchParams.getAll("token");
  const keys = url.searchParams.getAll("key");
  if (peerIds.length !== 1 || tokens.length !== 1 || keys.length !== 1) {
    return { allowed: false, statusCode: 403, message: "Access denied" };
  }
  if (keys[0] !== key) {
    return { allowed: false, statusCode: 403, message: "Access denied" };
  }

  // PeerServer reads query parameters with Object.fromEntries(), which takes
  // the last value for duplicate keys. Reject duplicates so the ID checked
  // here is exactly the ID PeerServer registers after the upgrade.
  const [peerId] = peerIds;
  const [token] = tokens;
  const claims = verifyPeerAuthToken(token);
  if (!isPeerIdAuthorizedForClaims(peerId, claims)) {
    return { allowed: false, statusCode: 403, message: "Access denied" };
  }

  if (claims.role === "participant") {
    const ownerId = randomUUID();
    let admitted;
    try {
      admitted = await participantCapacity.acquire(
        claims.roomId,
        peerId,
        ownerId,
      );
    } catch {
      return {
        allowed: false,
        statusCode: 503,
        message: "Room admission is unavailable",
      };
    }
    if (!admitted) {
      return { allowed: false, statusCode: 429, message: "Room is full" };
    }
    info.req.hostpresentParticipantOwnerId = ownerId;
  }

  return { allowed: true, statusCode: 200 };
}

function validateUpgrade(info, callback) {
  validatePeerUpgrade(info).then(
    ({ allowed, statusCode, message }) => {
      callback(allowed, statusCode, message);
    },
    () => callback(false, 503, "Room admission is unavailable"),
  );
}

const peerServer = PeerServer({
  host,
  port,
  path,
  key,
  proxied: process.env.SIGNALING_SERVER_PROXIED === "true",
  createWebSocketServer: (options) => {
    const webSocketServer = new WebSocketServer({
      ...options,
      verifyClient: validateUpgrade,
    });
    webSocketServer.on("connection", (socket, request) => {
      socket.hostpresentParticipantOwnerId =
        request.hostpresentParticipantOwnerId;
    });
    return webSocketServer;
  },
});

peerServer.on("error", (error) => {
  // PeerJS errors may be caused by untrusted signaling traffic. Keep request
  // URLs and client tokens out of logs.
  console.error("[peer-server] signaling error", error?.message || "unknown");
});

peerServer.on("connection", (client) => {
  const claims = verifyPeerAuthToken(client.getToken());
  if (claims?.role !== "participant") return;
  const ownerId = client.getSocket()?.hostpresentParticipantOwnerId;
  if (!ownerId) {
    client.getSocket()?.close(1011, "Room admission lease is missing");
    return;
  }

  let activeClients = activeParticipantClientsByRoom.get(claims.roomId);
  if (!activeClients) {
    activeClients = new Map();
    activeParticipantClientsByRoom.set(claims.roomId, activeClients);
  }

  const previousEntry = activeClients.get(client.getId());
  const activeEntry = { client, ownerId, renewalFailures: 0 };
  activeClients.set(client.getId(), activeEntry);
  if (previousEntry) {
    void participantCapacity
      .release(claims.roomId, client.getId(), previousEntry.ownerId)
      .catch(() => {});
  }
});

peerServer.on("disconnect", (client) => {
  const claims = verifyPeerAuthToken(client.getToken());
  if (claims?.role !== "participant") return;

  const activeClients = activeParticipantClientsByRoom.get(claims.roomId);
  const activeEntry = activeClients?.get(client.getId());
  const ownerId = client.getSocket()?.hostpresentParticipantOwnerId;
  if (activeEntry?.client === client && activeEntry.ownerId === ownerId) {
    activeClients.delete(client.getId());
    if (activeClients.size === 0) {
      activeParticipantClientsByRoom.delete(claims.roomId);
    }
    void participantCapacity
      .release(claims.roomId, client.getId(), ownerId)
      .catch(() => {});
  }
});

let participantRenewalInFlight = false;

async function renewParticipantSlots() {
  if (participantRenewalInFlight) return;
  participantRenewalInFlight = true;
  try {
    await Promise.all(
      [...activeParticipantClientsByRoom].map(
        async ([roomId, activeClients]) => {
          const owners = [...activeClients].map(([peerId, entry]) => ({
            peerId,
            ownerId: entry.ownerId,
          }));
          let renewedOwnerIds;
          try {
            renewedOwnerIds = new Set(
              await participantCapacity.renew(roomId, owners),
            );
          } catch {
            for (const [peerId, activeEntry] of activeClients) {
              if (activeClients.get(peerId) !== activeEntry) continue;
              const nextFailures = activeEntry.renewalFailures + 1;
              activeEntry.renewalFailures = nextFailures;
              if (nextFailures >= 2) {
                activeEntry.client
                  .getSocket()
                  ?.close(1013, "Room admission unavailable");
              }
            }
            return;
          }

          for (const [peerId, activeEntry] of activeClients) {
            if (activeClients.get(peerId) !== activeEntry) continue;
            if (!renewedOwnerIds.has(activeEntry.ownerId)) {
              activeEntry.client
                .getSocket()
                ?.close(1013, "Room admission lease expired");
              continue;
            }
            activeEntry.renewalFailures = 0;
          }
        },
      ),
    );
  } finally {
    participantRenewalInFlight = false;
  }
}

const participantRenewalTimer = setInterval(
  () => void renewParticipantSlots(),
  PARTICIPANT_CAPACITY_RENEW_INTERVAL_MS,
);
participantRenewalTimer.unref?.();

console.log(
  `[peer-server] authenticated signaling server listening on ${host}:${port}${path}`,
);

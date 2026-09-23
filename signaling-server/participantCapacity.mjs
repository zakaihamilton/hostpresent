import { MAX_PARTICIPANT_CONNECTIONS } from "../src/lib/room/peerLimits.mjs";

export const PARTICIPANT_CAPACITY_LEASE_MS = 30_000;
export const PARTICIPANT_CAPACITY_RENEW_INTERVAL_MS = 8_000;

// PeerJS keeps its own registry in process memory, so signaling must run as a
// single Railway replica. Leases reserve capacity during WebSocket upgrades
// and expire if an upgrade fails before PeerServer emits a connection event.
export function createParticipantCapacityStore() {
  const peersByRoom = new Map();

  function getActivePeers(roomId, now) {
    const peers = peersByRoom.get(roomId);
    if (!peers) return null;

    for (const [ownerMember, entry] of peers) {
      if (entry.expiresAt <= now) peers.delete(ownerMember);
    }
    if (peers.size === 0) {
      peersByRoom.delete(roomId);
      return null;
    }
    return peers;
  }

  return {
    async acquire(roomId, peerId, ownerId) {
      const now = Date.now();
      const peers = getActivePeers(roomId, now) ?? new Map();
      const ownerMember = `${peerId}|${ownerId}`;
      const hasPeer = [...peers.values()].some(
        (entry) => entry.peerId === peerId,
      );
      if (
        !peers.has(ownerMember) &&
        !hasPeer &&
        new Set([...peers.values()].map((entry) => entry.peerId)).size >=
          MAX_PARTICIPANT_CONNECTIONS
      ) {
        return false;
      }
      peers.set(ownerMember, {
        peerId,
        expiresAt: now + PARTICIPANT_CAPACITY_LEASE_MS,
      });
      peersByRoom.set(roomId, peers);
      return true;
    },

    async renew(roomId, owners) {
      const now = Date.now();
      const peers = getActivePeers(roomId, now);
      if (!peers) return [];

      const renewed = [];
      for (const { peerId, ownerId } of owners) {
        const ownerMember = `${peerId}|${ownerId}`;
        const entry = peers.get(ownerMember);
        if (!entry) continue;
        peers.set(ownerMember, {
          ...entry,
          expiresAt: now + PARTICIPANT_CAPACITY_LEASE_MS,
        });
        renewed.push(ownerId);
      }
      return renewed;
    },

    async release(roomId, peerId, ownerId) {
      const peers = getActivePeers(roomId, Date.now());
      if (!peers) return;
      peers.delete(`${peerId}|${ownerId}`);
      if (peers.size === 0) peersByRoom.delete(roomId);
    },
  };
}

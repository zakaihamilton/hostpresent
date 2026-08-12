import { formatJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { createRecentRoomStore } from "@/lib/settings/recentRoomStore";

const STORAGE_KEY = "hostpresent.participantRooms.v2";

const store = createRecentRoomStore({
  storageKey: STORAGE_KEY,
  activeTokenKey: "activeParticipantToken",
  maxRooms: 10,
});

function readRaw() {
  return store.readRaw();
}

function writeRaw(settings) {
  return store.writeRaw(settings);
}

function getRecentTime(room) {
  return room.lastJoinedAt ?? room.createdAt ?? 0;
}

function sortByRecent(a, b) {
  return getRecentTime(b) - getRecentTime(a);
}

function trimRecentRooms(rooms) {
  return store.trimRecentRooms(rooms, getRecentTime);
}

export function listParticipantRooms() {
  return trimRecentRooms(readRaw().rooms);
}


export function saveParticipantRoom({ roomId, participantToken, joinCode }) {
  if (!participantToken) return;

  const current = readRaw();
  const now = Date.now();
  const normalizedJoinCode = normalizeJoinCode(joinCode ?? "");

  const existingByToken = current.rooms.find(
    (room) => room.participantToken === participantToken,
  );
  const existingByJoinCode = normalizedJoinCode
    ? current.rooms.find(
        (room) => normalizeJoinCode(room.joinCode ?? "") === normalizedJoinCode,
      )
    : null;
  const existing = existingByToken ?? existingByJoinCode;

  const nextEntry = {
    roomId: roomId ?? null,
    participantToken,
    joinCode: joinCode ?? null,
    createdAt: existing?.createdAt ?? now,
    lastJoinedAt: now,
  };

  const nextRooms = trimRecentRooms([
    ...current.rooms.filter((room) => {
      if (room.participantToken === participantToken) return false;
      if (
        normalizedJoinCode &&
        normalizeJoinCode(room.joinCode ?? "") === normalizedJoinCode
      ) {
        return false;
      }
      return true;
    }),
    nextEntry,
  ]);

  writeRaw({
    activeParticipantToken: participantToken,
    rooms: nextRooms,
  });
}

export function touchParticipantRoom(participantToken) {
  const current = readRaw();
  const now = Date.now();
  const nextRooms = trimRecentRooms(
    current.rooms.map((room) =>
      room.participantToken === participantToken
        ? { ...room, lastJoinedAt: now }
        : room,
    ),
  );

  writeRaw({
    ...current,
    activeParticipantToken: participantToken,
    rooms: nextRooms,
  });
}

export function getActiveParticipantRoom() {
  const current = readRaw();
  if (!current.activeParticipantToken) return null;
  return (
    current.rooms.find(
      (room) => room.participantToken === current.activeParticipantToken,
    ) ?? null
  );
}

export function getParticipantRoomByToken(participantToken) {
  const current = readRaw();
  return (
    current.rooms.find((room) => room.participantToken === participantToken) ??
    null
  );
}

export function getParticipantRoomByJoinCode(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  if (!normalized) return null;
  const matches = readRaw().rooms.filter(
    (room) => normalizeJoinCode(room.joinCode ?? "") === normalized,
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return [...matches].sort(sortByRecent)[0];
}

export function removeParticipantRoomByToken(participantToken) {
  if (!participantToken) return;
  const current = readRaw();
  const nextRooms = current.rooms.filter(
    (room) => room.participantToken !== participantToken,
  );
  if (nextRooms.length === current.rooms.length) return;
  writeRaw({
    activeParticipantToken:
      current.activeParticipantToken === participantToken
        ? null
        : current.activeParticipantToken,
    rooms: nextRooms,
  });
}

export function clearParticipantRooms() {
  writeRaw({ activeParticipantToken: null, rooms: [] });
}

export function formatParticipantRoomLabel(room) {
  if (room?.joinCode) {
    return formatJoinCode(room.joinCode);
  }
  const timestamp = room?.lastJoinedAt ?? room?.createdAt;
  if (!timestamp) return "Past room";
  const date = new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Joined · ${date}`;
}

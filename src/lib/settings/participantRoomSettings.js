import { formatJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { dedupeRoomsByJoinCode } from "@/lib/settings/recentRoomDedup";

const STORAGE_KEY = "hostpresent.participantRooms";
const MAX_RECENT_ROOMS = 10;

const EMPTY_SETTINGS = {
  activeParticipantToken: null,
  rooms: [],
};

function readRaw() {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      activeParticipantToken: parsed.activeParticipantToken ?? null,
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

function writeRaw(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
}

function sortByRecent(a, b) {
  const aTime = a.lastJoinedAt ?? a.createdAt ?? 0;
  const bTime = b.lastJoinedAt ?? b.createdAt ?? 0;
  return bTime - aTime;
}

function getRecentTime(room) {
  return room.lastJoinedAt ?? room.createdAt ?? 0;
}

function trimRecentRooms(rooms) {
  let nextRooms = dedupeRoomsByJoinCode(rooms, getRecentTime).sort(
    sortByRecent,
  );
  if (nextRooms.length > MAX_RECENT_ROOMS) {
    nextRooms = nextRooms.slice(0, MAX_RECENT_ROOMS);
  }
  return nextRooms;
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
    return `Code ${formatJoinCode(room.joinCode)}`;
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

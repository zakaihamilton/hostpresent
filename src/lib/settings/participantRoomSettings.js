import { formatJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";

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

export function listParticipantRooms() {
  return [...readRaw().rooms].sort(sortByRecent);
}

export function saveParticipantRoom({ roomId, participantToken, joinCode }) {
  if (!participantToken) return;

  const current = readRaw();
  const now = Date.now();
  const existingIndex = current.rooms.findIndex(
    (room) => room.participantToken === participantToken,
  );

  const nextEntry = {
    roomId: roomId ?? null,
    participantToken,
    joinCode: joinCode ?? null,
    createdAt:
      existingIndex >= 0 ? current.rooms[existingIndex].createdAt : now,
    lastJoinedAt: now,
  };

  let nextRooms;
  if (existingIndex >= 0) {
    nextRooms = current.rooms.map((room, index) =>
      index === existingIndex ? { ...room, ...nextEntry } : room,
    );
  } else {
    nextRooms = [...current.rooms, nextEntry];
  }

  nextRooms.sort(sortByRecent);
  if (nextRooms.length > MAX_RECENT_ROOMS) {
    nextRooms = nextRooms.slice(0, MAX_RECENT_ROOMS);
  }

  writeRaw({
    activeParticipantToken: participantToken,
    rooms: nextRooms,
  });
}

export function touchParticipantRoom(participantToken) {
  const current = readRaw();
  const now = Date.now();
  const nextRooms = current.rooms
    .map((room) =>
      room.participantToken === participantToken
        ? { ...room, lastJoinedAt: now }
        : room,
    )
    .sort(sortByRecent);

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
  const current = readRaw();
  return (
    current.rooms.find(
      (room) => normalizeJoinCode(room.joinCode ?? "") === normalized,
    ) ?? null
  );
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

import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { dedupeRoomsByJoinCode } from "@/lib/settings/recentRoomDedup";

const STORAGE_KEY = "hostpresent.rooms";
const MAX_RECENT_ROOMS = 10;

const EMPTY_SETTINGS = {
  activeHostToken: null,
  rooms: [],
};

function readRaw() {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      activeHostToken: parsed.activeHostToken ?? null,
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
  const aTime = a.lastUsedAt ?? a.createdAt ?? 0;
  const bTime = b.lastUsedAt ?? b.createdAt ?? 0;
  return bTime - aTime;
}

function getRecentTime(room) {
  return room.lastUsedAt ?? room.createdAt ?? 0;
}

function trimRecentRooms(rooms) {
  let nextRooms = dedupeRoomsByJoinCode(rooms, getRecentTime).sort(sortByRecent);
  if (nextRooms.length > MAX_RECENT_ROOMS) {
    nextRooms = nextRooms.slice(0, MAX_RECENT_ROOMS);
  }
  return nextRooms;
}

export function loadRoomSettings() {
  return readRaw();
}

export function listHostRooms() {
  return trimRecentRooms(readRaw().rooms);
}

export function saveRoom(settings) {
  const current = readRaw();
  const now = Date.now();
  const normalizedJoinCode = normalizeJoinCode(settings.joinCode ?? "");

  const existingByToken = current.rooms.find(
    (room) => room.hostToken === settings.hostToken,
  );
  const existingByJoinCode =
    normalizedJoinCode
      ? current.rooms.find(
          (room) =>
            normalizeJoinCode(room.joinCode ?? "") === normalizedJoinCode,
        )
      : null;
  const existing = existingByToken ?? existingByJoinCode;

  const nextEntry = {
    roomId: settings.roomId,
    hostToken: settings.hostToken,
    participantToken: settings.participantToken,
    joinCode: settings.joinCode ?? null,
    createdAt: existing?.createdAt ?? settings.createdAt ?? now,
    lastUsedAt: now,
  };

  const nextRooms = trimRecentRooms([
    ...current.rooms.filter((room) => {
      if (room.hostToken === settings.hostToken) return false;
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
    activeHostToken: settings.hostToken,
    rooms: nextRooms,
  });
}

export function touchHostRoom(hostToken) {
  const current = readRaw();
  const now = Date.now();
  const nextRooms = trimRecentRooms(
    current.rooms.map((room) =>
      room.hostToken === hostToken ? { ...room, lastUsedAt: now } : room,
    ),
  );

  writeRaw({
    ...current,
    activeHostToken: hostToken,
    rooms: nextRooms,
  });
}

export function setActiveHostToken(hostToken) {
  const current = readRaw();
  writeRaw({ ...current, activeHostToken: hostToken });
}

export function getActiveRoom() {
  const current = readRaw();
  if (!current.activeHostToken) return null;
  return (
    current.rooms.find((room) => room.hostToken === current.activeHostToken) ??
    null
  );
}

export function getRoomByHostToken(hostToken) {
  const current = readRaw();
  return current.rooms.find((room) => room.hostToken === hostToken) ?? null;
}

export function getRoomByJoinCode(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  if (!normalized) return null;
  const matches = readRaw().rooms.filter(
    (room) => normalizeJoinCode(room.joinCode ?? "") === normalized,
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return [...matches].sort(sortByRecent)[0];
}

export function removeHostRoomByToken(hostToken) {
  if (!hostToken) return;
  const current = readRaw();
  const nextRooms = current.rooms.filter((room) => room.hostToken !== hostToken);
  if (nextRooms.length === current.rooms.length) return;
  writeRaw({
    activeHostToken:
      current.activeHostToken === hostToken ? null : current.activeHostToken,
    rooms: nextRooms,
  });
}

export function clearActiveRoom() {
  const current = readRaw();
  writeRaw({ ...current, activeHostToken: null });
}

export function clearHostRooms() {
  writeRaw({ activeHostToken: null, rooms: [] });
}

export function formatRoomLabel(room, { prefix = "Room" } = {}) {
  const timestamp = room?.lastUsedAt ?? room?.createdAt;
  if (!timestamp) return prefix;
  const date = new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${prefix} · ${date}`;
}

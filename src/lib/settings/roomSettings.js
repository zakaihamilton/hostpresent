import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";

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

export function loadRoomSettings() {
  return readRaw();
}

export function listHostRooms() {
  return [...readRaw().rooms].sort(sortByRecent);
}

export function saveRoom(settings) {
  const current = readRaw();
  const now = Date.now();
  const existingIndex = current.rooms.findIndex(
    (room) => room.hostToken === settings.hostToken,
  );

  const nextEntry = {
    roomId: settings.roomId,
    hostToken: settings.hostToken,
    participantToken: settings.participantToken,
    joinCode: settings.joinCode ?? null,
    createdAt: settings.createdAt ?? now,
    lastUsedAt: now,
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
    activeHostToken: settings.hostToken,
    rooms: nextRooms,
  });
}

export function touchHostRoom(hostToken) {
  const current = readRaw();
  const now = Date.now();
  const nextRooms = current.rooms
    .map((room) =>
      room.hostToken === hostToken ? { ...room, lastUsedAt: now } : room,
    )
    .sort(sortByRecent);

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
  const current = readRaw();
  return (
    current.rooms.find(
      (room) => normalizeJoinCode(room.joinCode ?? "") === normalized,
    ) ?? null
  );
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

import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { createRecentRoomStore } from "@/lib/settings/recentRoomStore";

// Version the storage key so tokens signed with the retired public secret are
// never reused after the stateless credential cutover.
const STORAGE_KEY = "hostpresent.rooms.v2";

const store = createRecentRoomStore({
  storageKey: STORAGE_KEY,
  activeTokenKey: "activeHostToken",
  maxRooms: 10,
});

function readRaw() {
  return store.readRaw();
}

function writeRaw(settings) {
  return store.writeRaw(settings);
}

function getRecentTime(room) {
  return room.lastUsedAt ?? room.createdAt ?? 0;
}

function sortByRecent(a, b) {
  return getRecentTime(b) - getRecentTime(a);
}

function trimRecentRooms(rooms) {
  return store.trimRecentRooms(rooms, getRecentTime);
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
  const existingByJoinCode = normalizedJoinCode
    ? current.rooms.find(
        (room) => normalizeJoinCode(room.joinCode ?? "") === normalizedJoinCode,
      )
    : null;
  const existing = existingByToken ?? existingByJoinCode;

  const nextEntry = {
    roomId: settings.roomId,
    hostToken: settings.hostToken,
    joinCode: settings.joinCode ?? null,
    title: settings.title ?? existing?.title ?? "",
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

export function getRoomTitleByHostToken(hostToken) {
  if (!hostToken) return "";
  const current = readRaw();
  const room = current.rooms.find((r) => r.hostToken === hostToken);
  return room?.title ?? "";
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
  const nextRooms = current.rooms.filter(
    (room) => room.hostToken !== hostToken,
  );
  if (nextRooms.length === current.rooms.length) return;
  writeRaw({
    activeHostToken:
      current.activeHostToken === hostToken ? null : current.activeHostToken,
    rooms: nextRooms,
  });
}

export function updateRoomTitle(hostToken, title) {
  if (!hostToken) return;
  const current = readRaw();
  const nextRooms = current.rooms.map((room) =>
    room.hostToken === hostToken ? { ...room, title: title ?? "" } : room,
  );
  writeRaw({ ...current, rooms: nextRooms });
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

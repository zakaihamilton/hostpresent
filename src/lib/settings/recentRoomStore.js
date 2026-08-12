import { dedupeRoomsByJoinCode } from "@/lib/settings/recentRoomDedup";

export function createRecentRoomStore({ storageKey, activeTokenKey, maxRooms = 10 }) {
  const emptySettings = {
    [activeTokenKey]: null,
    rooms: [],
  };

  function readRaw() {
    if (typeof window === "undefined") return emptySettings;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return emptySettings;
      const parsed = JSON.parse(raw);
      return {
        [activeTokenKey]: parsed[activeTokenKey] ?? null,
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      };
    } catch {
      return emptySettings;
    }
  }

  function writeRaw(settings) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // ignore storage failures
    }
  }

  function sortByRecent(getRecentTime) {
    return (a, b) => getRecentTime(b) - getRecentTime(a);
  }

  function trimRecentRooms(rooms, getRecentTime) {
    let nextRooms = dedupeRoomsByJoinCode(rooms, getRecentTime).sort(
      sortByRecent(getRecentTime),
    );
    if (nextRooms.length > maxRooms) {
      nextRooms = nextRooms.slice(0, maxRooms);
    }
    return nextRooms;
  }

  return {
    readRaw,
    writeRaw,
    trimRecentRooms,
    sortByRecent,
  };
}

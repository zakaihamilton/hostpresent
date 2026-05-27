import { createJoinCode, normalizeJoinCode } from "./joinCode.js";
import { publishToRoom } from "./pubsub.js";
import { ROOM_ROLE, signRoomToken } from "./tokens.js";

const GLOBAL_STORE_KEY = "__hostpresentRoomStore";
export const ROOM_STATUS = {
  WAITING: "waiting",
  OPEN: "open",
};

function getMemoryStore() {
  let store = globalThis[GLOBAL_STORE_KEY];
  if (!store || typeof store !== "object") {
    store = { rooms: new Map(), joinCodes: new Map() };
    globalThis[GLOBAL_STORE_KEY] = store;
  }
  if (!(store.rooms instanceof Map)) {
    store.rooms = new Map();
  }
  if (!(store.joinCodes instanceof Map)) {
    store.joinCodes = new Map();
  }
  return store;
}

function roomKey(roomId) {
  return `room:${roomId}`;
}

function joinCodeKey(joinCode) {
  return `join:${joinCode}`;
}

async function getKvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }

  try {
    const { kv } = await import("@vercel/kv");
    if (typeof kv?.get !== "function" || typeof kv?.set !== "function") {
      return null;
    }
    return kv;
  } catch (error) {
    console.warn("[room store] KV client unavailable, using memory", error);
    return null;
  }
}

async function readRoom(roomId) {
  const kv = await getKvClient();
  if (kv) {
    try {
      const room = await kv.get(roomKey(roomId));
      if (room) return room;
    } catch (error) {
      console.warn("[room store] KV read failed, using memory", error);
    }
  }
  return getMemoryStore().rooms.get(roomId) ?? null;
}

async function writeRoom(roomId, room) {
  const store = getMemoryStore();
  const canonicalJoinCode = room.joinCode
    ? normalizeJoinCode(room.joinCode)
    : null;
  const nextRoom = canonicalJoinCode
    ? { ...room, joinCode: canonicalJoinCode }
    : room;

  store.rooms.set(roomId, nextRoom);
  if (canonicalJoinCode) {
    store.joinCodes.set(canonicalJoinCode, roomId);
  }

  const kv = await getKvClient();
  if (!kv) return;

  try {
    await kv.set(roomKey(roomId), nextRoom);
    if (canonicalJoinCode) {
      await kv.set(joinCodeKey(canonicalJoinCode), roomId);
    }
  } catch (error) {
    console.warn("[room store] KV write failed, kept in memory only", error);
  }
}

async function readRoomIdByJoinCode(joinCode) {
  const canonical = normalizeJoinCode(joinCode);
  if (!canonical) return null;

  const kv = await getKvClient();
  if (kv) {
    try {
      const roomId = await kv.get(joinCodeKey(canonical));
      if (roomId) return roomId;
    } catch (error) {
      console.warn(
        "[room store] KV join-code lookup failed, using memory",
        error,
      );
    }
  }
  return getMemoryStore().joinCodes.get(canonical) ?? null;
}

async function ensureJoinCode(room) {
  if (room.joinCode) return room;

  const joinCode = createJoinCode();
  const nextRoom = { ...room, joinCode };
  await writeRoom(room.roomId, nextRoom);
  return nextRoom;
}

export async function createRoomRecord({
  roomId,
  hostToken,
  participantToken,
}) {
  const joinCode = createJoinCode();
  const room = {
    roomId,
    hostToken,
    participantToken,
    joinCode,
    status: ROOM_STATUS.WAITING,
    createdAt: Date.now(),
    openedAt: null,
  };
  await writeRoom(roomId, room);
  return room;
}

export async function getRoomById(roomId) {
  const room = await readRoom(roomId);
  if (!room) return null;
  return ensureJoinCode(room);
}

export async function restoreRoomFromToken({ roomId, role, token }) {
  const room = {
    roomId,
    hostToken:
      role === ROOM_ROLE.HOST
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.HOST }),
    participantToken:
      role === ROOM_ROLE.PARTICIPANT
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.PARTICIPANT }),
    joinCode: createJoinCode(),
    status: ROOM_STATUS.WAITING,
    createdAt: Date.now(),
    openedAt: null,
  };
  await writeRoom(roomId, room);
  return room;
}

export async function getRoomByJoinCode(joinCode) {
  const roomId = await readRoomIdByJoinCode(joinCode);
  if (!roomId) return null;
  return getRoomById(roomId);
}

export async function openRoom(roomId) {
  const room = await readRoom(roomId);
  if (!room) return null;

  const withCode = await ensureJoinCode(room);
  const nextRoom = {
    ...withCode,
    status: ROOM_STATUS.OPEN,
    openedAt: Date.now(),
  };
  await writeRoom(roomId, nextRoom);
  publishToRoom(roomId, { type: "room_opened", roomId });
  return nextRoom;
}

export async function relayRoomMessage(roomId, message) {
  publishToRoom(roomId, { type: "signaling", message });
}

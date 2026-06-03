import { normalizeJoinCode } from "./joinCode.js";
import { deriveRoomIdFromJoinCode } from "./roomIdentity.js";
import { ROOM_ROLE, signRoomToken, verifyRoomToken } from "./tokens.js";

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

function buildRoomRecord({ roomId, joinCode, createdAt = null }) {
  const normalizedJoinCode = normalizeJoinCode(joinCode);
  const hostToken = signRoomToken({
    roomId,
    role: ROOM_ROLE.HOST,
    joinCode: normalizedJoinCode,
  });
  const participantToken = signRoomToken({
    roomId,
    role: ROOM_ROLE.PARTICIPANT,
    joinCode: normalizedJoinCode,
  });

  return {
    roomId,
    joinCode: normalizedJoinCode,
    hostToken,
    participantToken,
    status: ROOM_STATUS.OPEN,
    openedAt: createdAt,
    createdAt,
  };
}

function rememberRoom(room) {
  const store = getMemoryStore();
  store.rooms.set(room.roomId, room);
  if (room.joinCode) {
    store.joinCodes.set(room.joinCode, room.roomId);
  }
}

export async function createRoomRecord({
  roomId,
  joinCode,
  hostToken,
  participantToken,
}) {
  const room = {
    roomId,
    joinCode: normalizeJoinCode(joinCode),
    hostToken,
    participantToken,
    status: ROOM_STATUS.OPEN,
    createdAt: Date.now(),
    openedAt: Date.now(),
  };
  rememberRoom(room);
  return room;
}

export async function getRoomById(roomId, { joinCode = null } = {}) {
  const memory = getMemoryStore().rooms.get(roomId);
  const resolvedJoinCode = joinCode ?? memory?.joinCode ?? null;

  if (memory) {
    return { ...memory, status: ROOM_STATUS.OPEN };
  }

  if (!resolvedJoinCode) {
    return null;
  }

  return buildRoomRecord({
    roomId,
    joinCode: resolvedJoinCode,
    createdAt: null,
  });
}

export async function restoreRoomFromToken({ roomId, role, token }) {
  const verified = verifyRoomToken(token);
  const joinCode = verified?.joinCode ?? null;

  if (joinCode) {
    const derivedRoomId = deriveRoomIdFromJoinCode(joinCode);
    if (derivedRoomId === roomId) {
      const memory = getMemoryStore().rooms.get(roomId);
      if (memory) return { ...memory, status: ROOM_STATUS.OPEN };

      return buildRoomRecord({
        roomId,
        joinCode,
        createdAt: Date.now(),
      });
    }
  }

  const room = {
    roomId,
    joinCode,
    hostToken:
      role === ROOM_ROLE.HOST
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.HOST, joinCode }),
    participantToken:
      role === ROOM_ROLE.PARTICIPANT
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.PARTICIPANT, joinCode }),
    status: ROOM_STATUS.OPEN,
    createdAt: Date.now(),
    openedAt: Date.now(),
  };
  rememberRoom(room);
  return room;
}

export async function getRoomByJoinCode(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  if (!normalized) return null;

  const roomId = deriveRoomIdFromJoinCode(normalized);
  const memory = getMemoryStore().rooms.get(roomId);
  if (memory) {
    return { ...memory, status: ROOM_STATUS.OPEN };
  }

  return buildRoomRecord({
    roomId,
    joinCode: normalized,
    createdAt: null,
  });
}

export async function openRoom(roomId, { joinCode = null } = {}) {
  const memory = getMemoryStore().rooms.get(roomId);
  const normalizedJoinCode = normalizeJoinCode(
    joinCode ?? memory?.joinCode ?? "",
  );
  const openedAt = Date.now();

  const nextRoom = {
    ...(memory ?? {
      roomId,
      joinCode: normalizedJoinCode || null,
      hostToken: signRoomToken({
        roomId,
        role: ROOM_ROLE.HOST,
        joinCode: normalizedJoinCode || null,
      }),
      participantToken: signRoomToken({
        roomId,
        role: ROOM_ROLE.PARTICIPANT,
        joinCode: normalizedJoinCode || null,
      }),
      createdAt: openedAt,
    }),
    status: ROOM_STATUS.OPEN,
    openedAt,
    joinCode: normalizedJoinCode || memory?.joinCode || null,
  };

  rememberRoom(nextRoom);
  return nextRoom;
}

export async function relayRoomMessage(_roomId, _message) {
  // Application signaling is relayed over WebRTC data channels.
}

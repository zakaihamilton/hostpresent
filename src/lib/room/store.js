import { createJoinCode, normalizeJoinCode } from "./joinCode.js";
import { publishToRoom } from "./pubsub.js";
import {
  ROOM_ROLE,
  signRoomOpenProof,
  signRoomToken,
  verifyRoomOpenProof,
  verifyRoomToken,
} from "./tokens.js";
import { deriveRoomIdFromJoinCode } from "./roomIdentity.js";

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

function resolveRoomStatus({ roomId, joinCode, openProof }) {
  if (openProof) {
    const verified = verifyRoomOpenProof(openProof, { roomId, joinCode });
    if (verified) {
      return {
        status: ROOM_STATUS.OPEN,
        openedAt: verified.openedAt,
      };
    }
  }

  const memory = getMemoryStore().rooms.get(roomId);
  if (memory?.status === ROOM_STATUS.OPEN) {
    return {
      status: ROOM_STATUS.OPEN,
      openedAt: memory.openedAt ?? null,
    };
  }

  return {
    status: ROOM_STATUS.WAITING,
    openedAt: null,
  };
}

function buildRoomRecord({ roomId, joinCode, status, openedAt, createdAt }) {
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
    status,
    openedAt,
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
    status: ROOM_STATUS.WAITING,
    createdAt: Date.now(),
    openedAt: null,
  };
  rememberRoom(room);
  return room;
}

export async function getRoomById(roomId, { openProof = null, joinCode = null } = {}) {
  const memory = getMemoryStore().rooms.get(roomId);
  const resolvedJoinCode = joinCode ?? memory?.joinCode ?? null;
  const { status, openedAt } = resolveRoomStatus({
    roomId,
    joinCode: resolvedJoinCode,
    openProof,
  });

  if (memory) {
    return {
      ...memory,
      status,
      openedAt: status === ROOM_STATUS.OPEN ? openedAt ?? memory.openedAt : null,
    };
  }

  if (!resolvedJoinCode) {
    return null;
  }

  return buildRoomRecord({
    roomId,
    joinCode: resolvedJoinCode,
    status,
    openedAt,
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
      if (memory) return memory;

      return buildRoomRecord({
        roomId,
        joinCode,
        status: ROOM_STATUS.WAITING,
        openedAt: null,
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
    status: ROOM_STATUS.WAITING,
    createdAt: Date.now(),
    openedAt: null,
  };
  rememberRoom(room);
  return room;
}

export async function getRoomByJoinCode(joinCode, { openProof = null } = {}) {
  const normalized = normalizeJoinCode(joinCode);
  if (!normalized) return null;

  const roomId = deriveRoomIdFromJoinCode(normalized);
  const { status, openedAt } = resolveRoomStatus({
    roomId,
    joinCode: normalized,
    openProof,
  });

  const memory = getMemoryStore().rooms.get(roomId);
  if (memory) {
    return {
      ...memory,
      status,
      openedAt: status === ROOM_STATUS.OPEN ? openedAt ?? memory.openedAt : null,
    };
  }

  return buildRoomRecord({
    roomId,
    joinCode: normalized,
    status,
    openedAt,
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
  publishToRoom(roomId, { type: "room_opened", roomId });

  const openProof =
    nextRoom.joinCode &&
    signRoomOpenProof({
      roomId,
      joinCode: nextRoom.joinCode,
      openedAt,
    });

  return { ...nextRoom, openProof: openProof ?? null };
}

export async function relayRoomMessage(roomId, message) {
  publishToRoom(roomId, { type: "signaling", message });
}

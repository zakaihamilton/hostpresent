import { normalizeJoinCode } from "./joinCode.js";
import { deriveRoomIdFromJoinCode } from "./roomIdentity.js";
import {
  inspectRoomToken,
  ROOM_ROLE,
  signRoomToken,
  TOKEN_FAILURE,
} from "./tokens.js";

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

function normalizeDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== "string") return "";
  const trimmed = deviceId.trim();
  if (!trimmed || trimmed.length > 128) return "";
  return trimmed;
}

function ensureKickedDeviceIds(room) {
  if (room.kickedDeviceIds instanceof Set) {
    return room.kickedDeviceIds;
  }
  const values = Array.isArray(room.kickedDeviceIds)
    ? room.kickedDeviceIds
    : [];
  room.kickedDeviceIds = new Set(
    values.map(normalizeDeviceId).filter(Boolean),
  );
  return room.kickedDeviceIds;
}

function buildRoomRecord({
  roomId,
  joinCode,
  createdAt = null,
  status = ROOM_STATUS.OPEN,
  openedAt = createdAt,
}) {
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
    kickedDeviceIds: new Set(),
  };
}

function rememberRoom(room) {
  const store = getMemoryStore();
  ensureKickedDeviceIds(room);
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
  const createdAt = Date.now();
  const room = {
    roomId,
    joinCode: normalizeJoinCode(joinCode),
    hostToken,
    participantToken,
    status: ROOM_STATUS.WAITING,
    createdAt,
    openedAt: null,
    kickedDeviceIds: new Set(),
  };
  rememberRoom(room);
  return room;
}

export async function getRoomById(roomId, { joinCode = null } = {}) {
  const memory = getMemoryStore().rooms.get(roomId);
  const resolvedJoinCode = joinCode ?? memory?.joinCode ?? null;

  if (memory) {
    ensureKickedDeviceIds(memory);
    return memory;
  }

  if (!resolvedJoinCode) {
    return null;
  }

  // Cold-start / multi-instance fallback: allow PeerJS wait-for-host.
  return buildRoomRecord({
    roomId,
    joinCode: resolvedJoinCode,
    createdAt: null,
    status: ROOM_STATUS.OPEN,
  });
}

export async function restoreRoomFromToken({ roomId, role, token }) {
  const inspection = inspectRoomToken(token);
  const verified = inspection.verified;
  if (
    !verified ||
    (!inspection.ok && inspection.reason !== TOKEN_FAILURE.EXPIRED)
  ) {
    return null;
  }

  const joinCode = verified.joinCode ?? null;
  const isExpired = inspection.reason === TOKEN_FAILURE.EXPIRED;

  if (joinCode) {
    const derivedRoomId = deriveRoomIdFromJoinCode(joinCode);
    if (derivedRoomId === roomId) {
      const memory = getMemoryStore().rooms.get(roomId);
      if (memory) {
        ensureKickedDeviceIds(memory);
        return memory;
      }

      // Host rejoin after cold start should admit guests immediately.
      return buildRoomRecord({
        roomId,
        joinCode,
        createdAt: Date.now(),
        status: ROOM_STATUS.OPEN,
        openedAt: Date.now(),
      });
    }
  }

  const room = {
    roomId,
    joinCode,
    hostToken:
      role === ROOM_ROLE.HOST && !isExpired
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.HOST, joinCode }),
    participantToken:
      role === ROOM_ROLE.PARTICIPANT && !isExpired
        ? token
        : signRoomToken({ roomId, role: ROOM_ROLE.PARTICIPANT, joinCode }),
    status: ROOM_STATUS.OPEN,
    createdAt: Date.now(),
    openedAt: Date.now(),
    kickedDeviceIds: new Set(),
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
    ensureKickedDeviceIds(memory);
    return memory;
  }

  // No in-memory room yet (other instance / never created): open fallback.
  return buildRoomRecord({
    roomId,
    joinCode: normalized,
    createdAt: null,
    status: ROOM_STATUS.OPEN,
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
      kickedDeviceIds: new Set(),
    }),
    status: ROOM_STATUS.OPEN,
    openedAt,
    joinCode: normalizedJoinCode || memory?.joinCode || null,
  };

  ensureKickedDeviceIds(nextRoom);
  rememberRoom(nextRoom);
  return nextRoom;
}

export async function kickDeviceFromRoom(
  roomId,
  deviceId,
  { joinCode = null } = {},
) {
  const normalized = normalizeDeviceId(deviceId);
  if (!normalized) return null;

  let memory = getMemoryStore().rooms.get(roomId);
  if (!memory) {
    const normalizedJoinCode = normalizeJoinCode(joinCode ?? "");
    if (!normalizedJoinCode) return null;
    memory = buildRoomRecord({
      roomId,
      joinCode: normalizedJoinCode,
      createdAt: Date.now(),
      status: ROOM_STATUS.OPEN,
      openedAt: Date.now(),
    });
  }

  ensureKickedDeviceIds(memory).add(normalized);
  rememberRoom(memory);
  return memory;
}

export function isDeviceKickedFromRoom(room, deviceId) {
  const normalized = normalizeDeviceId(deviceId);
  if (!normalized || !room) return false;
  return ensureKickedDeviceIds(room).has(normalized);
}

export async function relayRoomMessage(_roomId, _message) {
  // Application signaling is relayed over WebRTC data channels.
}

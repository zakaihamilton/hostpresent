"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import {
  type CreatedRoom,
  isCreatedRoom,
  isRoomState,
  type RoomRole,
  type RoomState,
} from "@/lib/room/roomTypes";
import { readRoomTokenRole } from "@/lib/room/tokenClaims";
import { removeParticipantRoomByToken } from "@/lib/settings/participantRoomSettings";
import {
  getActiveRoom,
  getRoomByHostToken,
  listHostRooms,
  removeHostRoomByToken,
  saveRoom,
  setActiveHostToken,
  touchHostRoom,
} from "@/lib/settings/roomSettings";

export const ROOM_SESSION_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  WAITING: "waiting",
  OPEN: "open",
  ERROR: "error",
} as const;
export type RoomSessionStatus =
  (typeof ROOM_SESSION_STATUS)[keyof typeof ROOM_SESSION_STATUS];

async function readErrorMessage(
  response: Response,
  fallback: string,
  token?: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (payload?.error === "[E077] Token expired") {
      const role = token ? readRoomTokenRole(token) : null;
      if (role === "participant") {
        return "[E033] This join link expired. Enter the join code again on the welcome screen.";
      }
      return "[E077] This host room link expired after 7 days. Create a new room from the host welcome screen.";
    }
    if (payload?.error) return payload.error;
  } catch {
    // ignore non-JSON error bodies (e.g. HTML 500 pages)
  }
  if (response.status === 401) {
    return "[E021] This room link is no longer valid. Create a new room from the host welcome screen.";
  }
  if (response.status === 404)
    return "[E022] Room not found. It may have expired.";
  return fallback;
}

async function fetchRoomState(token: string): Promise<RoomState> {
  let response: Response;
  try {
    response = await fetch("/api/rooms/state", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "[E023] Could not reach the server. Check your connection.",
    );
  }
  if (!response.ok) {
    if (response.status === 401) {
      removeHostRoomByToken(token);
      removeParticipantRoomByToken(token);
    }
    throw new Error(
      await readErrorMessage(
        response,
        "[E024] Failed to fetch room state",
        token,
      ),
    );
  }
  const state: unknown = await response.json();
  if (!isRoomState(state)) {
    throw new Error("[E024] Room state response was invalid.");
  }
  return state;
}

async function createRoomRequest(): Promise<CreatedRoom> {
  const response = await fetch("/api/rooms", { method: "POST" });
  if (!response.ok) {
    throw new Error("[E020] Failed to create room");
  }

  let created: unknown;
  try {
    created = await response.json();
  } catch {
    throw new Error("[E020] Failed to create a room with a valid room code");
  }

  if (!isCreatedRoom(created)) {
    throw new Error("[E020] Failed to create a room with a valid room code");
  }

  const joinCode = normalizeJoinCode(created.joinCode);
  if (!isValidJoinCode(joinCode)) {
    throw new Error("[E020] Failed to create a room with a valid room code");
  }

  return { ...created, joinCode };
}

export function useRoomSettings() {
  const getSavedRoom = useCallback((hostToken?: string | null) => {
    if (hostToken) {
      return getRoomByHostToken(hostToken);
    }
    return getActiveRoom();
  }, []);

  const persistRoom = useCallback(
    (room: {
      roomId: string;
      hostToken: string;
      joinCode?: string | null;
      createdAt?: number;
    }) => {
      saveRoom({
        roomId: room.roomId,
        hostToken: room.hostToken,
        joinCode: room.joinCode ?? null,
        createdAt: room.createdAt ?? Date.now(),
      });
      setActiveHostToken(room.hostToken);
    },
    [],
  );

  const getRecentHostRooms = useCallback(() => listHostRooms(), []);

  const markHostRoomUsed = useCallback((hostToken) => {
    touchHostRoom(hostToken);
  }, []);

  return { getSavedRoom, persistRoom, getRecentHostRooms, markHostRoomUsed };
}

export function useRoomSession({
  role: _role,
  token,
  enabled = true,
}: {
  role?: RoomRole;
  token?: string | null;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<RoomSessionStatus>(
    ROOM_SESSION_STATUS.IDLE,
  );
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const previousTokenRef = useRef<string | null>(null);

  const refreshState = useCallback(async (roomToken?: string | null) => {
    if (!roomToken) return null;
    const state = await fetchRoomState(roomToken);
    setRoomState(state);
    setStatus(ROOM_SESSION_STATUS.OPEN);
    return state;
  }, []);

  const createRoom = useCallback(async (): Promise<CreatedRoom> => {
    setStatus(ROOM_SESSION_STATUS.LOADING);
    setError("");
    try {
      const created = await createRoomRequest();
      saveRoom({
        roomId: created.roomId,
        hostToken: created.hostToken,
        joinCode: created.joinCode,
        createdAt: Date.now(),
      });
      setActiveHostToken(created.hostToken);
      setRoomState({
        roomId: created.roomId,
        role: "host",
        status: "open",
        openedAt: Date.now(),
      });
      setStatus(ROOM_SESSION_STATUS.OPEN);
      return created;
    } catch (createError) {
      setStatus(ROOM_SESSION_STATUS.ERROR);
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
      throw createError;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !token) {
      setStatus(ROOM_SESSION_STATUS.IDLE);
      setRoomState(null);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const isTokenSwitch =
        previousTokenRef.current && previousTokenRef.current !== token;
      if (!isTokenSwitch) {
        setStatus(ROOM_SESSION_STATUS.LOADING);
      }
      setError("");
      try {
        const state = await fetchRoomState(token);
        if (cancelled) return;
        setRoomState(state);
        setStatus(ROOM_SESSION_STATUS.OPEN);
      } catch (loadError) {
        if (cancelled) return;
        setStatus(ROOM_SESSION_STATUS.ERROR);
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      } finally {
        previousTokenRef.current = token;
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, token]);

  return {
    status,
    roomState,
    error,
    createRoom,
    refreshState,
  };
}

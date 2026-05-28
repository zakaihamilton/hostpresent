"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
};

async function readErrorMessage(response, fallback) {
  try {
    const payload = await response.json();
    if (payload?.error) return payload.error;
  } catch {
    // ignore non-JSON error bodies (e.g. HTML 500 pages)
  }
  if (response.status === 401) {
    return "[E021] This room link is no longer valid. Create a new room from the host welcome screen.";
  }
  if (response.status === 404) return "[E022] Room not found. It may have expired.";
  return fallback;
}

async function fetchRoomState(token) {
  let response;
  try {
    response = await fetch(
      `/api/rooms/state?token=${encodeURIComponent(token)}`,
    );
  } catch {
    throw new Error("[E023] Could not reach the server. Check your connection.");
  }
  if (!response.ok) {
    if (response.status === 401) {
      removeHostRoomByToken(token);
      removeParticipantRoomByToken(token);
    }
    throw new Error(
      await readErrorMessage(response, "[E024] Failed to fetch room state"),
    );
  }
  return response.json();
}

async function createRoomRequest() {
  const response = await fetch("/api/rooms", { method: "POST" });
  if (!response.ok) {
    throw new Error("[E020] Failed to create room");
  }
  return response.json();
}

export function useRoomSettings() {
  const getSavedRoom = useCallback((hostToken) => {
    if (hostToken) {
      return getRoomByHostToken(hostToken);
    }
    return getActiveRoom();
  }, []);

  const persistRoom = useCallback((room) => {
    saveRoom({
      roomId: room.roomId,
      hostToken: room.hostToken,
      participantToken: room.participantToken,
      joinCode: room.joinCode ?? null,
      createdAt: room.createdAt ?? Date.now(),
    });
    setActiveHostToken(room.hostToken);
  }, []);

  const getRecentHostRooms = useCallback(() => listHostRooms(), []);

  const markHostRoomUsed = useCallback((hostToken) => {
    touchHostRoom(hostToken);
  }, []);

  return { getSavedRoom, persistRoom, getRecentHostRooms, markHostRoomUsed };
}

export function useRoomSession({ role: _role, token, enabled = true }) {
  const [status, setStatus] = useState(ROOM_SESSION_STATUS.IDLE);
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const previousTokenRef = useRef(null);

  const refreshState = useCallback(async (roomToken) => {
    if (!roomToken) return null;
    const state = await fetchRoomState(roomToken);
    setRoomState(state);
    setStatus(ROOM_SESSION_STATUS.OPEN);
    return state;
  }, []);

  const createRoom = useCallback(async () => {
    setStatus(ROOM_SESSION_STATUS.LOADING);
    setError("");
    try {
      const created = await createRoomRequest();
      saveRoom({
        roomId: created.roomId,
        hostToken: created.hostToken,
        participantToken: created.participantToken,
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
      setError(createError.message);
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
        setError(loadError.message);
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

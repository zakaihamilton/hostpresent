"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getActiveRoom,
  getRoomByHostToken,
  listHostRooms,
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
  if (response.status === 401) return "Session expired. Join or create a room again.";
  if (response.status === 404) return "Room not found. It may have expired.";
  return fallback;
}

async function fetchRoomState(token, openProof = null) {
  const params = new URLSearchParams({ token });
  if (openProof) {
    params.set("open", openProof);
  }

  let response;
  try {
    response = await fetch(`/api/rooms/state?${params.toString()}`);
  } catch {
    throw new Error("Could not reach the server. Check your connection.");
  }
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Failed to fetch room state"),
    );
  }
  return response.json();
}

async function createRoomRequest() {
  const response = await fetch("/api/rooms", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to create room");
  }
  return response.json();
}

async function openRoomRequest(token) {
  const response = await fetch("/api/rooms/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to open room");
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
      openProof: room.openProof ?? null,
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

export function useRoomSession({
  role: _role,
  token,
  enabled = true,
  openProof = null,
}) {
  const [status, setStatus] = useState(ROOM_SESSION_STATUS.IDLE);
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const eventSourceRef = useRef(null);
  const previousTokenRef = useRef(null);
  const openProofRef = useRef(openProof);

  useEffect(() => {
    openProofRef.current = openProof;
  }, [openProof]);

  const refreshState = useCallback(async (roomToken, proof = openProofRef.current) => {
    if (!roomToken) return null;
    const state = await fetchRoomState(roomToken, proof);
    setRoomState(state);
    setStatus(
      state.status === "open"
        ? ROOM_SESSION_STATUS.OPEN
        : ROOM_SESSION_STATUS.WAITING,
    );
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
        openProof: null,
        createdAt: Date.now(),
      });
      setActiveHostToken(created.hostToken);
      setRoomState({
        roomId: created.roomId,
        role: "host",
        status: "waiting",
        openedAt: null,
      });
      setStatus(ROOM_SESSION_STATUS.WAITING);
      return created;
    } catch (createError) {
      setStatus(ROOM_SESSION_STATUS.ERROR);
      setError(createError.message);
      throw createError;
    }
  }, []);

  const openRoom = useCallback(async (hostToken) => {
    setStatus(ROOM_SESSION_STATUS.LOADING);
    setError("");
    try {
      const opened = await openRoomRequest(hostToken);
      if (opened.openProof) {
        openProofRef.current = opened.openProof;
      }
      setRoomState((prev) => ({
        ...(prev ?? {}),
        roomId: opened.roomId,
        role: "host",
        status: opened.status,
        openedAt: opened.openedAt,
        openProof: opened.openProof ?? null,
      }));
      setStatus(ROOM_SESSION_STATUS.OPEN);
      return opened;
    } catch (openError) {
      setStatus(ROOM_SESSION_STATUS.ERROR);
      setError(openError.message);
      throw openError;
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
        const state = await fetchRoomState(token, openProofRef.current);
        if (cancelled) return;
        setRoomState(state);
        setStatus(
          state.status === "open"
            ? ROOM_SESSION_STATUS.OPEN
            : ROOM_SESSION_STATUS.WAITING,
        );
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

  useEffect(() => {
    if (!enabled || !token || status !== ROOM_SESSION_STATUS.WAITING) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return undefined;
    }

    const streamUrl = `/api/rooms/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("room_opened", () => {
      setRoomState((prev) =>
        prev ? { ...prev, status: "open", openedAt: Date.now() } : prev,
      );
      setStatus(ROOM_SESSION_STATUS.OPEN);
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
    };

    const pollTimer = setInterval(() => {
      void refreshState(token, openProofRef.current);
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [enabled, refreshState, status, token]);

  return {
    status,
    roomState,
    error,
    createRoom,
    openRoom,
    refreshState,
  };
}

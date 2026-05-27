"use client";

import { useEffect, useState } from "react";
import { APP_ROLE } from "@/hooks/hashRouter";
import { resolveJoinCode } from "@/lib/room/inviteLink";
import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { getParticipantRoomByJoinCode } from "@/lib/settings/participantRoomSettings";
import { getRoomByJoinCode } from "@/lib/settings/roomSettings";

const HOST_ROOM_MISSING_ERROR =
  "This browser does not have the host room saved. Go to the host welcome screen and open your room from there.";

function resolveHostRouteToken(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  const room = getRoomByJoinCode(normalized);
  return {
    token: room?.hostToken ?? null,
    loading: false,
    error: room?.hostToken ? "" : HOST_ROOM_MISSING_ERROR,
  };
}

function resolveSavedParticipantRouteToken(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  const saved = getParticipantRoomByJoinCode(normalized);
  if (!saved?.participantToken) {
    return null;
  }
  return {
    token: saved.participantToken,
    loading: false,
    error: "",
  };
}

export function useRouteToken({ role, token, joinCode }) {
  const [participantState, setParticipantState] = useState({
    token: null,
    loading: false,
    error: "",
  });

  useEffect(() => {
    if (token || !joinCode || role !== APP_ROLE.PARTICIPANT) {
      setParticipantState({ token: null, loading: false, error: "" });
      return undefined;
    }

    const saved = resolveSavedParticipantRouteToken(joinCode);
    if (saved) {
      setParticipantState(saved);
      return undefined;
    }

    let cancelled = false;
    const normalized = normalizeJoinCode(joinCode);

    setParticipantState({ token: null, loading: true, error: "" });

    void resolveJoinCode(normalized)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved?.participantToken) {
          setParticipantState({
            token: resolved.participantToken,
            loading: false,
            error: "",
          });
          return;
        }
        setParticipantState({
          token: null,
          loading: false,
          error: "Could not get a participant token for this room.",
        });
      })
      .catch((resolveError) => {
        if (cancelled) return;
        setParticipantState({
          token: null,
          loading: false,
          error:
            resolveError instanceof Error
              ? resolveError.message
              : "Could not join this room. Check the room ID and try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [joinCode, role, token]);

  if (token) {
    return { token, loading: false, error: "" };
  }

  if (!joinCode) {
    return { token: null, loading: false, error: "" };
  }

  if (role === APP_ROLE.HOST) {
    return resolveHostRouteToken(joinCode);
  }

  const saved = resolveSavedParticipantRouteToken(joinCode);
  if (saved) {
    return saved;
  }

  return participantState;
}

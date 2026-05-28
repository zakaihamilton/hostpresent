"use client";

import { useEffect, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { resolveJoinCode } from "@/lib/room/inviteLink";
import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { readRoomTokenRole } from "@/lib/room/tokenClaims";
import { getParticipantRoomByJoinCode } from "@/lib/settings/participantRoomSettings";
import { getActiveRoom, getRoomByJoinCode } from "@/lib/settings/roomSettings";

const HOST_ROOM_MISSING_ERROR =
  "This browser does not have the host room saved. Go to the host welcome screen and open your room from there.";

const PARTICIPANT_LINK_ON_HOST_ERROR =
  "Participant join codes cannot be used to host. Create or open your room from the host welcome screen.";

const HOST_LINK_ON_PARTICIPANT_ERROR =
  "This link is for hosts only. Use a participant join code or invite link to join.";

function roleMismatchError(routeRole, tokenRole) {
  if (routeRole === APP_ROLE.HOST && tokenRole === APP_ROLE.PARTICIPANT) {
    return PARTICIPANT_LINK_ON_HOST_ERROR;
  }
  if (routeRole === APP_ROLE.PARTICIPANT && tokenRole === APP_ROLE.HOST) {
    return HOST_LINK_ON_PARTICIPANT_ERROR;
  }
  return "This room link does not match the requested role.";
}

function verifyTokenForRole(token, routeRole) {
  const tokenRole = readRoomTokenRole(token);
  if (!tokenRole) {
    return { token, error: "" };
  }
  if (tokenRole !== routeRole) {
    return { token: null, error: roleMismatchError(routeRole, tokenRole) };
  }
  return { token, error: "" };
}

function resolveHostRouteToken(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  const room = getRoomByJoinCode(normalized);
  if (!room?.hostToken) {
    return {
      token: null,
      loading: false,
      error: PARTICIPANT_LINK_ON_HOST_ERROR,
    };
  }
  return verifyTokenForRole(room.hostToken, APP_ROLE.HOST);
}

function resolveSavedParticipantRouteToken(joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  const saved = getParticipantRoomByJoinCode(normalized);
  if (!saved?.participantToken) {
    return null;
  }
  return verifyTokenForRole(saved.participantToken, APP_ROLE.PARTICIPANT);
}

function resolveActiveHostToken() {
  const active = getActiveRoom();
  if (!active?.hostToken) {
    return {
      token: null,
      loading: false,
      error: HOST_ROOM_MISSING_ERROR,
    };
  }
  return {
    ...verifyTokenForRole(active.hostToken, APP_ROLE.HOST),
    loading: false,
  };
}

export function useRouteToken({ role, token, joinCode, view }) {
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
          const verified = verifyTokenForRole(
            resolved.participantToken,
            APP_ROLE.PARTICIPANT,
          );
          setParticipantState({
            token: verified.token,
            loading: false,
            error: verified.error,
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
              : "Could not join this room. Check the join code and try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [joinCode, role, token]);

  if (token) {
    const verified = verifyTokenForRole(token, role);
    return { ...verified, loading: false };
  }

  if (role === APP_ROLE.HOST && view === APP_VIEW.MEETING && !joinCode) {
    return resolveActiveHostToken();
  }

  if (!joinCode) {
    return { token: null, loading: false, error: "" };
  }

  if (role === APP_ROLE.HOST) {
    return { ...resolveHostRouteToken(joinCode), loading: false };
  }

  const saved = resolveSavedParticipantRouteToken(joinCode);
  if (saved) {
    return saved;
  }

  return participantState;
}

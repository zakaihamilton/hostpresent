"use client";

import { useEffect, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { resolveJoinCode } from "@/lib/room/inviteLink";
import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { readRoomTokenRole } from "@/lib/room/tokenClaims";
import { getOrCreateParticipantDeviceId } from "@/lib/settings/participantDeviceId";
import { getActiveRoom, getRoomByJoinCode } from "@/lib/settings/roomSettings";

const HOST_ROOM_MISSING_ERROR =
  "[E025] This browser does not have the host room saved. Go to the host welcome screen and open your room from there.";

const PARTICIPANT_LINK_ON_HOST_ERROR =
  "[E026] Participant join codes cannot be used to host. Create or open your room from the host welcome screen.";

const HOST_LINK_ON_PARTICIPANT_ERROR =
  "[E027] This link is for hosts only. Use a participant join code or invite link to join.";

const WAITING_POLL_MS = 2000;

function roleMismatchError(routeRole, tokenRole) {
  if (routeRole === APP_ROLE.HOST && tokenRole === APP_ROLE.PARTICIPANT) {
    return PARTICIPANT_LINK_ON_HOST_ERROR;
  }
  if (routeRole === APP_ROLE.PARTICIPANT && tokenRole === APP_ROLE.HOST) {
    return HOST_LINK_ON_PARTICIPANT_ERROR;
  }
  return "[E028] This room link does not match the requested role.";
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
    waiting: false,
  });

  useEffect(() => {
    if (token || !joinCode || role !== APP_ROLE.PARTICIPANT) {
      setParticipantState({
        token: null,
        loading: false,
        error: "",
        waiting: false,
      });
      return undefined;
    }

    let cancelled = false;
    let pollTimer = null;
    const normalized = normalizeJoinCode(joinCode);
    const deviceId = getOrCreateParticipantDeviceId();

    const applyResolved = (resolved) => {
      if (resolved?.waiting) {
        setParticipantState({
          token: null,
          loading: true,
          error: "",
          waiting: true,
        });
        pollTimer = window.setTimeout(resolve, WAITING_POLL_MS);
        return;
      }
      if (resolved?.participantToken) {
        const verified = verifyTokenForRole(
          resolved.participantToken,
          APP_ROLE.PARTICIPANT,
        );
        setParticipantState({
          token: verified.token,
          loading: false,
          error: verified.error,
          waiting: false,
        });
        return;
      }
      setParticipantState({
        token: null,
        loading: false,
        error: "[E029] Could not get a participant token for this room.",
        waiting: false,
      });
    };

    const resolve = () => {
      setParticipantState((prev) => ({
        token: null,
        loading: !prev.waiting,
        error: "",
        waiting: prev.waiting,
      }));

      void resolveJoinCode(normalized, { deviceId })
        .then((resolved) => {
          if (cancelled) return;
          applyResolved(resolved);
        })
        .catch((resolveError) => {
          if (cancelled) return;
          setParticipantState({
            token: null,
            loading: false,
            waiting: false,
            error:
              resolveError instanceof Error
                ? resolveError.message
                : "[E030] Could not join this room. Check the join code and try again.",
          });
        });
    };

    // Always re-resolve so kicked devices and waiting rooms are enforced
    // even when a participant token is cached locally.
    resolve();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [joinCode, role, token]);

  if (token) {
    const verified = verifyTokenForRole(token, role);
    return { ...verified, loading: false, waiting: false };
  }

  if (role === APP_ROLE.HOST && view === APP_VIEW.MEETING && !joinCode) {
    return { ...resolveActiveHostToken(), waiting: false };
  }

  if (!joinCode) {
    return { token: null, loading: false, error: "", waiting: false };
  }

  if (role === APP_ROLE.HOST) {
    return {
      ...resolveHostRouteToken(joinCode),
      loading: false,
      waiting: false,
    };
  }

  return participantState;
}

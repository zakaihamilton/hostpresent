"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/useHashRouter";
import { ROOM_SESSION_STATUS, useRoomSession } from "@/hooks/useRoomSession";
import {
  extractJoinCodeFromInput,
  normalizeRoomIdInput,
  resolveJoinCode,
} from "@/lib/room/inviteLink";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  clearParticipantRooms,
  formatParticipantRoomLabel,
  getParticipantRoomByToken,
  listParticipantRooms,
  saveParticipantRoom,
  touchParticipantRoom,
} from "@/lib/settings/participantRoomSettings";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import shared from "./WelcomeShared.module.css";

function extractLegacyTokenFromInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const hashMatch = trimmed.match(/#\/welcome\/participant\/([^/?#]+)/);
  if (hashMatch) return hashMatch[1];

  const pathMatch = trimmed.match(/\/welcome\/participant\/([^/?#]+)/);
  if (pathMatch) return pathMatch[1];

  if (trimmed.includes(".")) return trimmed;

  return "";
}

export function WelcomeParticipantPanel({
  token,
  joinCode,
  navigate,
  navigateJoinCode,
  navigateParticipantWelcome,
}) {
  const [roomIdInput, setRoomIdInput] = useState(joinCode ?? "");
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [participantToken, setParticipantToken] = useState(null);
  const [recentRooms, setRecentRooms] = useState([]);
  const [resolveError, setResolveError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const resolvedJoinCodeRef = useRef(null);

  const refreshRecentRooms = useCallback(() => {
    setRecentRooms(listParticipantRooms());
  }, []);

  const { status, error, roomState } = useRoomSession({
    role: APP_ROLE.PARTICIPANT,
    token: participantToken,
    enabled: Boolean(participantToken),
  });

  const joinWithResolved = useCallback(
    (resolved) => {
      if (!resolved?.participantToken) return;
      saveParticipantRoom({
        roomId: resolved.roomId,
        participantToken: resolved.participantToken,
        joinCode: resolved.joinCode ?? null,
      });
      setResolveError("");
      setParticipantToken(resolved.participantToken);
      if (resolved.joinCode) {
        setRoomIdInput(formatJoinCode(resolved.joinCode));
      }
      touchParticipantRoom(resolved.participantToken);
      refreshRecentRooms();
      if (resolved.joinCode) {
        navigateJoinCode(resolved.joinCode);
      }
    },
    [navigateJoinCode, refreshRecentRooms],
  );

  const resolveAndJoin = useCallback(
    async (code) => {
      const normalized = normalizeRoomIdInput(code);
      if (!normalized) return;
      setResolveError("");
      setIsResolving(true);
      try {
        const resolved = await resolveJoinCode(normalized);
        joinWithResolved(resolved);
      } catch (joinError) {
        setResolveError(joinError.message);
      } finally {
        setIsResolving(false);
      }
    },
    [joinWithResolved],
  );

  useEffect(() => {
    refreshRecentRooms();
  }, [refreshRecentRooms]);

  useEffect(() => {
    if (joinCode) {
      setRoomIdInput(formatJoinCode(joinCode));
    }
  }, [joinCode]);

  useEffect(() => {
    if (!token && !joinCode) {
      setParticipantToken(null);
      return;
    }

    if (joinCode) return;

    setParticipantToken(token);
    const saved = getParticipantRoomByToken(token);
    if (saved?.joinCode) {
      setRoomIdInput(formatJoinCode(saved.joinCode));
    }
  }, [joinCode, token]);

  useEffect(() => {
    if (!joinCode || resolvedJoinCodeRef.current === joinCode) return;
    resolvedJoinCodeRef.current = joinCode;
    setRoomIdInput(joinCode);
    void resolveAndJoin(joinCode);
  }, [joinCode, resolveAndJoin]);

  useEffect(() => {
    if (
      participantToken &&
      roomState?.roomId &&
      status !== ROOM_SESSION_STATUS.ERROR
    ) {
      saveParticipantRoom({
        roomId: roomState.roomId,
        participantToken,
        joinCode: roomState.joinCode ?? joinCode ?? roomIdInput ?? null,
      });
      refreshRecentRooms();
    }
  }, [
    joinCode,
    participantToken,
    refreshRecentRooms,
    roomIdInput,
    roomState?.joinCode,
    roomState?.roomId,
    status,
  ]);

  useEffect(() => {
    if (participantToken && status === ROOM_SESSION_STATUS.OPEN) {
      touchParticipantRoom(participantToken);
      const activeJoinCode =
        roomState?.joinCode ?? joinCode ?? normalizeRoomIdInput(roomIdInput);
      if (activeJoinCode) {
        navigate({
          view: APP_VIEW.MEETING,
          role: APP_ROLE.PARTICIPANT,
          joinCode: activeJoinCode,
        });
        return;
      }
      navigate({
        view: APP_VIEW.MEETING,
        role: APP_ROLE.PARTICIPANT,
        token: participantToken,
      });
    }
  }, [
    joinCode,
    navigate,
    participantToken,
    roomIdInput,
    roomState?.joinCode,
    status,
  ]);

  const joinWithToken = (nextToken) => {
    if (!nextToken) return;
    setParticipantToken(nextToken);
    touchParticipantRoom(nextToken);
    refreshRecentRooms();
    const saved = getParticipantRoomByToken(nextToken);
    if (saved?.joinCode) {
      navigateJoinCode(saved.joinCode);
      return;
    }
    navigate({
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.PARTICIPANT,
      token: nextToken,
    });
  };

  const handleJoinRoomId = () => {
    void resolveAndJoin(roomIdInput);
  };

  const handleJoinInviteLink = async () => {
    setResolveError("");
    const code = extractJoinCodeFromInput(inviteLinkInput);
    if (code) {
      setRoomIdInput(code);
      await resolveAndJoin(code);
      return;
    }

    const legacyToken = extractLegacyTokenFromInput(inviteLinkInput);
    if (legacyToken) {
      joinWithToken(legacyToken);
      return;
    }

    setResolveError("Enter a valid room ID or invite link.");
  };

  const handleSelectRoom = (room) => {
    if (room.joinCode) {
      setRoomIdInput(formatJoinCode(room.joinCode));
      void resolveAndJoin(room.joinCode);
      return;
    }
    joinWithToken(room.participantToken);
  };

  const handleBackToJoin = () => {
    setParticipantToken(null);
    setRoomIdInput("");
    setInviteLinkInput("");
    setResolveError("");
    resolvedJoinCodeRef.current = null;
    navigateParticipantWelcome();
  };

  const handleClearRecentRooms = () => {
    clearParticipantRooms();
    refreshRecentRooms();
  };

  const recentRoomsTrigger = (
    <RecentRoomsTrigger
      rooms={recentRooms}
      activeToken={participantToken}
      tokenKey="participantToken"
      formatLabel={(room) => formatParticipantRoomLabel(room)}
      onSelect={handleSelectRoom}
      onClear={handleClearRecentRooms}
      emptyMessage="Rooms you join will appear here for quick reuse."
    />
  );

  const showRoomIdEntry = !participantToken && !isResolving;

  if (isResolving && !participantToken) {
    return (
      <div className={shared.welcomePanel}>
        <div className={shared.waiting}>
          <div className={shared.spinner} aria-hidden />
          <p className={shared.helpText}>Looking up room…</p>
        </div>
      </div>
    );
  }

  if (showRoomIdEntry) {
    return (
      <div className={shared.welcomePanel}>
        <p className={shared.helpText}>
          Enter the room ID from your host, paste an invite link, or open recent
          rooms you joined before.
        </p>

        {recentRoomsTrigger}

        <div className={shared.fieldGroup}>
          <label className={shared.label} htmlFor="participant-room-id">
            Room ID
          </label>
          <input
            id="participant-room-id"
            className={shared.tokenInput}
            value={roomIdInput}
            onChange={(event) => setRoomIdInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleJoinRoomId();
            }}
            placeholder="e.g. ABCD-EFGH"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className={shared.fieldGroup}>
          <label className={shared.label} htmlFor="participant-invite-link">
            Or paste invite link
          </label>
          <input
            id="participant-invite-link"
            className={shared.tokenInput}
            value={inviteLinkInput}
            onChange={(event) => setInviteLinkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleJoinInviteLink();
            }}
            placeholder="https://…/#/j/…"
          />
        </div>

        <div className={shared.statusArea}>
          {resolveError
            ? <p className={shared.statusError}>{resolveError}</p>
            : null}
        </div>

        <div className={shared.actions}>
          <button
            type="button"
            className={shared.button}
            onClick={handleJoinRoomId}
            disabled={!roomIdInput.trim()}
          >
            Join with room ID
          </button>
          <button
            type="button"
            className={`${shared.button} ${shared.buttonSecondary}`}
            onClick={handleJoinInviteLink}
            disabled={!inviteLinkInput.trim()}
          >
            Join with link
          </button>
        </div>
      </div>
    );
  }

  if (
    status === ROOM_SESSION_STATUS.LOADING ||
    status === ROOM_SESSION_STATUS.WAITING
  ) {
    return (
      <div className={shared.welcomePanel}>
        <div className={shared.waiting}>
          <div className={shared.spinner} aria-hidden />
          <p className={shared.helpText}>
            Waiting for the host to open the room…
          </p>
        </div>
        <div className={shared.actions}>
          <button
            type="button"
            className={`${shared.button} ${shared.buttonSecondary}`}
            onClick={handleBackToJoin}
          >
            Enter a different room ID
          </button>
        </div>
      </div>
    );
  }

  if (status === ROOM_SESSION_STATUS.ERROR) {
    return (
      <div className={shared.welcomePanel}>
        <div className={shared.statusArea}>
          <p className={shared.statusError}>{error}</p>
        </div>
        {recentRoomsTrigger}
        <div className={shared.actions}>
          <button
            type="button"
            className={`${shared.button} ${shared.buttonSecondary}`}
            onClick={handleBackToJoin}
          >
            Enter a different room ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={shared.welcomePanel}>
      <div className={shared.waiting}>
        <div className={shared.spinner} aria-hidden />
        <p className={shared.helpText}>Joining meeting…</p>
      </div>
    </div>
  );
}

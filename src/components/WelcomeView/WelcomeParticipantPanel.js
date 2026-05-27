"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import {
  extractJoinCodeFromInput,
  formatRoomIdInput,
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
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import { DisplayNameField } from "@/components/DisplayNameField";
import { ParticipantModeToggle } from "@/components/ParticipantModeToggle";
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
  autoJoinFromRoute = false,
  navigate,
  navigateJoinCode,
  navigateParticipantWelcome,
}) {
  const [roomIdInput, setRoomIdInput] = useState(
    joinCode ? formatRoomIdInput(joinCode) : "",
  );
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [recentRooms, setRecentRooms] = useState([]);
  const [resolveError, setResolveError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [displayName, setDisplayName] = useState(() => loadDisplayName());
  const [participantMode, setParticipantMode] = useState(() =>
    loadParticipantMode(),
  );
  const resolvedJoinCodeRef = useRef(null);

  const refreshRecentRooms = useCallback(() => {
    setRecentRooms(listParticipantRooms());
  }, []);

  const enterMeeting = useCallback(
    (resolved) => {
      if (!resolved?.participantToken) return;

      saveParticipantRoom({
        roomId: resolved.roomId,
        participantToken: resolved.participantToken,
        joinCode: resolved.joinCode ?? null,
      });
      touchParticipantRoom(resolved.participantToken);
      refreshRecentRooms();
      setResolveError("");

      if (resolved.joinCode) {
        navigate({
          view: APP_VIEW.MEETING,
          role: APP_ROLE.PARTICIPANT,
          joinCode: resolved.joinCode,
        });
        return;
      }

      navigate({
        view: APP_VIEW.MEETING,
        role: APP_ROLE.PARTICIPANT,
        token: resolved.participantToken,
      });
    },
    [navigate, refreshRecentRooms],
  );

  const resolveAndJoin = useCallback(
    async (code) => {
      const normalized = normalizeRoomIdInput(code);
      if (!normalized) return;
      setResolveError("");
      setIsResolving(true);
      try {
        const resolved = await resolveJoinCode(normalized);
        enterMeeting(resolved);
      } catch (joinError) {
        setResolveError(joinError.message);
        resolvedJoinCodeRef.current = null;
      } finally {
        setIsResolving(false);
      }
    },
    [enterMeeting],
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
    if (!autoJoinFromRoute || !joinCode || resolvedJoinCodeRef.current === joinCode) {
      return;
    }
    resolvedJoinCodeRef.current = joinCode;
    setRoomIdInput(formatRoomIdInput(joinCode));
    void resolveAndJoin(joinCode);
  }, [autoJoinFromRoute, joinCode, resolveAndJoin]);

  const joinWithToken = (nextToken) => {
    if (!nextToken) return;
    touchParticipantRoom(nextToken);
    refreshRecentRooms();
    const saved = getParticipantRoomByToken(nextToken);
    if (saved?.joinCode) {
      navigate({
        view: APP_VIEW.MEETING,
        role: APP_ROLE.PARTICIPANT,
        joinCode: saved.joinCode,
      });
      return;
    }
    navigate({
      view: APP_VIEW.MEETING,
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
      setRoomIdInput(formatRoomIdInput(code));
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

  const handleDisplayNameChange = (value) => {
    const normalized = normalizeDisplayNameInput(value);
    setDisplayName(normalized);
    saveDisplayName(normalized);
  };

  const handleParticipantModeChange = (mode) => {
    setParticipantMode(mode);
    saveParticipantMode(mode);
  };

  const recentRoomsTrigger = (
    <RecentRoomsTrigger
      rooms={recentRooms}
      activeToken={token}
      tokenKey="participantToken"
      formatLabel={(room) => formatParticipantRoomLabel(room)}
      onSelect={handleSelectRoom}
      onClear={handleClearRecentRooms}
      emptyMessage="Rooms you join will appear here for quick reuse."
    />
  );

  if (isResolving) {
    return (
      <div className={shared.welcomePanel}>
        <div className={shared.waiting}>
          <div className={shared.spinner} aria-hidden />
          <p className={shared.helpText}>Joining meeting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shared.welcomePanel}>
      <p className={shared.helpText}>
        Enter the room ID from your host, paste an invite link, or open recent
        rooms you joined before.
      </p>

      {recentRoomsTrigger}

      <DisplayNameField
        id="participant-display-name"
        label="Your name"
        value={displayName}
        onChange={handleDisplayNameChange}
        placeholder="How should others see you?"
      />

      <div className={shared.fieldGroup}>
        <span className={shared.label}>Participation mode</span>
        <ParticipantModeToggle
          value={participantMode}
          onChange={handleParticipantModeChange}
        />
        <p className={shared.helpText}>
          Choose Available if you may speak on camera, or Listening only if you
          are observing the meeting.
        </p>
      </div>

      <div className={shared.fieldGroup}>
        <label className={shared.label} htmlFor="participant-room-id">
          Room ID
        </label>
        <input
          id="participant-room-id"
          className={shared.tokenInput}
          value={roomIdInput}
          onChange={(event) =>
            setRoomIdInput(formatRoomIdInput(event.target.value))
          }
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
        {resolveError ? <p className={shared.statusError}>{resolveError}</p> : null}
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

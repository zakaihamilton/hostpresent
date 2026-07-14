"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantModeToggle } from "@/components/meeting/ParticipantModeToggle";
import { DisplayNameField } from "@/components/ui/DisplayNameField";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import {
  formatRoomIdInput,
  normalizeRoomIdInput,
  resolveJoinCode,
} from "@/lib/room/inviteLink";
import { formatJoinCode, JOIN_CODE_LENGTH } from "@/lib/room/joinCodeFormat";
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import { getOrCreateParticipantDeviceId } from "@/lib/settings/participantDeviceId";
import {
  clearParticipantRooms,
  formatParticipantRoomLabel,
  getParticipantRoomByToken,
  listParticipantRooms,
  removeParticipantRoomByToken,
  saveParticipantRoom,
  touchParticipantRoom,
} from "@/lib/settings/participantRoomSettings";
import { JoinCodeBoxes } from "./JoinCodeBoxes";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import ps from "./WelcomeParticipantPanel.module.css";
import shared from "./WelcomeShared.module.css";

const WAITING_POLL_MS = 2000;

export function WelcomeParticipantPanel({
  token,
  joinCode,
  autoJoinFromRoute = false,
  navigate,
}) {
  const [roomIdInput, setRoomIdInput] = useState(
    joinCode ? formatRoomIdInput(joinCode) : "",
  );
  const [recentRooms, setRecentRooms] = useState([]);
  const [resolveError, setResolveError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [displayName, setDisplayName] = useState(() => loadDisplayName());
  const [participantMode, setParticipantMode] = useState(() =>
    loadParticipantMode(),
  );
  const resolvedJoinCodeRef = useRef(null);
  const waitingPollRef = useRef(null);

  const refreshRecentRooms = useCallback(() => {
    setRecentRooms(listParticipantRooms());
  }, []);

  const clearWaitingPoll = useCallback(() => {
    if (waitingPollRef.current) {
      window.clearTimeout(waitingPollRef.current);
      waitingPollRef.current = null;
    }
  }, []);

  const enterMeeting = useCallback(
    (resolved) => {
      if (!resolved?.participantToken) return;

      clearWaitingPoll();
      setWaitingForHost(false);
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
    [clearWaitingPoll, navigate, refreshRecentRooms],
  );

  const resolveAndJoin = useCallback(
    async (code, { fromPoll = false } = {}) => {
      const normalized = normalizeRoomIdInput(code);
      if (!normalized) return;
      if (!fromPoll) {
        setResolveError("");
        setIsResolving(true);
      }
      try {
        const resolved = await resolveJoinCode(normalized, {
          deviceId: getOrCreateParticipantDeviceId(),
        });
        if (resolved?.waiting) {
          setWaitingForHost(true);
          setIsResolving(false);
          clearWaitingPoll();
          waitingPollRef.current = window.setTimeout(() => {
            void resolveAndJoin(normalized, { fromPoll: true });
          }, WAITING_POLL_MS);
          return;
        }
        enterMeeting(resolved);
      } catch (joinError) {
        clearWaitingPoll();
        setWaitingForHost(false);
        setResolveError(joinError.message);
        resolvedJoinCodeRef.current = null;
      } finally {
        if (!fromPoll) {
          setIsResolving(false);
        }
      }
    },
    [clearWaitingPoll, enterMeeting],
  );

  useEffect(() => {
    refreshRecentRooms();
  }, [refreshRecentRooms]);

  useEffect(() => {
    return () => clearWaitingPoll();
  }, [clearWaitingPoll]);

  useEffect(() => {
    if (joinCode) {
      setRoomIdInput(formatJoinCode(joinCode));
    }
  }, [joinCode]);

  useEffect(() => {
    if (
      !autoJoinFromRoute ||
      !joinCode ||
      resolvedJoinCodeRef.current === joinCode
    ) {
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

  const handleSelectRoom = (room) => {
    if (room.joinCode) {
      setRoomIdInput(formatJoinCode(room.joinCode));
      void resolveAndJoin(room.joinCode);
      return;
    }
    joinWithToken(room.participantToken);
  };

  const handleClearRecentRooms = () => {
    clearParticipantRooms();
    refreshRecentRooms();
  };

  const handleRemoveRoom = (room) => {
    if (room.participantToken) {
      removeParticipantRoomByToken(room.participantToken);
      refreshRecentRooms();
    }
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
      onRemove={handleRemoveRoom}
      emptyMessage="Rooms you join will appear here for quick reuse."
    />
  );

  const allFilled =
    (roomIdInput ?? "").replace(/-/g, "").length === JOIN_CODE_LENGTH;

  if (isResolving || waitingForHost) {
    return (
      <div className={shared.welcomePanel}>
        <div className={shared.waiting}>
          <div className={shared.spinner} aria-hidden />
          <p className={shared.helpText}>
            {waitingForHost
              ? "Waiting for the host to start the meeting…"
              : "Checking the room and joining…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={shared.welcomePanel}>
      <div className={shared.panelIntro}>
        <h2 className={shared.panelTitle}>Join a session</h2>
        <p className={shared.panelText}>
          Use the invite from the host, or enter the short room code.
        </p>
      </div>

      <div className={ps.joinSection}>
        <div className={shared.directActionsGrid}>
          <div className={shared.directActionSection}>
            <label className={shared.label} htmlFor="join-code-box-0">
              Room code
            </label>
            <div className={shared.directActionRow}>
              <JoinCodeBoxes
                value={roomIdInput}
                onChange={setRoomIdInput}
                autoFocus
                className={shared.joinCodeBoxes}
              />
            </div>
            <p className={ps.joinHint}>
              Enter the {JOIN_CODE_LENGTH}-character code from the host.
            </p>
          </div>
        </div>
      </div>

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
          disabled={!allFilled}
        >
          Join meeting
        </button>
        {recentRoomsTrigger}
      </div>
    </div>
  );
}

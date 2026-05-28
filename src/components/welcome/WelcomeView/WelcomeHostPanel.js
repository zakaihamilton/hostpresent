"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DisplayNameField } from "@/components/ui/DisplayNameField";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { useRoomSession, useRoomSettings } from "@/hooks/roomSession";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  loadDisplayName,
  normalizeDisplayNameInput,
  saveDisplayName,
} from "@/lib/settings/displayNameSettings";
import {
  clearHostRooms,
  formatRoomLabel,
  getRoomByHostToken,
  listHostRooms,
} from "@/lib/settings/roomSettings";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import shared from "./WelcomeShared.module.css";

async function fetchHostRoomDetails(hostToken) {
  const response = await fetch(
    `/api/rooms/state?token=${encodeURIComponent(hostToken)}`,
  );
  if (!response.ok) {
    throw new Error("[E050] Could not load room");
  }
  return response.json();
}

export function WelcomeHostPanel({ legacyToken, navigate }) {
  const { getSavedRoom, persistRoom, markHostRoomUsed } = useRoomSettings();
  const [hostToken, setHostToken] = useState(null);
  const [joinCode, setJoinCode] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [displayName, setDisplayName] = useState(() => loadDisplayName());
  const initRef = useRef(false);

  const refreshRecentRooms = useCallback(() => {
    setRecentRooms(listHostRooms());
  }, []);

  const applyRoom = useCallback(
    (room) => {
      setHostToken(room.hostToken);
      setJoinCode(room.joinCode ?? null);
      markHostRoomUsed(room.hostToken);
      refreshRecentRooms();
    },
    [markHostRoomUsed, refreshRecentRooms],
  );

  const { error, createRoom, roomState } = useRoomSession({
    role: APP_ROLE.HOST,
    token: hostToken,
    enabled: Boolean(hostToken),
  });

  useEffect(() => {
    if (!roomState?.joinCode) return;
    setJoinCode((current) =>
      current === roomState.joinCode ? current : roomState.joinCode,
    );
  }, [roomState?.joinCode]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initialize = async () => {
      try {
        if (legacyToken) {
          const saved = getRoomByHostToken(legacyToken);
          if (saved) {
            applyRoom(saved);
            navigate({
              view: APP_VIEW.WELCOME,
              role: APP_ROLE.HOST,
            });
            return;
          }

          try {
            const details = await fetchHostRoomDetails(legacyToken);
            if (details.participantToken) {
              const restored = {
                roomId: details.roomId,
                hostToken: legacyToken,
                participantToken: details.participantToken,
                joinCode: details.joinCode ?? null,
                createdAt: details.createdAt ?? Date.now(),
              };
              persistRoom(restored);
              applyRoom(restored);
              navigate({
                view: APP_VIEW.WELCOME,
                role: APP_ROLE.HOST,
              });
              return;
            }
          } catch {
            // fall through to active room or create
          }
        }

        const saved = getSavedRoom(legacyToken);
        if (saved?.hostToken) {
          applyRoom(saved);
          return;
        }

        setIsActionPending(true);
        const created = await createRoom();
        persistRoom(created);
        applyRoom(created);
        navigate({
          view: APP_VIEW.WELCOME,
          role: APP_ROLE.HOST,
        });
      } finally {
        setInitializing(false);
        setIsActionPending(false);
        refreshRecentRooms();
      }
    };

    void initialize();
  }, [
    applyRoom,
    createRoom,
    getSavedRoom,
    navigate,
    persistRoom,
    refreshRecentRooms,
    legacyToken,
  ]);

  const formattedJoinCode = joinCode ? formatJoinCode(joinCode) : "";
  const inviteLink = joinCode ? buildParticipantInviteLink(joinCode) : "";

  const handleCopyJoinCode = async () => {
    if (!formattedJoinCode) return;
    const copied = await copyTextToClipboard(formattedJoinCode);
    setCopyMessage(
      copied ? "Join code copied" : "Could not copy participant join code",
    );
    setTimeout(() => setCopyMessage(""), 2500);
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    const copied = await copyTextToClipboard(inviteLink);
    setCopyMessage(copied ? "Link copied" : "Could not copy link");
    setTimeout(() => setCopyMessage(""), 2500);
  };

  const handleGenerateRoom = async () => {
    setCopyMessage("");
    setIsActionPending(true);
    try {
      const created = await createRoom();
      persistRoom(created);
      applyRoom(created);
      navigate({
        view: APP_VIEW.WELCOME,
        role: APP_ROLE.HOST,
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSelectRoom = (room) => {
    setCopyMessage("");
    persistRoom(room);
    applyRoom(room);
    navigate({
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.HOST,
    });
  };

  const handleDisplayNameChange = (value) => {
    const normalized = normalizeDisplayNameInput(value);
    setDisplayName(normalized);
    saveDisplayName(normalized);
  };

  const handleJoinMeeting = () => {
    if (!hostToken) return;
    markHostRoomUsed(hostToken);
    refreshRecentRooms();
    navigate({
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: hostToken,
    });
  };

  const handleClearRecentRooms = () => {
    clearHostRooms();
    refreshRecentRooms();
  };

  if (initializing && !hostToken) {
    return (
      <div className={shared.waiting}>
        <div className={shared.spinner} aria-hidden />
        <p className={shared.helpText}>Preparing your room…</p>
      </div>
    );
  }

  return (
    <div className={shared.welcomePanel}>
      <p className={shared.helpText}>
        Share the participant join code or invite link with attendees, then join
        the meeting when you are ready.
      </p>

      <RecentRoomsTrigger
        rooms={recentRooms}
        activeToken={hostToken}
        tokenKey="hostToken"
        formatLabel={(room) =>
          room.joinCode
            ? `${formatRoomLabel(room)} · ${formatJoinCode(room.joinCode)}`
            : formatRoomLabel(room)
        }
        onSelect={handleSelectRoom}
        onClear={handleClearRecentRooms}
        emptyMessage="Rooms you create will appear here for quick reuse."
      />

      <DisplayNameField
        id="host-display-name"
        label="Your name"
        value={displayName}
        onChange={handleDisplayNameChange}
        placeholder="How should participants see you?"
      />

      <div className={shared.fieldGroup}>
        <label className={shared.label} htmlFor="participant-join-code">
          Participant join code
        </label>
        <div className={shared.linkRow}>
          <input
            id="participant-join-code"
            className={shared.linkInput}
            readOnly
            value={formattedJoinCode}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={shared.button}
            onClick={handleCopyJoinCode}
            disabled={!formattedJoinCode}
          >
            Copy
          </button>
        </div>
        <p className={shared.helpText}>
          Participants use this code to join. It cannot be used to host the
          meeting.
        </p>
      </div>

      <div className={shared.fieldGroup}>
        <label className={shared.label} htmlFor="invite-link">
          Participant invite link
        </label>
        <div className={shared.linkRow}>
          <input
            id="invite-link"
            className={shared.linkInput}
            readOnly
            value={inviteLink}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={shared.button}
            onClick={handleCopyLink}
            disabled={!inviteLink}
          >
            Copy
          </button>
        </div>
        <div className={shared.feedbackSlot} aria-live="polite">
          {copyMessage
            ? <span className={shared.copySuccess}>{copyMessage}</span>
            : null}
        </div>
      </div>

      <div className={shared.actions}>
        <button
          type="button"
          className={shared.button}
          onClick={handleJoinMeeting}
          disabled={!hostToken || isActionPending}
        >
          Join meeting
        </button>
        <button
          type="button"
          className={`${shared.button} ${shared.buttonSecondary}`}
          onClick={handleGenerateRoom}
          disabled={isActionPending}
        >
          Generate new room
        </button>
      </div>

      <div className={shared.statusArea} aria-live="polite">
        {error ? <p className={shared.statusError}>{error}</p> : null}
        {isActionPending ? <p className={shared.status}>Working…</p> : null}
      </div>
    </div>
  );
}

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
  removeHostRoomByToken,
  updateRoomTitle,
} from "@/lib/settings/roomSettings";
import { JoinCodeBoxes } from "./JoinCodeBoxes";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import { Copy as CopyIcon } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import hs from "./WelcomeHostPanel.module.css";
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
  const [sessionTitle, setSessionTitle] = useState("");
  const initRef = useRef(false);

  const refreshRecentRooms = useCallback(() => {
    setRecentRooms(listHostRooms());
  }, []);

  const applyRoom = useCallback(
    (room) => {
      setHostToken(room.hostToken);
      setJoinCode(room.joinCode ?? null);
      setSessionTitle(room.title ?? "");
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

  const handleSessionTitleChange = (value) => {
    setSessionTitle(value);
    if (hostToken) updateRoomTitle(hostToken, value);
  };

  const handleDisplayNameChange = (value) => {
    const normalized = normalizeDisplayNameInput(value);
    setDisplayName(normalized);
    saveDisplayName(normalized);
  };

  const handleJoinMeeting = () => {
    if (!hostToken) return;
    markHostRoomUsed(hostToken);
    if (sessionTitle) updateRoomTitle(hostToken, sessionTitle);
    refreshRecentRooms();
    navigate({
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: hostToken,
    });
  };

  const handleRemoveRoom = (room) => {
    if (room.hostToken) removeHostRoomByToken(room.hostToken);
    refreshRecentRooms();
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
      <div className={hs.codeSection}>
        <span className={hs.codeLabel}>Share this code</span>
        <JoinCodeBoxes value={formattedJoinCode} readOnly />
        <div className={hs.copyRow}>
          <button
            type="button"
            className={shared.button}
            onClick={handleCopyJoinCode}
            disabled={!formattedJoinCode}
          >
            {copyMessage || "Copy code"}
          </button>
        </div>
      </div>

      <div className={hs.titleField}>
        <label className={shared.label} htmlFor="session-title">
          Session title
        </label>
        <input
          id="session-title"
          className={hs.titleInput}
          value={sessionTitle}
          onChange={(e) => handleSessionTitleChange(e.target.value)}
          placeholder="e.g. Weekly Standup"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
        />
        <p className={shared.helpText}>Used as the recording file name.</p>
      </div>

      <DisplayNameField
        id="host-display-name"
        label="Your name"
        value={displayName}
        onChange={handleDisplayNameChange}
        placeholder="How should participants see you?"
      />

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
          onRemove={handleRemoveRoom}
          emptyMessage="Rooms you create will appear here for quick reuse."
        />
      </div>

      <details className={hs.details}>
        <summary className={hs.summary}>Invite link</summary>
        <div className={hs.detailsContent}>
          <div className={shared.fieldGroup}>
            <div className={shared.linkRow}>
              <input
                id="invite-link"
                className={shared.linkInput}
                readOnly
                value={inviteLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Tooltip text={copyMessage || "Copy invite link"} placement="top">
                <button
                  type="button"
                  className={`${shared.button} ${shared.iconButton}`}
                  onClick={handleCopyLink}
                  disabled={!inviteLink}
                  aria-label="Copy invite link"
                >
                  <CopyIcon size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </details>

      <div className={shared.statusArea} aria-live="polite">
        {error ? <p className={shared.statusError}>{error}</p> : null}
        {isActionPending ? <p className={shared.status}>Working…</p> : null}
      </div>
    </div>
  );
}

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
  const [activeShareTab, setActiveShareTab] = useState("link");
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
    setCopyMessage(copied ? "Copied!" : "Could not copy");
    setTimeout(() => setCopyMessage(""), 2500);
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    const copied = await copyTextToClipboard(inviteLink);
    setCopyMessage(copied ? "Copied!" : "Could not copy");
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
        <p className={shared.helpText}>Creating a room you can share…</p>
      </div>
    );
  }

  return (
    <div className={shared.welcomePanel}>
      <div className={shared.panelIntro}>
        <h2 className={shared.panelTitle}>Host a session</h2>
        <p className={shared.panelText}>
          Your room is ready. Share the invite, name the session, then start
          presenting.
        </p>
      </div>

      <div className={hs.shareSection}>
        <div
          className={shared.shareTabs}
          role="tablist"
          aria-label="Sharing options"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeShareTab === "link"}
            className={`${shared.shareTab} ${activeShareTab === "link" ? shared.shareTabActive : ""}`}
            onClick={() => setActiveShareTab("link")}
          >
            Invite link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeShareTab === "code"}
            className={`${shared.shareTab} ${activeShareTab === "code" ? shared.shareTabActive : ""}`}
            onClick={() => setActiveShareTab("code")}
          >
            Room code
          </button>
          <div
            className={shared.shareTabPill}
            style={{
              transform: `translateX(${activeShareTab === "link" ? "0%" : "100%"})`,
            }}
          />
        </div>

        <div className={shared.shareContentArea} key={activeShareTab}>
          <div className={shared.sharePane}>
            {activeShareTab === "link"
              ? <>
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
                    {copyMessage || "Copy invite link"}
                  </button>
                </>
              : <>
                  <JoinCodeBoxes value={formattedJoinCode} readOnly />
                  <button
                    type="button"
                    className={shared.button}
                    onClick={handleCopyJoinCode}
                    disabled={!formattedJoinCode}
                  >
                    {copyMessage || "Copy room code"}
                  </button>
                </>}
          </div>
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
        <p className={shared.helpText}>
          This also becomes the default recording file name.
        </p>
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
          Start meeting
        </button>
        <div className={shared.actionsRowSecondary}>
          <button
            type="button"
            className={`${shared.button} ${shared.buttonSecondary}`}
            onClick={handleGenerateRoom}
            disabled={isActionPending}
          >
            New room
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
      </div>

      <div className={shared.statusArea} aria-live="polite">
        {error ? <p className={shared.statusError}>{error}</p> : null}
        {isActionPending ? <p className={shared.status}>Working…</p> : null}
      </div>
    </div>
  );
}

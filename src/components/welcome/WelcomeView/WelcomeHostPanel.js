"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { useRoomSession, useRoomSettings } from "@/hooks/roomSession";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "@/lib/room/joinCodeFormat";
import { MAX_PARTICIPANT_CONNECTIONS } from "@/lib/room/peerLimits.mjs";
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
import { HostRoomSharing } from "./HostRoomSharing";
import { HostSessionDetails } from "./HostSessionDetails";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import shared from "./WelcomeShared.module.css";

export function WelcomeHostPanel({ legacyToken, navigate }) {
  const { getSavedRoom, persistRoom, markHostRoomUsed } = useRoomSettings();
  const [hostToken, setHostToken] = useState(null);
  const [joinCode, setJoinCode] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [roomCreationError, setRoomCreationError] = useState("");
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
      const normalizedJoinCode = normalizeJoinCode(room.joinCode ?? "");
      setJoinCode(
        isValidJoinCode(normalizedJoinCode) ? normalizedJoinCode : null,
      );
      setSessionTitle(room.title ?? "");
      markHostRoomUsed(room.hostToken);
      refreshRecentRooms();
    },
    [markHostRoomUsed, refreshRecentRooms],
  );

  const { error, status, createRoom, roomState } = useRoomSession({
    role: APP_ROLE.HOST,
    token: hostToken,
    enabled: Boolean(hostToken),
  });

  const createAndApplyRoom = useCallback(async () => {
    const created = await createRoom();
    persistRoom(created);
    applyRoom(created);
    setRoomCreationError("");
    navigate({
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.HOST,
    });
  }, [applyRoom, createRoom, navigate, persistRoom]);

  useEffect(() => {
    const normalizedJoinCode = normalizeJoinCode(roomState?.joinCode ?? "");
    if (!isValidJoinCode(normalizedJoinCode)) return;
    setJoinCode((current) =>
      current === normalizedJoinCode ? current : normalizedJoinCode,
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
        }

        const saved = getSavedRoom(legacyToken);
        if (saved?.hostToken) {
          applyRoom(saved);
          return;
        }

        setIsActionPending(true);
        await createAndApplyRoom();
      } catch (createError) {
        setRoomCreationError(
          createError.message ||
            "[E020] Failed to create a room with a valid room code",
        );
      } finally {
        setInitializing(false);
        setIsActionPending(false);
        refreshRecentRooms();
      }
    };

    void initialize();
  }, [
    applyRoom,
    createAndApplyRoom,
    getSavedRoom,
    navigate,
    refreshRecentRooms,
    legacyToken,
  ]);

  const formattedJoinCode = isValidJoinCode(joinCode)
    ? formatJoinCode(joinCode)
    : "";
  const hasValidJoinCode = isValidJoinCode(joinCode);
  const inviteLink = hasValidJoinCode
    ? buildParticipantInviteLink(joinCode)
    : "";

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
    setRoomCreationError("");
    setIsActionPending(true);
    try {
      await createAndApplyRoom();
    } catch (createError) {
      setRoomCreationError(
        createError.message ||
          "[E020] Failed to create a room with a valid room code",
      );
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
    if (!hostToken || !hasValidJoinCode || isActionPending) return;
    setIsActionPending(true);
    markHostRoomUsed(hostToken);
    if (sessionTitle) updateRoomTitle(hostToken, sessionTitle);
    refreshRecentRooms();

    setIsActionPending(false);
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
        <h2 className={shared.panelTitle}>
          {hostToken ? "Host a session" : "Create a room"}
        </h2>
        <p className={shared.panelText}>
          {hostToken
            ? "Your room is ready. Share the invite, name the session, then start presenting."
            : "Create a room to get a shareable invite and room code."}
        </p>
      </div>

      <HostRoomSharing
        activeShareTab={activeShareTab}
        setActiveShareTab={setActiveShareTab}
        inviteLink={inviteLink}
        formattedJoinCode={formattedJoinCode}
        copyMessage={copyMessage}
        handleCopyLink={handleCopyLink}
        handleCopyJoinCode={handleCopyJoinCode}
      />

      <HostSessionDetails
        sessionTitle={sessionTitle}
        handleSessionTitleChange={handleSessionTitleChange}
        displayName={displayName}
        handleDisplayNameChange={handleDisplayNameChange}
      />

      <div className={shared.actions}>
        <p className={shared.helpText}>
          Invite up to {MAX_PARTICIPANT_CONNECTIONS} participants.
        </p>
        <button
          type="button"
          className={shared.button}
          onClick={handleJoinMeeting}
          disabled={!hostToken || !hasValidJoinCode || isActionPending}
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
            {hostToken ? "New room" : "Create room"}
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
        {roomCreationError || error
          ? <p className={shared.statusError}>{roomCreationError || error}</p>
          : null}
        {hostToken && !hasValidJoinCode && !error
          ? <p className={shared.status}>
              {status === "loading"
                ? "Checking this room’s code…"
                : "This room has no valid code. Create a new room to continue."}
            </p>
          : null}
        {isActionPending ? <p className={shared.status}>Working…</p> : null}
      </div>
    </div>
  );
}

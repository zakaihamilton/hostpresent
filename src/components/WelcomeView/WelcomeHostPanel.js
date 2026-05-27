"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_ROLE, APP_VIEW } from "@/hooks/useHashRouter";
import { useRoomSession, useRoomSettings } from "@/hooks/useRoomSession";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  clearHostRooms,
  formatRoomLabel,
  getRoomByHostToken,
  getRoomByJoinCode,
  listHostRooms,
} from "@/lib/settings/roomSettings";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";
import shared from "./WelcomeShared.module.css";

async function fetchHostRoomDetails(hostToken) {
  const response = await fetch(
    `/api/rooms/state?token=${encodeURIComponent(hostToken)}`,
  );
  if (!response.ok) {
    throw new Error("Could not load room");
  }
  return response.json();
}

export function WelcomeHostPanel({ joinCode: routeJoinCode, legacyToken, navigate }) {
  const { getSavedRoom, persistRoom, markHostRoomUsed } = useRoomSettings();
  const [hostToken, setHostToken] = useState(null);
  const [joinCode, setJoinCode] = useState(routeJoinCode ?? null);
  const [copyMessage, setCopyMessage] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
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

  const { error, createRoom, openRoom, roomState } = useRoomSession({
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
        if (routeJoinCode) {
          const saved = getRoomByJoinCode(routeJoinCode);
          if (saved) {
            applyRoom(saved);
            return;
          }
        }

        if (legacyToken) {
          const saved = getRoomByHostToken(legacyToken);
          if (saved) {
            applyRoom(saved);
            navigate({
              view: APP_VIEW.WELCOME,
              role: APP_ROLE.HOST,
              joinCode: saved.joinCode,
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
                joinCode: restored.joinCode,
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
          if (!routeJoinCode) {
            navigate({
              view: APP_VIEW.WELCOME,
              role: APP_ROLE.HOST,
              joinCode: saved.joinCode,
            });
          }
          return;
        }

        setIsActionPending(true);
        const created = await createRoom();
        persistRoom(created);
        applyRoom(created);
        navigate({
          view: APP_VIEW.WELCOME,
          role: APP_ROLE.HOST,
          joinCode: created.joinCode,
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
    routeJoinCode,
  ]);

  useEffect(() => {
    if (!routeJoinCode || routeJoinCode === joinCode) return;

    const saved = getRoomByJoinCode(routeJoinCode);
    if (saved) {
      applyRoom(saved);
    }
  }, [applyRoom, joinCode, routeJoinCode]);

  const formattedRoomId = joinCode ? formatJoinCode(joinCode) : "";
  const inviteLink = joinCode ? buildParticipantInviteLink(joinCode) : "";

  const handleCopyRoomId = async () => {
    if (!formattedRoomId) return;
    try {
      await navigator.clipboard.writeText(formattedRoomId);
      setCopyMessage("Room ID copied to clipboard");
      setTimeout(() => setCopyMessage(""), 2500);
    } catch {
      setCopyMessage("Could not copy room ID");
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyMessage("Link copied to clipboard");
      setTimeout(() => setCopyMessage(""), 2500);
    } catch {
      setCopyMessage("Could not copy link");
    }
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
        joinCode: created.joinCode,
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
      joinCode: room.joinCode,
    });
  };

  const handleOpenRoom = async () => {
    if (!hostToken) return;
    markHostRoomUsed(hostToken);
    refreshRecentRooms();
    setIsActionPending(true);
    try {
      await openRoom(hostToken);
      navigate({
        view: APP_VIEW.MEETING,
        role: APP_ROLE.HOST,
        joinCode,
      });
    } finally {
      setIsActionPending(false);
    }
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
        Share the invite link with participants. Open the room when you are
        ready to start.
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

      <div className={shared.fieldGroup}>
        <label className={shared.label} htmlFor="room-id">
          Room ID
        </label>
        <div className={shared.linkRow}>
          <input
            id="room-id"
            className={shared.linkInput}
            readOnly
            value={formattedRoomId}
          />
          <button
            type="button"
            className={shared.button}
            onClick={handleCopyRoomId}
            disabled={!formattedRoomId}
          >
            Copy
          </button>
        </div>
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
          onClick={handleOpenRoom}
          disabled={!hostToken || isActionPending}
        >
          Open room
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

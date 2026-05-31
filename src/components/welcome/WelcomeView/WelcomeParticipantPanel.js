"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantModeToggle } from "@/components/meeting/ParticipantModeToggle";
import { DisplayNameField } from "@/components/ui/DisplayNameField";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import {
  extractJoinCodeFromInput,
  formatRoomIdInput,
  normalizeRoomIdInput,
  resolveJoinCode,
} from "@/lib/room/inviteLink";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
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
  navigateJoinCode: _navigateJoinCode,
  navigateParticipantWelcome: _navigateParticipantWelcome,
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
  const [activeJoinTab, setActiveJoinTab] = useState(() =>
    joinCode ? "code" : "link",
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

    setResolveError(
      "[E051] Enter a valid participant join code or invite link.",
    );
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

  const allFilled = (roomIdInput ?? "").replace(/-/g, "").length === 6;

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
      {/* Join method — segmented tabs matching host panel design */}
      <div className={ps.joinSection}>
        <div
          className={shared.shareTabs}
          role="tablist"
          aria-label="Join method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeJoinTab === "link"}
            className={`${shared.shareTab} ${activeJoinTab === "link" ? shared.shareTabActive : ""}`}
            onClick={() => setActiveJoinTab("link")}
          >
            Invite Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeJoinTab === "code"}
            className={`${shared.shareTab} ${activeJoinTab === "code" ? shared.shareTabActive : ""}`}
            onClick={() => setActiveJoinTab("code")}
          >
            Room Code
          </button>
          <div
            className={shared.shareTabPill}
            style={{
              transform: `translateX(${activeJoinTab === "link" ? "0%" : "100%"})`,
            }}
          />
        </div>

        <div className={shared.shareContentArea} key={activeJoinTab}>
          <div className={shared.sharePane}>
            {activeJoinTab === "link"
              ? <>
                  <input
                    id="participant-invite-link"
                    className={shared.linkInput}
                    value={inviteLinkInput}
                    onChange={(event) => setInviteLinkInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleJoinInviteLink();
                    }}
                    placeholder="Paste invite link here…"
                  />
                  <p className={ps.joinHint}>
                    Paste the full URL shared by the host
                  </p>
                </>
              : <>
                  <JoinCodeBoxes
                    value={roomIdInput}
                    onChange={setRoomIdInput}
                    autoFocus
                  />
                  <p className={ps.joinHint}>
                    Enter the 6-character code shared by the host
                  </p>
                </>}
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
          onClick={
            activeJoinTab === "code" ? handleJoinRoomId : handleJoinInviteLink
          }
          disabled={
            activeJoinTab === "code" ? !allFilled : !inviteLinkInput.trim()
          }
        >
          Join meeting
        </button>
        {recentRoomsTrigger}
      </div>
    </div>
  );
}

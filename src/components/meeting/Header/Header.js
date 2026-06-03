"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/routing/BackButton";
import { Edit, Link, Logo, Stop, X } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./Header.module.css";

export const Header = memo(function Header({
  meetingDurationSeconds,
  roomId,
  sessionTitle,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  onBack,
  backLabel = "Back",
  onShowInviteLink = null,
  onSessionTitleChange = null,
  revealTitleOnLogoClick = false,
  onEndMeeting = null,
}) {
  const [roomIdCopyMessage, setRoomIdCopyMessage] = useState("");
  const roomIdCopyTimerRef = useRef(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(sessionTitle || "");
  const inputRef = useRef(null);

  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const renameInputRef = useRef(null);
  const meetingName = sessionTitle || "Host Present";

  useEffect(() => {
    setEditedTitle(sessionTitle || "");
  }, [sessionTitle]);

  const handleTitleClick = useCallback(() => {
    if (onSessionTitleChange) {
      setIsEditingTitle(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [onSessionTitleChange]);

  const handleTitleSubmit = useCallback(() => {
    setIsEditingTitle(false);
    const trimmed = editedTitle.trim();
    if (trimmed !== (sessionTitle || "")) {
      onSessionTitleChange(trimmed);
    } else {
      setEditedTitle(sessionTitle || "");
    }
  }, [editedTitle, sessionTitle, onSessionTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleTitleSubmit();
      } else if (e.key === "Escape") {
        setIsEditingTitle(false);
        setEditedTitle(sessionTitle || "");
      }
    },
    [handleTitleSubmit, sessionTitle],
  );

  const handleOpenRenamePopup = useCallback(() => {
    setEditedTitle(sessionTitle || "");
    setIsRenamePopupOpen(true);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [sessionTitle]);

  const handleCloseRenamePopup = useCallback(() => {
    setIsRenamePopupOpen(false);
    setEditedTitle(sessionTitle || "");
  }, [sessionTitle]);

  const handleRenamePopupSubmit = useCallback(() => {
    setIsRenamePopupOpen(false);
    const trimmed = editedTitle.trim();
    if (trimmed !== (sessionTitle || "")) {
      onSessionTitleChange(trimmed);
    } else {
      setEditedTitle(sessionTitle || "");
    }
  }, [editedTitle, sessionTitle, onSessionTitleChange]);

  const handleRenamePopupKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleRenamePopupSubmit();
      } else if (e.key === "Escape") {
        handleCloseRenamePopup();
      }
    },
    [handleRenamePopupSubmit, handleCloseRenamePopup],
  );

  useEffect(
    () => () => {
      if (roomIdCopyTimerRef.current) {
        clearTimeout(roomIdCopyTimerRef.current);
      }
    },
    [],
  );

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) return;

    if (roomIdCopyTimerRef.current) {
      clearTimeout(roomIdCopyTimerRef.current);
    }

    const copied = await copyTextToClipboard(roomId);
    setRoomIdCopyMessage(copied ? "Copied!" : "Copy failed");

    roomIdCopyTimerRef.current = setTimeout(() => {
      setRoomIdCopyMessage("");
      roomIdCopyTimerRef.current = null;
    }, 2500);
  }, [roomId]);

  const roomIdButtonLabel = roomIdCopyMessage || roomId;
  const roomIdButtonClassName = [
    styles.roomIdCopyButton,
    roomIdCopyMessage === "Copied!" && styles.roomIdCopyButtonSuccess,
    roomIdCopyMessage === "Copy failed" && styles.roomIdCopyButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  const logoIcon = <Logo />;

  return (
    <header
      className={`${styles.header} ${isRecording ? styles.headerRecording : ""}`}
    >
      <div className={styles.leading}>
        {onBack ? <BackButton label={backLabel} onClick={onBack} /> : null}
        <div className={styles.logo}>
          {revealTitleOnLogoClick
            ? <>
                <span className={styles.logoTooltipNarrow}>
                  <Tooltip
                    text={meetingName}
                    placement="bottom"
                    trigger="click"
                  >
                    <button
                      type="button"
                      className={`${styles.logoButton} ${styles.logoIconContainer}`}
                      aria-label={`Meeting name, ${meetingName}`}
                    >
                      {logoIcon}
                    </button>
                  </Tooltip>
                </span>
                <span className={styles.logoTextParticipantInline}>
                  {meetingName}
                </span>
              </>
            : <Tooltip text={meetingName} placement="bottom">
                <span className={styles.logoIconContainer} aria-hidden>
                  {logoIcon}
                </span>
              </Tooltip>}
          {onSessionTitleChange
            ? isEditingTitle
              ? <input
                  ref={inputRef}
                  type="text"
                  className={styles.logoTitleInput}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  maxLength={50}
                  placeholder="Meeting name"
                  aria-label="Rename meeting"
                />
              : <>
                  <span
                    className={`${styles.logoText} ${styles.logoTextVisible} ${styles.logoTextEditable}`}
                    onClick={handleTitleClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleTitleClick();
                      }
                    }}
                    title="Click to rename meeting"
                  >
                    <span className={styles.logoTextLabel}>{meetingName}</span>
                    <span className={styles.editIconWrapper}>
                      <Edit size={14} className={styles.editIcon} />
                    </span>
                  </span>
                  <Tooltip text="Rename meeting" placement="bottom">
                    <button
                      type="button"
                      className={styles.mobileEditButton}
                      onClick={handleOpenRenamePopup}
                      aria-label="Rename meeting"
                    >
                      <Edit size={15} />
                    </button>
                  </Tooltip>
                </>
            : null}
        </div>
      </div>

      <div className={styles.meta}>
        {onShowInviteLink
          ? <Tooltip
              text={
                roomId ? "Show invite link & room code" : "Show invite link"
              }
              placement="bottom"
            >
              <button
                type="button"
                className={styles.iconButton}
                onClick={onShowInviteLink}
                aria-label={
                  roomId ? "Show invite link and room code" : "Show invite link"
                }
              >
                <Link size={18} />
              </button>
            </Tooltip>
          : null}

        {roomId
          ? <div className={`${styles.stat} ${styles.statRoom}`}>
              <span className={styles.statLabel}>Join code</span>
              <Tooltip text="Copy join code" placement="bottom">
                <button
                  type="button"
                  className={roomIdButtonClassName}
                  onClick={handleCopyRoomId}
                  aria-live="polite"
                  aria-label={
                    roomIdCopyMessage
                      ? roomIdCopyMessage
                      : `Copy join code ${roomId}`
                  }
                >
                  <span className={styles.roomIdValue}>
                    {roomIdButtonLabel}
                  </span>
                </button>
              </Tooltip>
            </div>
          : null}

        <div className={styles.stat}>
          <span className={styles.statLabel}>Meeting</span>
          <span className={styles.statValue}>
            {formatDuration(meetingDurationSeconds)}
          </span>
        </div>

        {isRecording && (
          <output
            className={`${styles.recordingBadge} ${isRecordingPaused ? styles.recordingPaused : ""}`}
            aria-live="polite"
          >
            <span className={styles.recordingDot} aria-hidden />
            <span className={styles.recordingLabel}>
              {isRecordingPaused ? "REC Paused" : "Recording"}
            </span>
            <span className={styles.recordingTime}>
              {formatDuration(recordingDurationSeconds)}
            </span>
          </output>
        )}

        {onEndMeeting
          ? <Tooltip text="End meeting for everyone" placement="bottom">
              <button
                type="button"
                className={`${styles.iconButton} ${styles.endMeetingButton}`}
                onClick={onEndMeeting}
                aria-label="End meeting"
              >
                <Stop size={18} />
              </button>
            </Tooltip>
          : null}

        <ThemeToggle className={styles.iconButton} />
      </div>

      {isRenamePopupOpen && (
        <>
          <div
            className={styles.renamePopupOverlay}
            onClick={handleCloseRenamePopup}
            aria-hidden
          />
          <div
            className={styles.renamePopup}
            role="dialog"
            aria-modal="true"
            aria-label="Rename meeting"
          >
            <div className={styles.renamePopupHeader}>
              <span className={styles.renamePopupTitle}>Rename meeting</span>
              <Tooltip text="Close" placement="bottom">
                <button
                  type="button"
                  className={styles.renamePopupClose}
                  onClick={handleCloseRenamePopup}
                  aria-label="Close rename dialog"
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>
            <input
              id="meeting-rename-input"
              ref={renameInputRef}
              type="text"
              className={styles.renamePopupInput}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleRenamePopupKeyDown}
              maxLength={50}
              placeholder="Meeting name"
              aria-label="New meeting name"
            />
            <div className={styles.renamePopupActions}>
              <button
                type="button"
                className={styles.renamePopupCancel}
                onClick={handleCloseRenamePopup}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.renamePopupSave}
                onClick={handleRenamePopupSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
});

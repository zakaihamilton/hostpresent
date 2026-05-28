"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Link, Logo } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip } from "@/components/Tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./Header.module.css";

export function Header({
  meetingDurationSeconds,
  roomId,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  onBack,
  backLabel = "Back",
  onShowInviteLink = null,
}) {
  const [roomIdCopyMessage, setRoomIdCopyMessage] = useState("");
  const roomIdCopyTimerRef = useRef(null);

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

  return (
    <header
      className={`${styles.header} ${isRecording ? styles.headerRecording : ""}`}
    >
      <div className={styles.leading}>
        {onBack ? <BackButton label={backLabel} onClick={onBack} /> : null}
        <div className={styles.logo}>
          <Logo />
          <span className={styles.logoText}>Host Present</span>
        </div>
      </div>

      <div className={styles.meta}>
        {onShowInviteLink
          ? <Tooltip text="Show invite link" placement="left">
              <button
                type="button"
                className={styles.iconButton}
                onClick={onShowInviteLink}
                aria-label="Show invite link"
              >
                <Link size={18} />
              </button>
            </Tooltip>
          : null}

        {roomId
          ? <div className={`${styles.stat} ${styles.statRoom}`}>
              <span className={styles.statLabel}>Join code</span>
              <Tooltip text="Copy join code" placement="left">
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

        <ThemeToggle className={styles.iconButton} />
      </div>
    </header>
  );
}

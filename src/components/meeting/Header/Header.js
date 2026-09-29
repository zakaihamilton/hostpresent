"use client";

import { memo } from "react";
import { Link } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./Header.module.css";
import { JoinCodeControl } from "./JoinCodeControl";
import { MeetingTitle } from "./MeetingTitle";
import { RecordingControls } from "./RecordingControls";

export const Header = memo(function Header({
  meetingDurationSeconds,
  roomId,
  sessionTitle,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  onShowInviteLink = null,
  onSessionTitleChange = null,
  revealTitleOnLogoClick = false,
  showRecording = false,
  onStartRecording = null,
  onPauseRecording = null,
  onResumeRecording = null,
  onStopRecording = null,
}) {
  return (
    <header
      className={`${styles.header} ${isRecording ? styles.headerRecording : ""}`}
    >
      <MeetingTitle
        sessionTitle={sessionTitle}
        onSessionTitleChange={onSessionTitleChange}
        revealTitleOnLogoClick={revealTitleOnLogoClick}
      />

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

        <JoinCodeControl roomId={roomId} />

        <div className={styles.stat}>
          <span className={styles.statLabel}>Meeting</span>
          <span className={styles.statValue}>
            {formatDuration(meetingDurationSeconds)}
          </span>
        </div>

        <RecordingControls
          {...{
            showRecording,
            isRecording,
            isRecordingPaused,
            recordingDurationSeconds,
            onStartRecording,
            onPauseRecording,
            onResumeRecording,
            onStopRecording,
          }}
        />

        <ThemeToggle className={styles.iconButton} />
      </div>
    </header>
  );
});

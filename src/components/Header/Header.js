import { Link, Logo } from "@/components/Icons";
import { BackButton } from "@/components/BackButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip } from "@/components/Tooltip";
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
              <span className={styles.statLabel}>Room ID</span>
              <span className={styles.statValue} title={roomId}>
                {roomId}
              </span>
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

import { Logo } from "@/components/Icons";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./Header.module.css";

export function Header({
  timeString,
  meetingDurationSeconds,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
}) {
  return (
    <header
      className={`${styles.header} ${isRecording ? styles.headerRecording : ""}`}
    >
      <div className={styles.logo}>
        <Logo />
        <span className={styles.logoText}>Host Present</span>
      </div>

      <div className={styles.meta}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Meeting</span>
          <span className={styles.statValue}>
            {formatDuration(meetingDurationSeconds)}
          </span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>Clock</span>
          <span className={styles.statValue}>{timeString}</span>
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
      </div>
    </header>
  );
}

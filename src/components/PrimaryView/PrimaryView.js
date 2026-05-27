import { VideoPlayer } from "@/components/VideoPlayer";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./PrimaryView.module.css";

export function PrimaryView({
  stream,
  label,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
}) {
  return (
    <div
      className={`${styles.primaryView} ${isRecording ? styles.recording : ""} ${isRecordingPaused ? styles.recordingPaused : ""}`}
    >
      {isRecording && (
        <div
          className={`${styles.recordingChrome} ${isRecordingPaused ? styles.recordingChromePaused : ""}`}
          aria-hidden
        />
      )}

      {isRecording && (
        <output className={styles.recordingStatus} aria-live="polite">
          <span className={styles.recordingStatusDot} aria-hidden />
          <span className={styles.recordingStatusLabel}>
            {isRecordingPaused ? "REC PAUSED" : "REC"}
          </span>
          <span className={styles.recordingStatusTime}>
            {formatDuration(recordingDurationSeconds)}
          </span>
        </output>
      )}

      {stream && <VideoPlayer stream={stream} isMuted />}
      <div className={styles.overlay}>{label}</div>
    </div>
  );
}

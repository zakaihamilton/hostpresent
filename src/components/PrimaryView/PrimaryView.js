import { memo } from "react";
import { MicOff, VideoOff } from "@/components/Icons";
import { VideoPlayer } from "@/components/VideoPlayer";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./PrimaryView.module.css";

export const PrimaryView = memo(function PrimaryView({
  stream,
  label,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  isMuted = true,
  isAudioMuted = false,
  isVideoMuted = false,
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

      {stream && (
        <div className={styles.media}>
          <VideoPlayer stream={stream} isMuted={isMuted} />
        </div>
      )}
      <div className={styles.overlay}>
        {isAudioMuted ? <MicOff aria-hidden /> : null}
        {isVideoMuted ? <VideoOff aria-hidden /> : null}
        {label}
      </div>
    </div>
  );
});

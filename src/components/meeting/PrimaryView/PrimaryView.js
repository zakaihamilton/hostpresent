import { memo } from "react";
import { VideoPlayer } from "@/components/meeting/VideoPlayer";
import { MicOff, VideoOff } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
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
  audioOutputDeviceId = "",
  connectionStatus = null,
  onShowDiagnostics = null,
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

      {stream
        ? <div className={styles.media}>
            <VideoPlayer
              stream={stream}
              isMuted={isMuted}
              audioOutputDeviceId={audioOutputDeviceId}
            />
          </div>
        : <div className={styles.placeholder} aria-hidden>
            <div className={styles.placeholderIcon}>
              <VideoOff size={48} />
            </div>
            <span className={styles.placeholderText}>Camera Off</span>
          </div>}
      <div className={styles.overlay}>
        {connectionStatus && (
          <Tooltip
            text="Connection status (Click for Diagnostics)"
            placement="top"
          >
            <button
              type="button"
              className={styles.connectionBadge}
              onClick={onShowDiagnostics}
              aria-label="View connection diagnostics"
            >
              <span
                className={`${styles.connectionDot} ${styles[`connectionDot_${connectionStatus}`]}`}
              />
              <span className={styles.connectionStatusLabel}>
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Disconnected"}
              </span>
            </button>
          </Tooltip>
        )}
        {isAudioMuted ? <MicOff aria-hidden /> : null}
        {isVideoMuted ? <VideoOff aria-hidden /> : null}
        {label}
      </div>
    </div>
  );
});

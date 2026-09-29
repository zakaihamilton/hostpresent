import { Pause, Play, Stop } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatDuration } from "@/lib/formatDuration";
import styles from "./Header.module.css";

export function RecordingControls({
  showRecording,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
}) {
  return (
    <>
      {showRecording && (
        <div className={styles.recordingSection}>
          {!isRecording
            ? <Tooltip
                text="Record locally. Saves a video (.mp4) and separate audio (.m4a) file."
                placement="bottom"
              >
                <button
                  type="button"
                  className={styles.recordStartBtn}
                  onClick={onStartRecording}
                  aria-label="Start recording"
                >
                  <span className={styles.recordIndicatorDot} />
                  <span>Record</span>
                </button>
              </Tooltip>
            : <output
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
                <div className={styles.recordingActions}>
                  {isRecordingPaused
                    ? <Tooltip text="Resume Recording" placement="bottom">
                        <button
                          type="button"
                          className={styles.recordingActionBtn}
                          onClick={onResumeRecording}
                          aria-label="Resume recording"
                        >
                          <Play size={12} />
                        </button>
                      </Tooltip>
                    : <Tooltip text="Pause Recording" placement="bottom">
                        <button
                          type="button"
                          className={styles.recordingActionBtn}
                          onClick={onPauseRecording}
                          aria-label="Pause recording"
                        >
                          <Pause size={12} />
                        </button>
                      </Tooltip>}
                  <Tooltip text="Stop & Save Recording" placement="bottom">
                    <button
                      type="button"
                      className={`${styles.recordingActionBtn} ${styles.recordingActionBtnStop}`}
                      onClick={onStopRecording}
                      aria-label="Stop and save recording"
                    >
                      <Stop size={12} />
                    </button>
                  </Tooltip>
                </div>
              </output>}
        </div>
      )}

      {!showRecording && isRecording && (
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
    </>
  );
}

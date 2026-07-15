import { memo } from "react";
import styles from "./RecordingDownloadBanner.module.css";

const PHASE_LABELS = {
  initializing: "Preparing export engine…",
  preparing: "Stopping recording…",
  building: "Preparing your file…",
  remuxing: "Preparing media timeline…",
  encoding: "Encoding recording…",
  validating: "Validating recording…",
  writing: "Writing final files…",
  cancelled: "Recording export cancelled",
  saving: "Starting download…",
  warning: "Recording needs attention",
  complete: "Download complete",
};

export const RecordingDownloadBanner = memo(function RecordingDownloadBanner({
  downloadState,
  onDismiss,
}) {
  if (!downloadState) return null;

  const { phase, progress, filename } = downloadState;
  const label = PHASE_LABELS[phase] ?? "Processing recording…";
  const isComplete = phase === "complete";
  const isTerminal = isComplete || phase === "cancelled";

  return (
    <output
      className={`${styles.banner} ${isComplete ? styles.bannerComplete : ""}`}
      aria-live="polite"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.title}>{label}</span>
          {!isTerminal && (
            <span className={styles.percent}>{Math.round(progress)}%</span>
          )}
        </div>

        <div className={styles.track} aria-hidden>
          <div
            className={`${styles.fill} ${isComplete ? styles.fillComplete : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {filename && <span className={styles.filename}>{filename}</span>}

        {isComplete && (
          <span className={styles.hint}>
            Your browser downloads two files: a video (.mp4) and a separate
            audio track (.m4a).
          </span>
        )}
      </div>

      {isTerminal && (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </output>
  );
});

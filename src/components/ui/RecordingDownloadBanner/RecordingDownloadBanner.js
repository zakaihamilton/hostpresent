import { memo } from "react";
import styles from "./RecordingDownloadBanner.module.css";

const PHASE_LABELS = {
  preparing: "Stopping recording…",
  building: "Preparing your file…",
  saving: "Starting download…",
  complete: "Download started",
};

export const RecordingDownloadBanner = memo(function RecordingDownloadBanner({
  downloadState,
  onDismiss,
}) {
  if (!downloadState) return null;

  const { phase, progress, filename } = downloadState;
  const label = PHASE_LABELS[phase] ?? "Processing recording…";
  const isComplete = phase === "complete";

  return (
    <output
      className={`${styles.banner} ${isComplete ? styles.bannerComplete : ""}`}
      aria-live="polite"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.title}>{label}</span>
          {!isComplete && (
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
      </div>

      {isComplete && (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </output>
  );
});

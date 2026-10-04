import styles from "../MeetingView.module.css";

export function SavedRecordingBanner({
  canResume,
  busy = false,
  onDiscard,
  onDownload,
  onResume,
}) {
  return (
    <div className={styles.savedRecordingBanner}>
      <span>Recording was interrupted. Save the partial recording?</span>
      <div className={styles.savedRecordingActions}>
        <button
          type="button"
          className={styles.savedRecordingDownload}
          onClick={onResume}
          disabled={busy || !canResume}
        >
          Resume
        </button>
        <button
          type="button"
          className={styles.savedRecordingDownload}
          onClick={onDownload}
          disabled={busy}
        >
          Download
        </button>
        <button
          type="button"
          className={styles.savedRecordingDiscard}
          onClick={onDiscard}
          disabled={busy}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

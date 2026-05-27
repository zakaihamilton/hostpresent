import styles from "./MeetingJoinError.module.css";

export function MeetingJoinError({
  title = "Could not join meeting",
  message,
  hint = null,
  onBack,
  backLabel = "Back to welcome",
}) {
  return (
    <div className={styles.page}>
      <div className={styles.card} role="alert">
        <h1 className={styles.title}>{title}</h1>
        {message ? <p className={styles.message}>{message}</p> : null}
        {hint ? <p className={styles.hint}>{hint}</p> : null}
        {onBack
          ? <button type="button" className={styles.button} onClick={onBack}>
              {backLabel}
            </button>
          : null}
      </div>
    </div>
  );
}

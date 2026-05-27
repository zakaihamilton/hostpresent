import styles from "./MeetingLoading.module.css";

export function MeetingLoading({ message = "Joining meeting…" }) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}

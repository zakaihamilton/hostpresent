import styles from "./MeetingLoading.module.css";

export function MeetingLoading({ message = "Joining meeting…" }) {
  return (
    <output className={styles.page} aria-live="polite">
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden />
        <div className={styles.copy}>
          <p className={styles.message}>{message}</p>
          <p className={styles.detail}>
            Setting up the room, media controls, and secure session state.
          </p>
        </div>
      </div>
    </output>
  );
}

import { BackButton } from "@/components/BackButton";
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
        {onBack
          ? <div className={styles.topRow}>
              <BackButton label={backLabel} onClick={onBack} />
            </div>
          : null}
        <h1 className={styles.title}>{title}</h1>
        {message ? <p className={styles.message}>{message}</p> : null}
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
    </div>
  );
}

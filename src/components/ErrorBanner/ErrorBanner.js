import { memo } from "react";
import styles from "./ErrorBanner.module.css";

export const ErrorBanner = memo(function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
});

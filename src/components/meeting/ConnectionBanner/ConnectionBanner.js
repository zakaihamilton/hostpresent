import { memo } from "react";
import styles from "./ConnectionBanner.module.css";

export const ConnectionBanner = memo(function ConnectionBanner({
  isHost,
  hostPresent,
  connectionError,
  isWaitingForHost,
  isFatalConnectionError,
}) {
  return (
    <>
      {!isHost && !hostPresent && connectionError
        ? <output className={styles.hostWaitingBanner}>
            <p className={styles.hostWaitingText}>{connectionError}</p>
          </output>
        : null}

      {!isHost && !hostPresent && !connectionError
        ? <output className={styles.hostWaitingBanner}>
            <p className={styles.hostWaitingText}>
              Waiting for the host to start the session.
            </p>
          </output>
        : null}

      {connectionError &&
      !isHost &&
      !isWaitingForHost &&
      !isFatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>{connectionError}</p>
          </div>
        : null}

      {isHost &&
      connectionError &&
      !isFatalConnectionError &&
      !connectionError.includes("E007")
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>{connectionError}</p>
          </div>
        : null}
    </>
  );
});

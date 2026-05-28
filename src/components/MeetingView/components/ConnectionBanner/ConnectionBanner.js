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
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>{connectionError}</p>
          </div>
        : null}

      {!isHost && !hostPresent && !connectionError
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>
              Waiting for the host to join…
            </p>
          </div>
        : null}

      {connectionError &&
      !isHost &&
      !isWaitingForHost &&
      !isFatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>{connectionError}</p>
          </div>
        : null}

      {isHost && connectionError && !isFatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>{connectionError}</p>
          </div>
        : null}
    </>
  );
});

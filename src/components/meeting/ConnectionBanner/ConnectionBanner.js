import { memo } from "react";
import { isWaitingForParticipantsMessage } from "@/lib/webrtc/peerClient";
import styles from "./ConnectionBanner.module.css";

export const ConnectionBanner = memo(function ConnectionBanner({
  isHost,
  hostPresent,
  connectionError,
  isWaitingForHost,
  isFatalConnectionError,
  activeConnectionsCount = 0,
}) {
  const isWaitingForParticipants =
    isHost &&
    activeConnectionsCount === 0 &&
    isWaitingForParticipantsMessage(connectionError);

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

      {isWaitingForParticipants
        ? <output
            className={styles.hostWaitingBanner}
            role="status"
          >
            <p className={styles.hostWaitingText}>
              Waiting for participants to join.
            </p>
          </output>
        : null}

      {isHost &&
      connectionError &&
      !isFatalConnectionError &&
      !isWaitingForParticipants
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>{connectionError}</p>
          </div>
        : null}
    </>
  );
});

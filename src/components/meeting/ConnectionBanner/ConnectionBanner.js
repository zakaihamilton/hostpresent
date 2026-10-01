import { memo, useEffect, useState } from "react";
import { AUDIO_PLAYBACK_BLOCKED_EVENT } from "@/lib/webrtc/audioPlayback";
import { isWaitingForParticipantsMessage } from "@/lib/webrtc/peerClient";
import styles from "./ConnectionBanner.module.css";

export const ConnectionBanner = memo(function ConnectionBanner({
  isHost,
  hostPresent,
  connectionError,
  isWaitingForHost,
  isFatalConnectionError,
  activeConnectionsCount = 0,
  audienceState = {},
}) {
  const [soundBlocked, setSoundBlocked] = useState(false);
  useEffect(() => {
    const blocked = () => setSoundBlocked(true);
    window.addEventListener(AUDIO_PLAYBACK_BLOCKED_EVENT, blocked);
    return () =>
      window.removeEventListener(AUDIO_PLAYBACK_BLOCKED_EVENT, blocked);
  }, []);
  const enableSound = async () => {
    const videos = [...document.querySelectorAll("video")].filter(
      (video) => video.srcObject,
    );
    const results = await Promise.allSettled(
      videos.map((video) => video.play()),
    );
    setSoundBlocked(
      results.some(
        (result) =>
          result.status === "rejected" &&
          result.reason?.name === "NotAllowedError",
      ),
    );
  };
  const isWaitingForParticipants =
    isHost &&
    activeConnectionsCount === 0 &&
    isWaitingForParticipantsMessage(connectionError);

  return (
    <>
      {soundBlocked && (
        <div className={styles.hostWaitingBanner}>
          <p className={styles.hostWaitingText}>Click to hear the meeting.</p>
          <button
            type="button"
            className={styles.audioUnlockButton}
            onClick={enableSound}
          >
            Enable sound
          </button>
        </div>
      )}
      {(audienceState.mediaProtocolError ||
        audienceState.recovering ||
        audienceState.fallbackEdges > 0) && (
        <output className={styles.hostWaitingBanner}>
          <p className={styles.hostWaitingText}>
            {audienceState.mediaProtocolError ||
              (isHost && audienceState.fallbackEdges > 0
                ? "Direct delivery is increasing your upload load. Video quality may be reduced."
                : audienceState.recovering
                  ? "Recovering media connection…"
                  : "Using direct delivery. Video quality may be reduced.")}
          </p>
        </output>
      )}
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
        ? <output className={styles.hostWaitingBanner}>
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

import { memo } from "react";
import { VideoPlayer } from "@/components/meeting/VideoPlayer";
import styles from "./VideoTile.module.css";

export const VideoTile = memo(function VideoTile({
  stream,
  name,
  initial,
  avatarColor = "#475569",
  overlayIcon,
  isMuted = true,
  isSpeaking = false,
  isVideoOff = false,
  videoOffIcon = null,
  audioOutputDeviceId = "",
}) {
  const showVideo = Boolean(stream) && !isVideoOff;

  return (
    <div className={`${styles.tile} ${isSpeaking ? styles.speaking : ""}`}>
      {stream
        ? <VideoPlayer
            stream={stream}
            isMuted={isMuted}
            audioOutputDeviceId={audioOutputDeviceId}
            className={showVideo ? "" : styles.audioOnlyVideo}
          />
        : null}
      {!showVideo && (
        <div
          className={styles.placeholder}
          style={{ background: avatarColor }}
          aria-hidden
        >
          {initial ?? name.charAt(0)}
        </div>
      )}
      {isVideoOff && videoOffIcon && (
        <div className={styles.videoOffOverlay} aria-hidden>
          {videoOffIcon}
        </div>
      )}
      <div className={styles.overlay}>
        {overlayIcon
          ? <span
              className={`${styles.overlayIcon} ${isSpeaking ? styles.overlayIconSpeaking : ""}`}
            >
              {overlayIcon}
            </span>
          : null}
        {name}
      </div>
    </div>
  );
});

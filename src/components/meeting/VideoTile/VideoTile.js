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
  isFocused = false,
  isVideoOff = false,
  videoOffIcon = null,
  mediaBadgeIcon = null,
  mediaBadgeLabel = "",
  onFocus,
  audioOutputDeviceId = "",
}) {
  const showVideo = Boolean(stream) && !isVideoOff;
  const Wrapper = onFocus ? "button" : "div";
  const wrapperProps = onFocus
    ? {
        type: "button",
        onClick: onFocus,
        "aria-label": `Focus ${name}`,
      }
    : {};

  return (
    <Wrapper
      className={`${styles.tile} ${isFocused ? styles.focused : ""} ${onFocus ? styles.tileButton : ""}`}
      {...wrapperProps}
    >
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
      {mediaBadgeIcon
        ? <div className={styles.mediaBadge} aria-label={mediaBadgeLabel}>
            {mediaBadgeIcon}
            <span>{mediaBadgeLabel}</span>
          </div>
        : null}
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
    </Wrapper>
  );
});

import { memo } from "react";
import {
  Focus,
  Mic,
  MicOff,
  ScreenShare,
  Video,
  VideoOff,
  X,
} from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./ParticipantItem.module.css";

function MediaStatus({ muted, speaking = false, children }) {
  return (
    <span
      className={`${styles.statusIcon} ${muted ? styles.statusIconMuted : ""} ${speaking ? styles.statusIconSpeaking : ""}`}
    >
      {children}
    </span>
  );
}

function HostMediaAction({ label, onAction, speaking = false, children }) {
  return (
    <Tooltip text={label} placement="left">
      <button
        type="button"
        className={`${styles.statusBtn} ${speaking ? styles.statusIconSpeaking : ""}`}
        onClick={onAction}
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function VideoControl({ isVideoMuted, onMuteVideo }) {
  if (isVideoMuted) {
    return (
      <MediaStatus muted>
        <VideoOff />
      </MediaStatus>
    );
  }

  if (onMuteVideo) {
    return (
      <HostMediaAction label="Turn off camera" onAction={onMuteVideo}>
        <Video />
      </HostMediaAction>
    );
  }

  return (
    <MediaStatus muted={isVideoMuted}>
      <Video />
    </MediaStatus>
  );
}

function AudioControl({ isAudioMuted, isSpeaking, onMuteAudio }) {
  if (isAudioMuted) {
    return (
      <MediaStatus muted>
        <MicOff />
      </MediaStatus>
    );
  }

  if (onMuteAudio) {
    return (
      <HostMediaAction
        label="Mute participant"
        onAction={onMuteAudio}
        speaking={isSpeaking}
      >
        <Mic />
      </HostMediaAction>
    );
  }

  return (
    <MediaStatus muted={isAudioMuted} speaking={isSpeaking}>
      <Mic />
    </MediaStatus>
  );
}

export const ParticipantItem = memo(function ParticipantItem({
  name,
  initial,
  avatarColor,
  avatarFontSize,
  isVideoMuted = false,
  isAudioMuted = false,
  isSpeaking = false,
  isFocused = false,
  isScreenSharing = false,
  hasVideo = true,
  modeLabel = null,
  connectionStatus = null,
  onMuteVideo,
  onMuteAudio,
  onFocus,
  onRemove,
}) {
  return (
    <div className={`${styles.item} ${isFocused ? styles.itemFocused : ""}`}>
      <div className={styles.info}>
        <Tooltip text={name} placement="left">
          <div
            className={styles.avatar}
            style={{
              background: avatarColor,
              fontSize: avatarFontSize,
            }}
          >
            {initial}
            {connectionStatus && (
              <span
                className={`${styles.connectionDot} ${styles[`connectionDot_${connectionStatus}`]}`}
                title={`Connection status: ${connectionStatus}`}
              />
            )}
          </div>
        </Tooltip>
        <div>
          <div className={styles.name}>{name}</div>
          {modeLabel
            ? <div className={styles.modeLabel}>{modeLabel}</div>
            : null}
        </div>
      </div>
      <div className={styles.status}>
        {hasVideo && (
          <Tooltip
            text={isScreenSharing ? "Screen Share" : "Video"}
            placement="left"
          >
            <span className={styles.mediaBadge}>
              {isScreenSharing ? <ScreenShare /> : <Video />}
            </span>
          </Tooltip>
        )}
        {onFocus
          ? <Tooltip
              text={isFocused ? "Auto-Focus" : `Focus on ${name}`}
              placement="left"
            >
              <button
                type="button"
                className={`${styles.focusBtn} ${isFocused ? styles.focusBtnActive : ""}`}
                onClick={onFocus}
                aria-label={isFocused ? "Auto-Focus" : `Focus on ${name}`}
              >
                <Focus />
              </button>
            </Tooltip>
          : null}
        {hasVideo && (
          <VideoControl isVideoMuted={isVideoMuted} onMuteVideo={onMuteVideo} />
        )}
        <AudioControl
          isAudioMuted={isAudioMuted}
          isSpeaking={isSpeaking}
          onMuteAudio={onMuteAudio}
        />
        {onRemove
          ? <Tooltip text="Remove from meeting" placement="left">
              <button
                type="button"
                className={`${styles.statusBtn} ${styles.removeBtn}`}
                onClick={onRemove}
                aria-label={`Remove ${name} from meeting`}
              >
                <X size={16} />
              </button>
            </Tooltip>
          : null}
      </div>
    </div>
  );
});

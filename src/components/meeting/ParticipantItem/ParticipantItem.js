import { memo } from "react";
import {
  Mic,
  MicOff,
  ScreenShare,
  Video,
  VideoOff,
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
  onMuteVideo,
  onMuteAudio,
  onFocus,
}) {
  return (
    <div className={`${styles.item} ${isFocused ? styles.itemFocused : ""}`}>
      <div className={styles.info}>
        <div
          className={styles.avatar}
          style={{
            background: avatarColor,
            fontSize: avatarFontSize,
          }}
        >
          {initial}
        </div>
        <div>
          <Tooltip text={name} placement="left">
            <div className={styles.name}>{name}</div>
          </Tooltip>
          {modeLabel
            ? <div className={styles.modeLabel}>{modeLabel}</div>
            : null}
        </div>
      </div>
      <div className={styles.status}>
        {hasVideo && (
          <span className={styles.mediaBadge}>
            {isScreenSharing ? <ScreenShare /> : <Video />}
            <span>{isScreenSharing ? "Screen" : "Video"}</span>
          </span>
        )}
        {onFocus
          ? <Tooltip
              text={isFocused ? "Currently focused" : "Focus for everyone"}
              placement="left"
            >
              <button
                type="button"
                className={`${styles.focusBtn} ${isFocused ? styles.focusBtnActive : ""}`}
                onClick={onFocus}
                aria-label={isFocused ? `${name} is focused` : `Focus ${name}`}
              >
                Focus
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
      </div>
    </div>
  );
});

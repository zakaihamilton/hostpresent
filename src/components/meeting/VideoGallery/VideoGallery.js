import { memo } from "react";
import { VideoTile } from "@/components/meeting/VideoTile";
import {
  Mic,
  MicOff,
  ScreenShare,
  Video,
  VideoOff,
} from "@/components/ui/Icons";
import { hasPlayableRemoteAudio } from "@/lib/webrtc/remoteParticipantMedia";
import styles from "./VideoGallery.module.css";

export const VideoGallery = memo(function VideoGallery({
  visible,
  screenStream,
  localStream,
  participants,
  isAudioMuted,
  isVideoMuted = false,
  isScreenSharing = false,
  localDisplayName = "You",
  localIsSpeaking = false,
  audioOutputDeviceId = "",
  focusedParticipantId = "host",
  allowFocus = false,
  onFocusParticipant,
}) {
  return (
    <div
      className={`${styles.wrapper} ${visible ? "" : styles.wrapperHidden}`}
      aria-hidden={!visible}
    >
      <div className={styles.galleryInner}>
        <div className={styles.gallery}>
          {localStream && (
            <VideoTile
              stream={screenStream || localStream}
              name={localDisplayName}
              overlayIcon={isAudioMuted ? <MicOff /> : <Mic />}
              isMuted
              isFocused={focusedParticipantId === "host"}
              isSpeaking={localIsSpeaking}
              isVideoOff={isVideoMuted && !isScreenSharing}
              videoOffIcon={<VideoOff />}
              mediaBadgeIcon={isScreenSharing ? <ScreenShare /> : <Video />}
              mediaBadgeLabel={isScreenSharing ? "Screen" : "Video"}
              onFocus={
                allowFocus ? () => onFocusParticipant?.("host") : undefined
              }
            />
          )}
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={participant.stream}
              name={participant.name}
              initial={participant.name.charAt(0)}
              avatarColor={participant.avatarColor}
              overlayIcon={participant.isAudioMuted ? <MicOff /> : <Mic />}
              isMuted={
                participant.isSelf ||
                !hasPlayableRemoteAudio(participant.stream)
              }
              isSpeaking={participant.isSpeaking}
              isVideoOff={
                participant.isVideoMuted && !participant.isScreenSharing
              }
              videoOffIcon={<VideoOff />}
              isFocused={focusedParticipantId === participant.id}
              mediaBadgeIcon={
                participant.isScreenSharing ? <ScreenShare /> : <Video />
              }
              mediaBadgeLabel={participant.isScreenSharing ? "Screen" : "Video"}
              onFocus={
                allowFocus
                  ? () => onFocusParticipant?.(participant.id)
                  : undefined
              }
              audioOutputDeviceId={audioOutputDeviceId}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

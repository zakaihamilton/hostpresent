import { Mic, MicOff, VideoOff } from "@/components/Icons";
import { VideoTile } from "@/components/VideoTile";
import styles from "./VideoGallery.module.css";

export function VideoGallery({
  visible,
  screenStream,
  localStream,
  participants,
  isAudioMuted,
  localDisplayName = "You",
}) {
  return (
    <div
      className={`${styles.wrapper} ${visible ? "" : styles.wrapperHidden}`}
      aria-hidden={!visible}
    >
      <div className={styles.gallery}>
        {screenStream && localStream && (
          <VideoTile
            stream={localStream}
            name={localDisplayName}
            overlayIcon={isAudioMuted ? <MicOff /> : <Mic />}
            isMuted
            isSpeaking
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
            isMuted={participant.isAudioMuted}
            isVideoOff={participant.isVideoMuted}
            videoOffIcon={<VideoOff />}
          />
        ))}
      </div>
    </div>
  );
}

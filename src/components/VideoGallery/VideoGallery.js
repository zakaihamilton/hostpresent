import { Mic, MicOff } from "@/components/Icons";
import { VideoTile } from "@/components/VideoTile";
import styles from "./VideoGallery.module.css";

export function VideoGallery({
  visible,
  screenStream,
  localStream,
  participants,
  isAudioMuted,
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
            name="You"
            overlayIcon={isAudioMuted ? <MicOff /> : <Mic />}
            isSpeaking
          />
        )}
        {participants.map((p) => (
          <VideoTile
            key={p.id}
            stream={p.stream}
            name={p.name}
            overlayIcon={<Mic />}
          />
        ))}
      </div>
    </div>
  );
}

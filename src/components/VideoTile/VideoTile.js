import { VideoPlayer } from "@/components/VideoPlayer";
import styles from "./VideoTile.module.css";

export function VideoTile({
  stream,
  name,
  overlayIcon,
  isMuted = true,
  isSpeaking = false,
}) {
  return (
    <div className={`${styles.tile} ${isSpeaking ? styles.speaking : ""}`}>
      <VideoPlayer stream={stream} isMuted={isMuted} />
      <div className={styles.overlay}>
        {overlayIcon}
        {name}
      </div>
    </div>
  );
}

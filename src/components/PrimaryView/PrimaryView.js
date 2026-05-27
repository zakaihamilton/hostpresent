import { VideoPlayer } from "@/components/VideoPlayer";
import styles from "./PrimaryView.module.css";

export function PrimaryView({ stream, label }) {
  return (
    <div className={styles.primaryView}>
      {stream && <VideoPlayer stream={stream} isMuted />}
      <div className={styles.overlay}>{label}</div>
    </div>
  );
}

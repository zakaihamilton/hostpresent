import { VideoPlayer } from "@/components/VideoPlayer";
import styles from "./PipView.module.css";

export function PipView({
  stream,
  isVideoMuted,
  name,
  initial,
  avatarColor = "#475569",
}) {
  const showVideo = Boolean(stream) && !isVideoMuted;

  return (
    <div className={styles.pip}>
      {showVideo ? (
        <VideoPlayer
          stream={stream}
          isMuted={true}
          className={styles.video}
        />
      ) : (
        <div
          className={styles.placeholder}
          style={{ background: avatarColor }}
          aria-hidden
        >
          {initial ?? name?.charAt(0) ?? "?"}
        </div>
      )}
      <span className={styles.label}>{name}</span>
    </div>
  );
}

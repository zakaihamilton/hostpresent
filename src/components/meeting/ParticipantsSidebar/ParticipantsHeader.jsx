import { MicOff, VideoOff, X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./ParticipantsSidebar.module.css";

export function ParticipantsHeader({
  totalCount,
  remoteCount,
  hasRemoteParticipants,
  onMuteAllVideo,
  canMuteAllVideo,
  onMuteAllAudio,
  canMuteAllAudio,
  onClose,
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerCopy}>
        <div className={styles.headerTitle}>
          <span>Participants</span>
          <span className={styles.count}>{totalCount}</span>
        </div>
        <p className={styles.headerMeta}>
          {remoteCount === 0
            ? "Only you are in the room."
            : `${remoteCount} ${remoteCount === 1 ? "guest" : "guests"} connected.`}
        </p>
      </div>
      <div className={styles.headerActions}>
        {hasRemoteParticipants ? (
          <div className={styles.bulkActions}>
            <Tooltip text="Turn off all cameras" placement="left">
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={onMuteAllVideo}
                disabled={!canMuteAllVideo}
                aria-label="Turn off all cameras"
              >
                <VideoOff />
              </button>
            </Tooltip>
            <Tooltip text="Mute all participants" placement="left">
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={onMuteAllAudio}
                disabled={!canMuteAllAudio}
                aria-label="Mute all participants"
              >
                <MicOff />
              </button>
            </Tooltip>
          </div>
        ) : null}
        {onClose ? (
          <Tooltip text="Close participants" placement="left">
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close participants"
            >
              <X size={18} />
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

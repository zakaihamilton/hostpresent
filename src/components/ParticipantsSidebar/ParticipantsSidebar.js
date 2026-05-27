import { Mic, MicOff, Video, VideoOff } from "@/components/Icons";
import { ParticipantItem } from "@/components/ParticipantItem";
import styles from "./ParticipantsSidebar.module.css";

export function ParticipantsSidebar({
  visible,
  audioList,
  mockVideoParticipants,
  isVideoMuted,
  isAudioMuted,
}) {
  const totalCount = audioList.length + 5;

  return (
    <div
      className={`${styles.slot} ${visible ? "" : styles.slotClosed}`}
      aria-hidden={!visible}
    >
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <span>Participants</span>
          <span className={styles.count}>{totalCount}</span>
        </div>
        <div className={styles.list}>
          <ParticipantItem
            name="You (Host)"
            initial="Y"
            avatarColor="#3b82f6"
            statusIcons={
              <>
                {isVideoMuted ? <VideoOff /> : <Video />}
                {isAudioMuted ? <MicOff /> : <Mic />}
              </>
            }
          />

          {mockVideoParticipants.map((p) => (
            <ParticipantItem
              key={p.id}
              name={p.name}
              initial={p.name.charAt(0)}
              avatarColor="#0f766e"
              statusIcons={
                <>
                  <Video />
                  <Mic />
                </>
              }
            />
          ))}

          <div className={styles.sectionLabel}>Audio Participants</div>

          {audioList.map((p) => (
            <ParticipantItem
              key={p.id}
              name={p.name}
              initial={p.name.charAt(0)}
              avatarColor="#475569"
              avatarFontSize="10px"
              statusIcons={p.isMuted ? <MicOff /> : <Mic />}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

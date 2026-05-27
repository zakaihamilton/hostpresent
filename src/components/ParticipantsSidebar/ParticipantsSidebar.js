import { useCallback, useMemo } from "react";
import { MicOff, VideoOff } from "@/components/Icons";
import { ParticipantItem } from "@/components/ParticipantItem";
import { Tooltip } from "@/components/Tooltip";
import { VirtualList } from "@/components/Widgets";
import styles from "./ParticipantsSidebar.module.css";

const PARTICIPANT_ITEM_HEIGHT = 52;
const SECTION_LABEL_HEIGHT = 44;

function buildParticipantItems({
  isHost,
  isVideoMuted,
  isAudioMuted,
  videoParticipants,
  audioList,
}) {
  const items = isHost
    ? [
        {
          type: "host",
          id: "host",
          name: "You (Host)",
          initial: "Y",
          avatarColor: "#3b82f6",
          isVideoMuted,
          isAudioMuted,
          hasVideo: true,
        },
      ]
    : [
        {
          type: "video",
          id: "self",
          name: "You",
          initial: "Y",
          avatarColor: "#3b82f6",
          isVideoMuted,
          isAudioMuted,
          hasVideo: true,
        },
      ];

  for (const participant of videoParticipants) {
    items.push({
      type: "video",
      id: participant.id,
      name: participant.name,
      initial: participant.name.charAt(0),
      avatarColor: participant.avatarColor,
      isVideoMuted: participant.isVideoMuted,
      isAudioMuted: participant.isAudioMuted,
      hasVideo: true,
    });
  }

  if (audioList.length > 0) {
    items.push({
      type: "section",
      id: "audio-section",
      label: "Audio Participants",
    });

    for (const participant of audioList) {
      items.push({
        type: "audio",
        id: participant.id,
        name: participant.name,
        initial: participant.name.charAt(0),
        avatarColor: "#475569",
        avatarFontSize: "10px",
        isAudioMuted: participant.isMuted,
        hasVideo: false,
      });
    }
  }

  return items;
}

function getParticipantItemSize(_index, item) {
  return item.type === "section"
    ? SECTION_LABEL_HEIGHT
    : PARTICIPANT_ITEM_HEIGHT;
}

function getParticipantItemKey(item) {
  return item.id;
}

export function ParticipantsSidebar({
  visible,
  audioList,
  videoParticipants,
  isVideoMuted,
  isAudioMuted,
  isHost = true,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  onMuteAllVideo,
  onMuteAllAudio,
  canMuteAllVideo,
  canMuteAllAudio,
}) {
  const totalCount = 1 + videoParticipants.length + audioList.length;
  const hasRemoteParticipants =
    isHost && (videoParticipants.length > 0 || audioList.length > 0);

  const items = useMemo(
    () =>
      buildParticipantItems({
        isHost,
        isVideoMuted,
        isAudioMuted,
        videoParticipants,
        audioList,
      }),
    [audioList, isAudioMuted, isHost, isVideoMuted, videoParticipants],
  );

  const renderItem = useCallback(
    (item) => {
      if (item.type === "section") {
        return <div className={styles.sectionLabel}>{item.label}</div>;
      }

      const isHostItem = item.type === "host";
      const isSelfItem = item.id === "self";

      return (
        <ParticipantItem
          name={item.name}
          initial={item.initial}
          avatarColor={item.avatarColor}
          avatarFontSize={item.avatarFontSize}
          isVideoMuted={item.isVideoMuted}
          isAudioMuted={item.isAudioMuted}
          hasVideo={item.hasVideo}
          onMuteVideo={
            isHost && !isHostItem && !isSelfItem
              ? () => onMuteParticipantVideo(item.id)
              : undefined
          }
          onMuteAudio={
            isHost && !isHostItem && !isSelfItem
              ? () => onMuteParticipantAudio(item.id, item.type)
              : undefined
          }
        />
      );
    },
    [isHost, onMuteParticipantAudio, onMuteParticipantVideo],
  );

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

        {hasRemoteParticipants && (
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
        )}

        <VirtualList
          className={styles.list}
          items={items}
          getItemSize={getParticipantItemSize}
          renderItem={renderItem}
          itemKey={getParticipantItemKey}
          ariaLabel="Participants"
          overscan={6}
        />
      </aside>
    </div>
  );
}

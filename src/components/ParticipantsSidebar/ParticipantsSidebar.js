import { useCallback, useMemo } from "react";
import { MicOff, VideoOff, X } from "@/components/Icons";
import { ParticipantItem } from "@/components/ParticipantItem";
import { Tooltip } from "@/components/Tooltip";
import { VirtualList } from "@/components/Widgets";
import {
  PARTICIPANT_MODE,
  displayNameInitial,
  participantModeLabel,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";
import styles from "./ParticipantsSidebar.module.css";

const PARTICIPANT_ITEM_HEIGHT = 52;
const SECTION_LABEL_HEIGHT = 44;

function getModeLabel(mode) {
  return participantModeLabel(
    mode === PARTICIPANT_MODE.LISTENING
      ? PARTICIPANT_MODE.LISTENING
      : PARTICIPANT_MODE.AVAILABLE,
  );
}

function buildParticipantItems({
  isHost,
  isVideoMuted,
  isAudioMuted,
  localDisplayName,
  localParticipantMode,
  hostDisplayName,
  peerParticipants,
  videoParticipants,
  audioList,
}) {
  const selfName = resolveDisplayName(localDisplayName);
  const selfInitial = displayNameInitial(localDisplayName);
  const selfModeLabel = !isHost ? getModeLabel(localParticipantMode) : null;

  if (!isHost) {
    const items = [
      {
        type: "host-remote",
        id: "host",
        name: resolveDisplayName(hostDisplayName),
        initial: displayNameInitial(hostDisplayName),
        avatarColor: "#6366f1",
        isVideoMuted: false,
        isAudioMuted: false,
        hasVideo: false,
      },
      {
        type: "self",
        id: "self",
        name: selfName,
        initial: selfInitial,
        avatarColor: "#3b82f6",
        isVideoMuted,
        isAudioMuted,
        hasVideo: true,
        modeLabel: selfModeLabel,
      },
    ];

    for (const participant of peerParticipants) {
      items.push({
        type: "peer",
        id: participant.id,
        name: participant.name,
        initial: displayNameInitial(participant.name),
        avatarColor: participant.avatarColor,
        isVideoMuted: false,
        isAudioMuted: false,
        hasVideo: false,
        modeLabel: getModeLabel(participant.mode),
      });
    }

    return items;
  }

  const items = [
    {
      type: "host",
      id: "host",
      name: selfName,
      initial: selfInitial,
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
      initial: displayNameInitial(participant.name),
      avatarColor: participant.avatarColor,
      isVideoMuted: participant.isVideoMuted,
      isAudioMuted: participant.isAudioMuted,
      hasVideo: true,
      modeLabel: getModeLabel(participant.mode),
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
  peerParticipants = [],
  hostDisplayName = "Host",
  isVideoMuted,
  isAudioMuted,
  isHost = true,
  localDisplayName = "",
  localParticipantMode = PARTICIPANT_MODE.AVAILABLE,
  onClose,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  onMuteAllVideo,
  onMuteAllAudio,
  canMuteAllVideo,
  canMuteAllAudio,
}) {
  const totalCount = isHost
    ? 1 + videoParticipants.length + audioList.length
    : 2 + peerParticipants.length;
  const hasRemoteParticipants =
    isHost && (videoParticipants.length > 0 || audioList.length > 0);

  const items = useMemo(
    () =>
      buildParticipantItems({
        isHost,
        isVideoMuted,
        isAudioMuted,
        localDisplayName,
        localParticipantMode,
        hostDisplayName,
        peerParticipants,
        videoParticipants,
        audioList,
      }),
    [
      audioList,
      hostDisplayName,
      isAudioMuted,
      isHost,
      isVideoMuted,
      localDisplayName,
      localParticipantMode,
      peerParticipants,
      videoParticipants,
    ],
  );

  const renderItem = useCallback(
    (item) => {
      if (item.type === "section") {
        return <div className={styles.sectionLabel}>{item.label}</div>;
      }

      const isHostItem = item.type === "host";
      const isSelfItem = item.id === "self";
      const isRemotePeer = item.type === "peer" || item.type === "host-remote";

      return (
        <ParticipantItem
          name={item.name}
          initial={item.initial}
          avatarColor={item.avatarColor}
          avatarFontSize={item.avatarFontSize}
          isVideoMuted={item.isVideoMuted}
          isAudioMuted={item.isAudioMuted}
          hasVideo={item.hasVideo}
          modeLabel={item.modeLabel}
          onMuteVideo={
            isHost && !isHostItem && !isSelfItem && !isRemotePeer
              ? () => onMuteParticipantVideo(item.id)
              : undefined
          }
          onMuteAudio={
            isHost && !isHostItem && !isSelfItem && !isRemotePeer
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
          <div className={styles.headerActions}>
            <span className={styles.count}>{totalCount}</span>
            {onClose
              ? <Tooltip text="Close participants" placement="left">
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close participants"
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              : null}
          </div>
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

import { memo, useCallback, useMemo } from "react";
import { MicOff, VideoOff, X } from "@/components/ui/Icons";
import { ParticipantItem } from "@/components/meeting/ParticipantItem";
import { Tooltip } from "@/components/ui/Tooltip";
import { VirtualList } from "@/components/Widgets";
import {
  displayNameInitial,
  PARTICIPANT_MODE,
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

function isListening(modeLabel) {
  return modeLabel === "Listening only";
}

function buildParticipantItems({
  isHost,
  isVideoMuted,
  isAudioMuted,
  hostIsAudioMuted,
  hostIsVideoMuted,
  hostIsSpeaking,
  hostMode,
  localDisplayName,
  localParticipantMode,
  localIsSpeaking,
  localIsScreenSharing,
  hostIsScreenSharing,
  hostDisplayName,
  peerParticipants,
  videoParticipants,
  audioList,
}) {
  const selfName = resolveDisplayName(localDisplayName);
  const selfInitial = displayNameInitial(localDisplayName);
  const selfModeLabel = getModeLabel(localParticipantMode);

  if (!isHost) {
    const items = [
      {
        type: "host-remote",
        id: "host",
        name: resolveDisplayName(hostDisplayName),
        initial: displayNameInitial(hostDisplayName),
        avatarColor: "#6366f1",
        isVideoMuted: hostIsVideoMuted,
        isAudioMuted: hostIsAudioMuted,
        isSpeaking: hostIsSpeaking,
        isScreenSharing: hostIsScreenSharing,
        hasVideo: true,
        modeLabel: getModeLabel(hostMode),
      },
      {
        type: "self",
        id: "self",
        name: selfName,
        initial: selfInitial,
        avatarColor: "#3b82f6",
        isVideoMuted,
        isAudioMuted,
        isSpeaking: localIsSpeaking,
        isScreenSharing: localIsScreenSharing,
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
        isVideoMuted: participant.isVideoMuted ?? false,
        isAudioMuted: participant.isAudioMuted ?? false,
        isSpeaking: participant.isSpeaking ?? false,
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
      isSpeaking: localIsSpeaking,
      isScreenSharing: localIsScreenSharing,
      hasVideo: true,
      modeLabel: selfModeLabel,
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
      isSpeaking: participant.isSpeaking,
      isScreenSharing: participant.isScreenSharing,
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
        isAudioMuted: participant.isMuted,
        isSpeaking: participant.isSpeaking,
        hasVideo: false,
      });
    }
  }

  return items;
}

const ParticipantRow = memo(function ParticipantRow({
  item,
  isHost,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  focusedParticipantId,
  onFocusParticipant,
}) {
  if (item.type === "section") {
    return <div className={styles.sectionLabel}>{item.label}</div>;
  }

  const isHostItem = item.type === "host";
  const isSelfItem = item.id === "self";
  const isRemotePeer = item.type === "peer" || item.type === "host-remote";
  const canMute = isHost && !isHostItem && !isSelfItem && !isRemotePeer;
  const canFocus = isHost && item.hasVideo && !isRemotePeer;

  return (
    <ParticipantItem
      name={item.name}
      initial={item.initial}
      avatarColor={item.avatarColor}
      avatarFontSize={item.avatarFontSize}
      isVideoMuted={item.isVideoMuted}
      isAudioMuted={item.isAudioMuted}
      isSpeaking={item.isSpeaking}
      isFocused={focusedParticipantId === item.id}
      isScreenSharing={item.isScreenSharing}
      hasVideo={item.hasVideo}
      modeLabel={item.modeLabel}
      onMuteVideo={canMute ? () => onMuteParticipantVideo(item.id) : undefined}
      onMuteAudio={
        canMute ? () => onMuteParticipantAudio(item.id, item.type) : undefined
      }
      onFocus={canFocus ? () => onFocusParticipant?.(item.id) : undefined}
    />
  );
});

function getParticipantItemSize(_index, item) {
  return item.type === "section"
    ? SECTION_LABEL_HEIGHT
    : PARTICIPANT_ITEM_HEIGHT;
}

function getParticipantItemKey(item) {
  return item.id;
}

export const ParticipantsSidebar = memo(function ParticipantsSidebar({
  visible,
  audioList,
  videoParticipants,
  peerParticipants = [],
  hostDisplayName = "Host",
  hostIsAudioMuted = false,
  hostIsVideoMuted = false,
  hostIsSpeaking = false,
  hostMode = "available",
  isVideoMuted,
  isAudioMuted,
  isHost = true,
  localDisplayName = "",
  localParticipantMode = PARTICIPANT_MODE.AVAILABLE,
  localIsSpeaking = false,
  localIsScreenSharing = false,
  hostIsScreenSharing = false,
  focusedParticipantId = "host",
  onClose,
  onFocusParticipant,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  onMuteAllVideo,
  onMuteAllAudio,
  canMuteAllVideo,
  canMuteAllAudio,
  flex,
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
        hostIsAudioMuted,
        hostIsVideoMuted,
        hostIsSpeaking,
        hostMode,
        localDisplayName,
        localParticipantMode,
        localIsSpeaking,
        localIsScreenSharing,
        hostIsScreenSharing,
        hostDisplayName,
        peerParticipants,
        videoParticipants,
        audioList,
      }),
    [
      audioList,
      hostDisplayName,
      hostIsAudioMuted,
      hostIsVideoMuted,
      hostIsSpeaking,
      hostIsScreenSharing,
      hostMode,
      isAudioMuted,
      isHost,
      isVideoMuted,
      localDisplayName,
      localParticipantMode,
      localIsSpeaking,
      localIsScreenSharing,
      peerParticipants,
      videoParticipants,
    ],
  );

  const renderItem = useCallback(
    (item) => (
      <ParticipantRow
        item={item}
        isHost={isHost}
        onMuteParticipantVideo={onMuteParticipantVideo}
        onMuteParticipantAudio={onMuteParticipantAudio}
        focusedParticipantId={focusedParticipantId}
        onFocusParticipant={onFocusParticipant}
      />
    ),
    [
      focusedParticipantId,
      isHost,
      onFocusParticipant,
      onMuteParticipantAudio,
      onMuteParticipantVideo,
    ],
  );

  return (
    <div
      className={`${styles.slot} ${visible ? "" : styles.slotClosed} ${flex ? styles.slotFlex : ""}`}
      aria-hidden={!visible}
    >
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span>Participants</span>
            <span className={styles.count}>{totalCount}</span>
          </div>
          <div className={styles.headerActions}>
            {hasRemoteParticipants
              ? <div className={styles.bulkActions}>
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
              : null}
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
});

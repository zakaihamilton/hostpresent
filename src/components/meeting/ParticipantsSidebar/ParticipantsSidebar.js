import { memo, useCallback, useMemo } from "react";
import { VirtualList } from "@/components/Widgets";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { ParticipantRow } from "./ParticipantRow";
import { ParticipantsHeader } from "./ParticipantsHeader";
import styles from "./ParticipantsSidebar.module.css";
import { buildParticipantItems } from "./participantItems";

const PARTICIPANT_ITEM_HEIGHT = 52;
const SECTION_LABEL_HEIGHT = 44;

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
  connectionStatus = null,
  onClose,
  onFocusParticipant,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  onMuteAllVideo,
  onMuteAllAudio,
  canMuteAllVideo,
  canMuteAllAudio,
  publishingRequests = [],
  publisherIds = [],
  onApprovePublishing,
  onRevokePublishing,
  flex,
}) {
  const totalCount = isHost
    ? 1 + videoParticipants.length + audioList.length
    : 2 + peerParticipants.length;
  const remoteCount = Math.max(0, totalCount - 1);
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
        connectionStatus,
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
      connectionStatus,
    ],
  );

  const renderItem = useCallback(
    (item) => (
      <ParticipantRow
        publishingRequests={publishingRequests}
        publisherIds={publisherIds}
        onApprovePublishing={onApprovePublishing}
        onRevokePublishing={onRevokePublishing}
        item={item}
        isHost={isHost}
        onMuteParticipantVideo={onMuteParticipantVideo}
        onMuteParticipantAudio={onMuteParticipantAudio}
        focusedParticipantId={focusedParticipantId}
        onFocusParticipant={onFocusParticipant}
      />
    ),
    [
      publishingRequests,
      publisherIds,
      onApprovePublishing,
      onRevokePublishing,
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
        <ParticipantsHeader
          totalCount={totalCount}
          remoteCount={remoteCount}
          hasRemoteParticipants={hasRemoteParticipants}
          onMuteAllVideo={onMuteAllVideo}
          canMuteAllVideo={canMuteAllVideo}
          onMuteAllAudio={onMuteAllAudio}
          canMuteAllAudio={canMuteAllAudio}
          onClose={onClose}
        />

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

import { memo } from "react";
import { ParticipantItem } from "@/components/meeting/ParticipantItem";
import styles from "./ParticipantsSidebar.module.css";

export const ParticipantRow = memo(function ParticipantRow({
  item,
  isHost,
  onMuteParticipantVideo,
  onMuteParticipantAudio,
  focusedParticipantId,
  onFocusParticipant,
  publishingRequests = [],
  publisherIds = [],
  onApprovePublishing,
  onRevokePublishing,
}) {
  if (item.type === "section") {
    return <div className={styles.sectionLabel}>{item.label}</div>;
  }

  const isHostItem = item.type === "host";
  const isSelfItem = item.id === "self";
  const isRemotePeer = item.type === "peer" || item.type === "host-remote";
  const canMute = isHost && !isHostItem && !isSelfItem && !isRemotePeer;
  const canFocus =
    isHost &&
    item.hasVideo &&
    !isRemotePeer &&
    (isHostItem || publisherIds.includes(item.id));

  return (
    <ParticipantItem
      publishingRequested={isHost && publishingRequests.includes(item.id)}
      publishingGranted={isHost && publisherIds.includes(item.id)}
      approvalDisabled={publisherIds.length >= 4}
      onApprovePublishing={
        isHost ? () => onApprovePublishing?.(item.id) : undefined
      }
      onRevokePublishing={
        isHost && !isHostItem ? () => onRevokePublishing?.(item.id) : undefined
      }
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
      connectionStatus={item.connectionStatus}
      onMuteVideo={canMute ? () => onMuteParticipantVideo(item.id) : undefined}
      onMuteAudio={
        canMute ? () => onMuteParticipantAudio(item.id, item.type) : undefined
      }
      onFocus={canFocus ? () => onFocusParticipant?.(item.id) : undefined}
    />
  );
});

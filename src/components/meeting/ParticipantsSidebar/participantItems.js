import {
  displayNameInitial,
  PARTICIPANT_MODE,
  participantModeLabel,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";

function getModeLabel(mode) {
  return participantModeLabel(
    mode === PARTICIPANT_MODE.LISTENING
      ? PARTICIPANT_MODE.LISTENING
      : PARTICIPANT_MODE.AVAILABLE,
  );
}

export function buildParticipantItems({
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
        connectionStatus,
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
      connectionStatus,
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

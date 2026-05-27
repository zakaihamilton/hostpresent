export const SIGNALING_MESSAGE = {
  HOST_MUTE_AUDIO: "host_mute_audio",
  HOST_MUTE_VIDEO: "host_mute_video",
  HOST_MUTE_ALL_AUDIO: "host_mute_all_audio",
  HOST_MUTE_ALL_VIDEO: "host_mute_all_video",
  PARTICIPANT_AUDIO_MUTED: "participant_audio_muted",
  PARTICIPANT_VIDEO_MUTED: "participant_video_muted",
  PARTICIPANT_AUDIO_UNMUTED: "participant_audio_unmuted",
  PARTICIPANT_VIDEO_UNMUTED: "participant_video_unmuted",
};

export function createHostMuteAudioMessage({ participantId, participantType }) {
  return {
    type: SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createHostMuteVideoMessage({ participantId }) {
  return {
    type: SIGNALING_MESSAGE.HOST_MUTE_VIDEO,
    participantId,
    timestamp: Date.now(),
  };
}

export function createHostMuteAllAudioMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
    timestamp: Date.now(),
  };
}

export function createHostMuteAllVideoMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
    timestamp: Date.now(),
  };
}

export function createParticipantAudioMutedMessage({
  participantId,
  participantType,
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createParticipantVideoMutedMessage({ participantId }) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
    participantId,
    timestamp: Date.now(),
  };
}

export function createParticipantAudioUnmutedMessage({
  participantId,
  participantType,
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createParticipantVideoUnmutedMessage({ participantId }) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
    participantId,
    timestamp: Date.now(),
  };
}

export function parseSignalingMessage(raw) {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  return raw;
}

export function isSignalingMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    typeof message.type === "string" &&
    Object.values(SIGNALING_MESSAGE).includes(message.type)
  );
}

export const SIGNALING_MESSAGE = {
  HOST_PRESENT: "host_present",
  HOST_MUTE_AUDIO: "host_mute_audio",
  HOST_MUTE_VIDEO: "host_mute_video",
  HOST_MUTE_ALL_AUDIO: "host_mute_all_audio",
  HOST_MUTE_ALL_VIDEO: "host_mute_all_video",
  RECORDING_STATE: "recording_state",
  PARTICIPANT_AUDIO_MUTED: "participant_audio_muted",
  PARTICIPANT_VIDEO_MUTED: "participant_video_muted",
  PARTICIPANT_AUDIO_UNMUTED: "participant_audio_unmuted",
  PARTICIPANT_VIDEO_UNMUTED: "participant_video_unmuted",
  PARTICIPANT_PROFILE: "participant_profile",
  PARTICIPANT_PROFILE_BROADCAST: "participant_profile_broadcast",
};

export function createHostPresentMessage({ displayName = "" } = {}) {
  return {
    type: SIGNALING_MESSAGE.HOST_PRESENT,
    displayName: typeof displayName === "string" ? displayName.trim() : "",
    timestamp: Date.now(),
  };
}

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

export function createRecordingStateMessage({ active, paused = false }) {
  return {
    type: SIGNALING_MESSAGE.RECORDING_STATE,
    active: Boolean(active),
    paused: Boolean(paused),
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

export function createParticipantProfileMessage({
  participantId,
  displayName,
  mode,
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
    participantId,
    displayName:
      typeof displayName === "string" ? displayName.trim().slice(0, 32) : "",
    mode: mode === "listening" ? "listening" : "available",
    timestamp: Date.now(),
  };
}

export function createParticipantProfileBroadcastMessage({
  participantId,
  displayName = "",
  mode = "available",
  present = true,
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
    participantId,
    present: Boolean(present),
    displayName:
      typeof displayName === "string" ? displayName.trim().slice(0, 32) : "",
    mode: mode === "listening" ? "listening" : "available",
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

export function withRoomEnvelope(message, { roomId, token }) {
  return {
    ...message,
    roomId,
    token,
  };
}

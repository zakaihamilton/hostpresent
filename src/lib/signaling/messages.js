export const SIGNALING_MESSAGE = {
  HOST_PRESENT: "host_present",
  HOST_AUDIO_MUTED: "host_audio_muted",
  HOST_AUDIO_UNMUTED: "host_audio_unmuted",
  HOST_VIDEO_MUTED: "host_video_muted",
  HOST_VIDEO_UNMUTED: "host_video_unmuted",
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
  CHAT_MESSAGE: "chat_message",
  CHAT_PRIVATE_MESSAGE: "chat_private_message",
};

export function createHostPresentMessage({
  displayName = "",
  audioMuted = false,
  videoMuted = false,
  mode = "available",
  sessionTitle = "",
} = {}) {
  return {
    type: SIGNALING_MESSAGE.HOST_PRESENT,
    displayName: typeof displayName === "string" ? displayName.trim() : "",
    audioMuted: Boolean(audioMuted),
    videoMuted: Boolean(videoMuted),
    mode: mode === "listening" ? "listening" : "available",
    sessionTitle: typeof sessionTitle === "string" ? sessionTitle.trim() : "",
    timestamp: Date.now(),
  };
}

export function createHostAudioMutedMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_AUDIO_MUTED,
    timestamp: Date.now(),
  };
}

export function createHostAudioUnmutedMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED,
    timestamp: Date.now(),
  };
}

export function createHostVideoMutedMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_VIDEO_MUTED,
    timestamp: Date.now(),
  };
}

export function createHostVideoUnmutedMessage() {
  return {
    type: SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED,
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

export function createChatMessage({ senderId, senderName, text }) {
  return {
    type: SIGNALING_MESSAGE.CHAT_MESSAGE,
    senderId,
    senderName:
      typeof senderName === "string" ? senderName.trim().slice(0, 32) : "",
    text: typeof text === "string" ? text.trim().slice(0, 500) : "",
    timestamp: Date.now(),
  };
}

export function createChatPrivateMessage({
  senderId,
  senderName,
  recipientId,
  text,
}) {
  return {
    type: SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE,
    senderId,
    senderName:
      typeof senderName === "string" ? senderName.trim().slice(0, 32) : "",
    recipientId,
    text: typeof text === "string" ? text.trim().slice(0, 500) : "",
    timestamp: Date.now(),
  };
}

export function isChatMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    (message.type === SIGNALING_MESSAGE.CHAT_MESSAGE ||
      message.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE)
  );
}

export function withRoomEnvelope(message, { roomId, token }) {
  return {
    ...message,
    roomId,
    token,
  };
}

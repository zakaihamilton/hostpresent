import { ROOM_ROLE } from "@/lib/room/tokens";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";

const HOST_COMMAND_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_PRESENT,
  SIGNALING_MESSAGE.HOST_AUDIO_MUTED,
  SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_MUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_VIDEO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
  SIGNALING_MESSAGE.HOST_FOCUS_CHANGED,
  SIGNALING_MESSAGE.RECORDING_STATE,
  SIGNALING_MESSAGE.MEETING_ENDED,
  SIGNALING_MESSAGE.KICK_PARTICIPANT,
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
]);

const HOST_MEDIA_BROADCAST_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_AUDIO_MUTED,
  SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_MUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED,
]);

const PARTICIPANT_STATUS_TYPES = new Set([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
  SIGNALING_MESSAGE.MEDIA_RENEGOTIATE,
]);

const HOST_MUTE_ALL_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
]);

const PARTICIPANT_STATUS_BROADCAST_TYPES = new Set([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
]);

export function isHostCommandMessage(message) {
  return HOST_COMMAND_TYPES.has(message?.type);
}

export function isParticipantStatusMessage(message) {
  return PARTICIPANT_STATUS_TYPES.has(message?.type);
}

export function resolveParticipantStatusMessage(
  message,
  { senderId = "" } = {},
) {
  if (!isParticipantStatusMessage(message)) return message;

  const participantId = message.participantId || senderId;
  if (!participantId || participantId === message.participantId) {
    return message;
  }

  return { ...message, participantId };
}

export function canRelayMessage({ role, message }) {
  if (!message?.type) return false;
  if (isHostCommandMessage(message)) {
    return role === ROOM_ROLE.HOST;
  }
  if (isParticipantStatusMessage(message)) {
    return role === ROOM_ROLE.PARTICIPANT;
  }
  return false;
}

export function canSendSignalingMessage({
  isHost,
  message,
  localParticipantId = "",
}) {
  if (!message?.type) return false;

  if (isHostCommandMessage(message)) {
    return isHost;
  }

  if (isParticipantStatusMessage(message)) {
    if (isHost) return false;
    return message.participantId === localParticipantId;
  }

  return false;
}

export function canReceiveSignalingMessage({
  isHost,
  message,
  senderId = "",
  localParticipantId = "",
}) {
  if (!message?.type) return false;

  if (isHost) {
    if (!isParticipantStatusMessage(message)) return false;
    const participantId = message.participantId || senderId;
    return Boolean(participantId) && participantId === senderId;
  }

  if (PARTICIPANT_STATUS_BROADCAST_TYPES.has(message.type)) {
    return (
      Boolean(message.participantId) &&
      message.participantId !== localParticipantId &&
      senderId !== message.participantId
    );
  }

  if (!isHostCommandMessage(message)) return false;

  if (
    message.type === SIGNALING_MESSAGE.HOST_PRESENT ||
    message.type === SIGNALING_MESSAGE.RECORDING_STATE ||
    message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED ||
    message.type === SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST ||
    message.type === SIGNALING_MESSAGE.MEETING_ENDED ||
    message.type === SIGNALING_MESSAGE.KICK_PARTICIPANT ||
    HOST_MEDIA_BROADCAST_TYPES.has(message.type)
  ) {
    return true;
  }

  if (HOST_MUTE_ALL_TYPES.has(message.type)) {
    return true;
  }

  if (!message.participantId) {
    return message.type === SIGNALING_MESSAGE.HOST_PRESENT;
  }

  return message.participantId === localParticipantId;
}

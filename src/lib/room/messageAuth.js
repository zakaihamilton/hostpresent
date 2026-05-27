import { ROOM_ROLE } from "@/lib/room/tokens";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";

const HOST_COMMAND_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_PRESENT,
  SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_VIDEO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
  SIGNALING_MESSAGE.RECORDING_STATE,
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
]);

const PARTICIPANT_STATUS_TYPES = new Set([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
]);

const HOST_MUTE_ALL_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
]);

export function isHostCommandMessage(message) {
  return HOST_COMMAND_TYPES.has(message?.type);
}

export function isParticipantStatusMessage(message) {
  return PARTICIPANT_STATUS_TYPES.has(message?.type);
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
    return message.participantId === senderId;
  }

  if (!isHostCommandMessage(message)) return false;

  if (
    message.type === SIGNALING_MESSAGE.HOST_PRESENT ||
    message.type === SIGNALING_MESSAGE.RECORDING_STATE ||
    message.type === SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST
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

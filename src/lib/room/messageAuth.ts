import { ROOM_ROLE } from "@/lib/room/roles";
import {
  type ChatMessage,
  isChatMessage,
  SIGNALING_MESSAGE,
  type SignalingMessage,
} from "@/lib/signaling/messages";

type HostCommandType =
  | typeof SIGNALING_MESSAGE.HOST_PRESENT
  | typeof SIGNALING_MESSAGE.HOST_AUDIO_MUTED
  | typeof SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED
  | typeof SIGNALING_MESSAGE.HOST_VIDEO_MUTED
  | typeof SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED
  | typeof SIGNALING_MESSAGE.HOST_MUTE_AUDIO
  | typeof SIGNALING_MESSAGE.HOST_MUTE_VIDEO
  | typeof SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO
  | typeof SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO
  | typeof SIGNALING_MESSAGE.HOST_FOCUS_CHANGED
  | typeof SIGNALING_MESSAGE.RECORDING_STATE
  | typeof SIGNALING_MESSAGE.MEETING_ENDED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST
  | typeof SIGNALING_MESSAGE.ROOM_FULL;
type ParticipantStatusType =
  | typeof SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_PROFILE
  | typeof SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED
  | typeof SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED
  | typeof SIGNALING_MESSAGE.MEDIA_RENEGOTIATE;

const HOST_COMMAND_TYPES = new Set<string>([
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
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
  SIGNALING_MESSAGE.ROOM_FULL,
]);

const HOST_MEDIA_BROADCAST_TYPES = new Set<string>([
  SIGNALING_MESSAGE.HOST_AUDIO_MUTED,
  SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_MUTED,
  SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED,
]);

const PARTICIPANT_STATUS_TYPES = new Set<string>([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
  SIGNALING_MESSAGE.MEDIA_RENEGOTIATE,
]);

const HOST_MUTE_ALL_TYPES = new Set<string>([
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
]);

const PARTICIPANT_STATUS_BROADCAST_TYPES = new Set<string>([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
]);

export function isHostCommandMessage(
  message: unknown,
): message is SignalingMessage & { type: HostCommandType } {
  return (
    Boolean(message) &&
    typeof message === "object" &&
    "type" in message &&
    typeof message.type === "string" &&
    HOST_COMMAND_TYPES.has(message.type)
  );
}

export function isParticipantStatusMessage(
  message: unknown,
): message is SignalingMessage & { type: ParticipantStatusType } {
  return (
    Boolean(message) &&
    typeof message === "object" &&
    "type" in message &&
    typeof message.type === "string" &&
    PARTICIPANT_STATUS_TYPES.has(message.type)
  );
}

export function resolveParticipantStatusMessage(
  message: SignalingMessage,
  { senderId = "" }: { senderId?: string } = {},
) {
  if (!isParticipantStatusMessage(message)) return message;

  const participantId = message.participantId || senderId;
  if (!participantId || participantId === message.participantId) {
    return message;
  }

  return { ...message, participantId };
}

export function canRelayMessage({
  role,
  message,
}: {
  role?: string;
  message?: SignalingMessage | null;
}) {
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
}: {
  isHost?: boolean;
  message?: SignalingMessage | null;
  localParticipantId?: string;
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
}: {
  isHost?: boolean;
  message?: SignalingMessage | null;
  senderId?: string;
  localParticipantId?: string;
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
    message.type === SIGNALING_MESSAGE.ROOM_FULL ||
    HOST_MEDIA_BROADCAST_TYPES.has(message.type)
  ) {
    return true;
  }

  if (HOST_MUTE_ALL_TYPES.has(message.type)) {
    return true;
  }

  if (!message.participantId) {
    return false;
  }

  return message.participantId === localParticipantId;
}

export type AuthenticatedChatMessage = ChatMessage & {
  senderId: string;
  senderName: string;
  relayedByHost: boolean;
};

export function authenticateChatMessage(
  message: unknown,
  {
    senderId = "",
    expectedSenderId = "",
    senderName = "",
    allowHostRelay = false,
  }: {
    senderId?: string;
    expectedSenderId?: string;
    senderName?: string;
    allowHostRelay?: boolean;
  } = {},
): AuthenticatedChatMessage | null {
  if (
    !isChatMessage(message) ||
    !senderId ||
    !expectedSenderId ||
    senderId !== expectedSenderId
  ) {
    return null;
  }

  if (
    message.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE &&
    (typeof message.recipientId !== "string" || !message.recipientId.trim())
  ) {
    return null;
  }

  const isAuthenticatedHostRelay =
    allowHostRelay &&
    message.relayedByHost === true &&
    typeof message.senderId === "string" &&
    Boolean(message.senderId.trim());
  const trustedSenderName =
    typeof senderName === "string" ? senderName.trim().slice(0, 32) : "";
  const relayedSenderName =
    typeof message.senderName === "string" ? message.senderName.trim() : "";
  const authenticatedSenderName =
    isAuthenticatedHostRelay && relayedSenderName
      ? relayedSenderName.slice(0, 32)
      : trustedSenderName;

  return {
    ...message,
    senderId: isAuthenticatedHostRelay ? message.senderId : senderId,
    senderName: authenticatedSenderName,
    text: message.text.trim(),
    relayedByHost: isAuthenticatedHostRelay,
  };
}

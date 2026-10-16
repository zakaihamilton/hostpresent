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
  HOST_FOCUS_CHANGED: "host_focus_changed",
  RECORDING_STATE: "recording_state",
  MEETING_ENDED: "meeting_ended",
  PARTICIPANT_AUDIO_MUTED: "participant_audio_muted",
  PARTICIPANT_VIDEO_MUTED: "participant_video_muted",
  PARTICIPANT_AUDIO_UNMUTED: "participant_audio_unmuted",
  PARTICIPANT_VIDEO_UNMUTED: "participant_video_unmuted",
  PARTICIPANT_PROFILE: "participant_profile",
  PARTICIPANT_PROFILE_BROADCAST: "participant_profile_broadcast",
  PARTICIPANT_SCREEN_SHARE_STARTED: "participant_screen_share_started",
  PARTICIPANT_SCREEN_SHARE_STOPPED: "participant_screen_share_stopped",
  CHAT_MESSAGE: "chat_message",
  CHAT_PRIVATE_MESSAGE: "chat_private_message",
  ROOM_FULL: "room_full",
  MEDIA_RENEGOTIATE: "media_renegotiate",
} as const;

export type SignalingMessageType =
  (typeof SIGNALING_MESSAGE)[keyof typeof SIGNALING_MESSAGE];
export type ParticipantMode = "available" | "listening";
export type ParticipantType = "audio" | "video";

export interface RoomEnvelope {
  roomId?: string;
  token?: string;
}

export interface SignalingMessage {
  type: SignalingMessageType;
  timestamp?: number;
  participantId?: string;
  participantType?: ParticipantType;
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  text?: string;
  displayName?: string;
  deviceId?: string;
  mode?: ParticipantMode;
  sessionTitle?: string;
  focusedId?: string;
  active?: boolean;
  paused?: boolean;
  present?: boolean;
  audioMuted?: boolean;
  videoMuted?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  screenSharing?: boolean;
  relayedByHost?: boolean;
  [field: string]: unknown;
}

export type ChatMessage =
  | (SignalingMessage & {
      type: typeof SIGNALING_MESSAGE.CHAT_MESSAGE;
      senderId?: string;
      senderName?: string;
      text: string;
      timestamp: number;
    })
  | (SignalingMessage & {
      type: typeof SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE;
      senderId?: string;
      senderName?: string;
      recipientId?: string;
      text: string;
      timestamp: number;
    });

export const CHAT_MESSAGE_MAX_LENGTH = 500;
const MAX_CHAT_RECIPIENT_ID_LENGTH = 128;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

export function createRoomFullMessage() {
  return {
    type: SIGNALING_MESSAGE.ROOM_FULL,
    timestamp: Date.now(),
  };
}

export function createHostPresentMessage({
  displayName = "",
  audioMuted = false,
  videoMuted = false,
  mode = "available",
  sessionTitle = "",
  screenSharing = false,
}: {
  displayName?: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
  mode?: ParticipantMode;
  sessionTitle?: string;
  screenSharing?: boolean;
} = {}): SignalingMessage {
  return {
    type: SIGNALING_MESSAGE.HOST_PRESENT,
    displayName: typeof displayName === "string" ? displayName.trim() : "",
    audioMuted: Boolean(audioMuted),
    videoMuted: Boolean(videoMuted),
    mode: mode === "listening" ? "listening" : "available",
    sessionTitle: typeof sessionTitle === "string" ? sessionTitle.trim() : "",
    screenSharing: Boolean(screenSharing),
    timestamp: Date.now(),
  };
}

export function createHostFocusChangedMessage({
  focusedId = "host",
}: {
  focusedId?: string;
} = {}) {
  const id = typeof focusedId === "string" ? focusedId : "host";
  return {
    type: SIGNALING_MESSAGE.HOST_FOCUS_CHANGED,
    focusedId: id,
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

export function createHostMuteAudioMessage({
  participantId,
  participantType,
}: {
  participantId?: string;
  participantType?: ParticipantType;
}) {
  return {
    type: SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createHostMuteVideoMessage({
  participantId,
}: {
  participantId?: string;
}) {
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

export function createRecordingStateMessage({
  active,
  paused = false,
}: {
  active?: boolean;
  paused?: boolean;
}) {
  return {
    type: SIGNALING_MESSAGE.RECORDING_STATE,
    active: Boolean(active),
    paused: Boolean(paused),
    timestamp: Date.now(),
  };
}

export function createMeetingEndedMessage() {
  return {
    type: SIGNALING_MESSAGE.MEETING_ENDED,
    timestamp: Date.now(),
  };
}

export function createParticipantAudioMutedMessage({
  participantId,
  participantType,
}: {
  participantId?: string;
  participantType?: ParticipantType;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createParticipantVideoMutedMessage({
  participantId,
}: {
  participantId?: string;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
    participantId,
    timestamp: Date.now(),
  };
}

export function createParticipantAudioUnmutedMessage({
  participantId,
  participantType,
}: {
  participantId?: string;
  participantType?: ParticipantType;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
    participantId,
    participantType,
    timestamp: Date.now(),
  };
}

export function createParticipantVideoUnmutedMessage({
  participantId,
}: {
  participantId?: string;
}) {
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
  deviceId = "",
}: {
  participantId?: string;
  displayName?: string;
  mode?: ParticipantMode;
  deviceId?: string;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
    participantId,
    displayName:
      typeof displayName === "string" ? displayName.trim().slice(0, 32) : "",
    mode: mode === "listening" ? "listening" : "available",
    deviceId: typeof deviceId === "string" ? deviceId.trim().slice(0, 128) : "",
    timestamp: Date.now(),
  };
}

export function createParticipantProfileBroadcastMessage({
  participantId,
  displayName = "",
  mode = "available",
  present = true,
  screenSharing = false,
  isAudioMuted = false,
  isVideoMuted = false,
}: {
  participantId?: string;
  displayName?: string;
  mode?: ParticipantMode;
  present?: boolean;
  screenSharing?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
    participantId,
    present: Boolean(present),
    displayName:
      typeof displayName === "string" ? displayName.trim().slice(0, 32) : "",
    mode: mode === "listening" ? "listening" : "available",
    screenSharing: Boolean(screenSharing),
    isAudioMuted: Boolean(isAudioMuted),
    isVideoMuted: Boolean(isVideoMuted),
    timestamp: Date.now(),
  };
}

export function createParticipantScreenShareStartedMessage({
  participantId,
}: {
  participantId: string;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
    participantId,
    timestamp: Date.now(),
  };
}

export function createParticipantScreenShareStoppedMessage({
  participantId,
}: {
  participantId: string;
}) {
  return {
    type: SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
    participantId,
    timestamp: Date.now(),
  };
}

export function createMediaRenegotiateMessage({
  participantId,
}: {
  participantId?: string;
} = {}) {
  return {
    type: SIGNALING_MESSAGE.MEDIA_RENEGOTIATE,
    participantId,
    timestamp: Date.now(),
  };
}

export function parseSignalingMessage(raw: unknown): unknown {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  return raw;
}

export function isSignalingMessage(
  message: unknown,
): message is SignalingMessage {
  if (!message || typeof message !== "object") return false;
  const type = (message as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    Object.values(SIGNALING_MESSAGE).includes(type as SignalingMessageType)
  );
}

export function createChatMessage({
  senderId,
  senderName,
  text,
}: {
  senderId?: string;
  senderName?: string;
  text?: string;
}) {
  return {
    type: SIGNALING_MESSAGE.CHAT_MESSAGE,
    senderId,
    senderName:
      typeof senderName === "string" ? senderName.trim().slice(0, 32) : "",
    text:
      typeof text === "string"
        ? text.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH)
        : "",
    timestamp: Date.now(),
  };
}

export function createChatPrivateMessage({
  senderId,
  senderName,
  recipientId,
  text,
}: {
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  text?: string;
}) {
  return {
    type: SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE,
    senderId,
    senderName:
      typeof senderName === "string" ? senderName.trim().slice(0, 32) : "",
    recipientId,
    text:
      typeof text === "string"
        ? text.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH)
        : "",
    timestamp: Date.now(),
  };
}

export function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  if (
    (candidate.type !== SIGNALING_MESSAGE.CHAT_MESSAGE &&
      candidate.type !== SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE) ||
    typeof candidate.text !== "string" ||
    !candidate.text.trim() ||
    candidate.text.length > CHAT_MESSAGE_MAX_LENGTH ||
    typeof candidate.timestamp !== "number" ||
    !Number.isSafeInteger(candidate.timestamp) ||
    candidate.timestamp < 0 ||
    candidate.timestamp > MAX_DATE_TIMESTAMP
  ) {
    return false;
  }

  if (candidate.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE) {
    return (
      typeof candidate.recipientId === "string" &&
      Boolean(candidate.recipientId.trim()) &&
      candidate.recipientId.length <= MAX_CHAT_RECIPIENT_ID_LENGTH
    );
  }

  return true;
}

export function withRoomEnvelope(
  message: SignalingMessage,
  { roomId, token }: RoomEnvelope,
) {
  return {
    ...message,
    roomId,
    token,
  };
}

import type { DataConnection } from "peerjs";
import { type MutableRefObject, useCallback, useEffect, useRef } from "react";
import {
  canSendSignalingMessage,
  isParticipantStatusMessage,
} from "@/lib/room/messageAuth";
import { getOrCreateParticipantDeviceId } from "@/lib/settings/participantDeviceId";
import type {
  ChatMessage,
  ParticipantMode,
  SignalingMessage,
} from "@/lib/signaling/messages";
import {
  createChatMessage,
  createChatPrivateMessage,
  createHostPresentMessage,
  createParticipantProfileMessage,
  isSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import type { AudienceMediaController } from "@/lib/webrtc/AudienceMediaController";
import { hostPeerId } from "@/lib/webrtc/peerClient";
import { sendOnConnection } from "./sendOnConnection";
import type {
  RoomMessageHandler,
  SendParticipantProfileOptions,
} from "./types";

export function useRoomMessaging({
  isHost,
  roomId,
  displayName,
  participantMode,
  roomIdRef,
  localParticipantIdRef,
  connectionsRef,
  hostConnectionRef,
  audienceRef,
  localStreamRef,
  screenStreamRef,
  displayNameRef,
  hostAudioMutedRef,
  hostVideoMutedRef,
  hostModeRef,
  participantModeRef,
  sessionTitleRef,
  onChatMessageRef,
}: {
  isHost: boolean;
  roomId?: string | null;
  displayName: string;
  participantMode: ParticipantMode;
  roomIdRef: MutableRefObject<string | null | undefined>;
  localParticipantIdRef: MutableRefObject<string>;
  connectionsRef: MutableRefObject<Map<string, DataConnection>>;
  hostConnectionRef: MutableRefObject<DataConnection | null>;
  audienceRef: MutableRefObject<AudienceMediaController | null>;
  localStreamRef: MutableRefObject<MediaStream | null>;
  screenStreamRef: MutableRefObject<MediaStream | null>;
  displayNameRef: MutableRefObject<string>;
  hostAudioMutedRef: MutableRefObject<boolean>;
  hostVideoMutedRef: MutableRefObject<boolean>;
  hostModeRef: MutableRefObject<ParticipantMode>;
  participantModeRef: MutableRefObject<ParticipantMode>;
  sessionTitleRef: MutableRefObject<string>;
  onChatMessageRef: MutableRefObject<((message: ChatMessage) => void) | null>;
}) {
  const handlersRef = useRef(new Set<RoomMessageHandler>());
  const sendParticipantProfileRef = useRef<
    (options?: SendParticipantProfileOptions) => boolean
  >(() => false);

  const createHostPresencePayload = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    return createHostPresentMessage({
      displayName: displayNameRef.current,
      audioMuted: audioTrack ? !audioTrack.enabled : hostAudioMutedRef.current,
      videoMuted: videoTrack ? !videoTrack.enabled : hostVideoMutedRef.current,
      mode: hostModeRef.current,
      sessionTitle: sessionTitleRef.current,
      screenSharing: Boolean(screenStreamRef.current),
    });
  }, [
    displayNameRef,
    hostAudioMutedRef,
    hostModeRef,
    hostVideoMutedRef,
    localStreamRef,
    screenStreamRef,
    sessionTitleRef,
  ]);

  const notifyHandlers = useCallback(
    (message: SignalingMessage | ChatMessage) => {
      for (const handler of handlersRef.current) {
        handler(message);
      }
    },
    [],
  );

  const subscribe = useCallback((handler: RoomMessageHandler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const send = useCallback(
    (message: unknown) => {
      if (!isSignalingMessage(message)) return false;

      let outboundMessage = message;
      if (!isHost && isParticipantStatusMessage(message)) {
        const participantId = localParticipantIdRef.current;
        if (!participantId) return false;
        outboundMessage = { ...message, participantId };
      }

      if (
        !canSendSignalingMessage({
          isHost,
          message: outboundMessage,
          localParticipantId: localParticipantIdRef.current,
        })
      ) {
        return false;
      }

      if (isHost) {
        if (message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED)
          audienceRef.current?.focus(
            message.focusedId === "host"
              ? hostPeerId(roomIdRef.current)
              : message.focusedId,
          );
        const targetId = message.participantId;
        if (
          targetId &&
          (message.type === SIGNALING_MESSAGE.HOST_MUTE_AUDIO ||
            message.type === SIGNALING_MESSAGE.HOST_MUTE_VIDEO)
        ) {
          const conn = connectionsRef.current.get(targetId);
          return sendOnConnection(conn, outboundMessage);
        }

        let sent = false;
        for (const conn of connectionsRef.current.values()) {
          if (sendOnConnection(conn, outboundMessage)) sent = true;
        }
        return sent;
      }

      return sendOnConnection(hostConnectionRef.current, outboundMessage);
    },
    [
      audienceRef,
      connectionsRef,
      hostConnectionRef,
      isHost,
      localParticipantIdRef,
      roomIdRef,
    ],
  );

  const sendParticipantProfile = useCallback(
    ({
      nextDisplayName,
      nextParticipantMode,
    }: SendParticipantProfileOptions = {}) => {
      if (isHost) return false;

      const participantId = localParticipantIdRef.current;
      if (!participantId || !hostConnectionRef.current?.open) {
        return false;
      }

      return sendOnConnection(
        hostConnectionRef.current,
        createParticipantProfileMessage({
          participantId,
          displayName:
            nextDisplayName === undefined
              ? displayNameRef.current
              : nextDisplayName,
          mode:
            nextParticipantMode === undefined
              ? participantModeRef.current
              : nextParticipantMode,
          deviceId: getOrCreateParticipantDeviceId(),
        }),
      );
    },
    [
      displayNameRef,
      hostConnectionRef,
      isHost,
      localParticipantIdRef,
      participantModeRef,
    ],
  );

  useEffect(() => {
    sendParticipantProfileRef.current = sendParticipantProfile;
  }, [sendParticipantProfile]);

  useEffect(() => {
    if (isHost) return undefined;
    sendParticipantProfile({
      nextDisplayName: displayName,
      nextParticipantMode: participantMode,
    });
  }, [displayName, isHost, participantMode, sendParticipantProfile]);

  const sendToParticipant = useCallback(
    (participantId: string, message: unknown) => {
      if (!isHost || !participantId || !isSignalingMessage(message)) {
        return false;
      }
      if (
        !canSendSignalingMessage({
          isHost,
          message,
          localParticipantId: localParticipantIdRef.current,
        })
      ) {
        return false;
      }

      const conn = connectionsRef.current.get(participantId);
      return sendOnConnection(conn, message);
    },
    [connectionsRef, isHost, localParticipantIdRef],
  );

  const deliverChatMessage = useCallback(
    (message: ChatMessage, recipientId?: string) => {
      if (isHost) {
        let sent = false;
        if (recipientId) {
          sent = sendOnConnection(
            connectionsRef.current.get(recipientId),
            message,
          );
        } else {
          for (const conn of connectionsRef.current.values()) {
            if (sendOnConnection(conn, message)) sent = true;
          }
        }
        notifyHandlers(message);
        onChatMessageRef.current?.(message);
        return sent;
      }

      const sent = sendOnConnection(hostConnectionRef.current, message);
      if (sent) onChatMessageRef.current?.(message);
      return sent;
    },
    [
      connectionsRef,
      hostConnectionRef,
      isHost,
      notifyHandlers,
      onChatMessageRef,
    ],
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      const senderId = isHost
        ? hostPeerId(roomId)
        : localParticipantIdRef.current;
      const message = createChatMessage({
        senderId,
        senderName: displayNameRef.current,
        text,
      });
      if (!message.text) return false;
      return deliverChatMessage(message);
    },
    [deliverChatMessage, displayNameRef, isHost, localParticipantIdRef, roomId],
  );

  const sendPrivateChatMessage = useCallback(
    (text: string, recipientId: string) => {
      const senderId = isHost
        ? hostPeerId(roomId)
        : localParticipantIdRef.current;
      const message = createChatPrivateMessage({
        senderId,
        senderName: displayNameRef.current,
        recipientId,
        text,
      });
      if (!message.text || !recipientId) return false;
      return deliverChatMessage(message, recipientId);
    },
    [deliverChatMessage, displayNameRef, isHost, localParticipantIdRef, roomId],
  );

  return {
    createHostPresencePayload,
    notifyHandlers,
    subscribe,
    send,
    sendToParticipant,
    sendChatMessage,
    sendPrivateChatMessage,
    sendParticipantProfileRef,
  };
}

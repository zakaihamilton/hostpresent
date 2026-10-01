import {
  authenticateChatMessage,
  canReceiveSignalingMessage,
  resolveParticipantStatusMessage,
} from "@/lib/room/messageAuth";
import {
  isChatMessage,
  isSignalingMessage,
  parseSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import { isMediaControl } from "@/lib/webrtc/audienceProtocol";
import { hostPeerId } from "@/lib/webrtc/peerClient";
import { sendOnConnection } from "./sendOnConnection";

const MAX_DATA_CHANNEL_MESSAGE_CHARS = 16_384;

const PARTICIPANT_STATUS_RELAY_TYPES = new Set([
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
  SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
  SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
]);

export function bindRoomConnection(
  conn,
  { remoteId, remoteName = "Guest" },
  context,
) {
  const connectionPeerId = conn.peer || remoteId;

  const handleOpen = () => {
    if (
      context.destroyedRef.current ||
      context.isCurrentConnection?.() === false
    )
      return;
    context.updateConnectedState(1);
    context.onMediaOpen?.(connectionPeerId);
    if (context.isHost) {
      sendOnConnection(conn, context.createHostPresencePayload());
      context.onRemoteParticipantRef.current?.({
        id: remoteId,
        name: remoteName,
      });
      return;
    }

    context.sendParticipantProfileRef.current();
  };

  if (conn.open) {
    handleOpen();
  } else {
    conn.on("open", handleOpen);
  }

  conn.on("close", () => {
    if (
      context.destroyedRef.current ||
      context.isCurrentConnection?.() === false
    )
      return;
    context.updateConnectedState(-1);
    context.onMediaClose?.(connectionPeerId);
    if (context.isHost) {
      context.onRemoteParticipantRef.current?.({ id: remoteId, stream: null });
      return;
    }
    context.scheduleReconnectToHost();
  });

  conn.on("data", (raw) => {
    if (
      context.destroyedRef.current ||
      context.isCurrentConnection?.() === false
    )
      return;
    try {
      const payload = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (
        typeof payload !== "string" ||
        payload.length > MAX_DATA_CHANNEL_MESSAGE_CHARS
      ) {
        return;
      }
      const message = parseSignalingMessage(payload);

      if (isMediaControl(message)) {
        if (
          context.isHost ||
          connectionPeerId === hostPeerId(context.roomIdRef.current)
        ) {
          context.onMediaControl?.(connectionPeerId, message);
        }
        return;
      }

      if (isChatMessage(message)) {
        const authenticatedMessage = authenticateChatMessage(message, {
          senderId: connectionPeerId,
          expectedSenderId: context.isHost
            ? connectionPeerId
            : hostPeerId(context.roomIdRef.current),
          senderName: context.isHost
            ? (context.participantDisplayNamesRef.current.get(
                connectionPeerId,
              ) ?? "Guest")
            : context.hostDisplayNameRef.current || "Host",
          allowHostRelay: !context.isHost,
        });
        if (!authenticatedMessage) return;

        if (context.isHost) {
          const hostRelayedMessage = {
            ...authenticatedMessage,
            relayedByHost: true,
          };
          if (authenticatedMessage.type === SIGNALING_MESSAGE.CHAT_MESSAGE) {
            for (const [id, connection] of context.connectionsRef.current) {
              if (id !== connectionPeerId) {
                sendOnConnection(connection, hostRelayedMessage);
              }
            }
          }
          if (
            authenticatedMessage.type ===
              SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE &&
            authenticatedMessage.recipientId
          ) {
            const hostId = hostPeerId(context.roomIdRef.current);
            if (authenticatedMessage.recipientId !== hostId) {
              const recipientConnection = context.connectionsRef.current.get(
                authenticatedMessage.recipientId,
              );
              if (recipientConnection) {
                sendOnConnection(recipientConnection, hostRelayedMessage);
              }
              return;
            }
          }
        }
        if (
          !context.isHost &&
          authenticatedMessage.type ===
            SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE &&
          authenticatedMessage.recipientId !==
            context.localParticipantIdRef.current
        ) {
          return;
        }
        context.notifyHandlers(authenticatedMessage);
        context.onChatMessageRef.current?.(authenticatedMessage);
        return;
      }

      if (!isSignalingMessage(message)) return;
      const resolvedMessage = resolveParticipantStatusMessage(message, {
        senderId: connectionPeerId,
      });
      if (
        !canReceiveSignalingMessage({
          isHost: context.isHost,
          message: resolvedMessage,
          senderId: connectionPeerId,
          localParticipantId: context.localParticipantIdRef.current,
        })
      ) {
        return;
      }
      context.notifyHandlers(resolvedMessage);
      if (
        context.isHost &&
        resolvedMessage.type === SIGNALING_MESSAGE.PARTICIPANT_PROFILE
      ) {
        context.participantDisplayNamesRef.current.set(
          connectionPeerId,
          resolvedMessage.displayName || "Guest",
        );
        if (
          typeof resolvedMessage.deviceId === "string" &&
          resolvedMessage.deviceId
        ) {
          context.peerDeviceIdsRef.current.set(
            connectionPeerId,
            resolvedMessage.deviceId,
          );
        }
      }
      if (
        !context.isHost &&
        resolvedMessage.type === SIGNALING_MESSAGE.HOST_PRESENT
      ) {
        context.hostDisplayNameRef.current =
          resolvedMessage.displayName || "Host";
      }
      if (
        context.isHost &&
        resolvedMessage.participantId &&
        PARTICIPANT_STATUS_RELAY_TYPES.has(resolvedMessage.type)
      ) {
        for (const [id, connection] of context.connectionsRef.current) {
          if (id !== connectionPeerId) {
            sendOnConnection(connection, resolvedMessage);
          }
        }
      }
      if (!context.isHost && message.type === SIGNALING_MESSAGE.HOST_PRESENT) {
        context.setHostPresent(true);
        context.setConnectionError(null);
      }
    } catch (error) {
      console.warn("[peer] invalid message", error);
    }
  });
}

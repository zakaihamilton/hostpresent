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
  {
    isHost,
    destroyedRef,
    updateConnectedState,
    createHostPresencePayload,
    onRemoteParticipantRef,
    ensureMediaCall,
    syncRelayForViewer,
    sendParticipantProfileRef,
    scheduleReconnectToHost,
    roomIdRef,
    participantDisplayNamesRef,
    hostDisplayNameRef,
    localParticipantIdRef,
    connectionsRef,
    notifyHandlers,
    onChatMessageRef,
    peerDeviceIdsRef,
    preservingParticipantMediaCallsRef,
    mediaCallsRef,
    syncRelayForSource,
    setHostPresent,
    setConnectionError,
  },
) {
  const connectionPeerId = conn.peer || remoteId;

  const handleOpen = () => {
    if (destroyedRef.current) return;
    updateConnectedState(1);
    if (isHost) {
      sendOnConnection(conn, createHostPresencePayload());
      onRemoteParticipantRef.current?.({ id: remoteId, name: remoteName });
      ensureMediaCall(remoteId).catch((error) => {
        console.warn("[peer] placeOutgoingMediaCall failed", error);
      });
      syncRelayForViewer(remoteId);
      return;
    }

    sendParticipantProfileRef.current();
  };

  if (conn.open) {
    handleOpen();
  } else {
    conn.on("open", handleOpen);
  }

  conn.on("close", () => {
    if (destroyedRef.current) return;
    updateConnectedState(-1);
    if (isHost) {
      onRemoteParticipantRef.current?.({ id: remoteId, stream: null });
      return;
    }
    scheduleReconnectToHost();
  });

  conn.on("data", (raw) => {
    if (destroyedRef.current) return;
    try {
      const payload = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (
        typeof payload !== "string" ||
        payload.length > MAX_DATA_CHANNEL_MESSAGE_CHARS
      ) {
        return;
      }
      const message = parseSignalingMessage(payload);

      if (isChatMessage(message)) {
        const authenticatedMessage = authenticateChatMessage(message, {
          senderId: connectionPeerId,
          expectedSenderId: isHost
            ? connectionPeerId
            : hostPeerId(roomIdRef.current),
          senderName: isHost
            ? (participantDisplayNamesRef.current.get(connectionPeerId) ??
              "Guest")
            : hostDisplayNameRef.current || "Host",
          allowHostRelay: !isHost,
        });
        if (!authenticatedMessage) return;

        if (isHost) {
          const hostRelayedMessage = {
            ...authenticatedMessage,
            relayedByHost: true,
          };
          if (authenticatedMessage.type === SIGNALING_MESSAGE.CHAT_MESSAGE) {
            for (const [id, connection] of connectionsRef.current) {
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
            const hostId = hostPeerId(roomIdRef.current);
            if (authenticatedMessage.recipientId !== hostId) {
              const recipientConnection = connectionsRef.current.get(
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
          !isHost &&
          authenticatedMessage.type ===
            SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE &&
          authenticatedMessage.recipientId !== localParticipantIdRef.current
        ) {
          return;
        }
        notifyHandlers(authenticatedMessage);
        onChatMessageRef.current?.(authenticatedMessage);
        return;
      }

      if (!isSignalingMessage(message)) return;
      const resolvedMessage = resolveParticipantStatusMessage(message, {
        senderId: connectionPeerId,
      });
      if (
        !canReceiveSignalingMessage({
          isHost,
          message: resolvedMessage,
          senderId: connectionPeerId,
          localParticipantId: localParticipantIdRef.current,
        })
      ) {
        return;
      }
      notifyHandlers(resolvedMessage);
      if (
        isHost &&
        resolvedMessage.type === SIGNALING_MESSAGE.PARTICIPANT_PROFILE
      ) {
        participantDisplayNamesRef.current.set(
          connectionPeerId,
          resolvedMessage.displayName || "Guest",
        );
        if (
          typeof resolvedMessage.deviceId === "string" &&
          resolvedMessage.deviceId
        ) {
          peerDeviceIdsRef.current.set(
            connectionPeerId,
            resolvedMessage.deviceId,
          );
        }
      }
      if (!isHost && resolvedMessage.type === SIGNALING_MESSAGE.HOST_PRESENT) {
        hostDisplayNameRef.current = resolvedMessage.displayName || "Host";
      }
      if (
        isHost &&
        resolvedMessage.type === SIGNALING_MESSAGE.MEDIA_RENEGOTIATE
      ) {
        const targetId = resolvedMessage.participantId || connectionPeerId;
        if (targetId) {
          const existingCall = mediaCallsRef.current.get(targetId);
          if (existingCall) {
            preservingParticipantMediaCallsRef.current.add(existingCall);
            existingCall.close();
            if (mediaCallsRef.current.get(targetId) === existingCall) {
              mediaCallsRef.current.delete(targetId);
              onRemoteParticipantRef.current?.({
                id: targetId,
                stream: null,
                preserveProfile: true,
              });
              syncRelayForSource(targetId, null);
            }
          }
          ensureMediaCall(targetId).catch((error) => {
            console.warn("[peer] renegotiation media call failed", error);
          });
        }
      }
      if (
        isHost &&
        resolvedMessage.participantId &&
        PARTICIPANT_STATUS_RELAY_TYPES.has(resolvedMessage.type)
      ) {
        for (const [id, connection] of connectionsRef.current) {
          if (id !== connectionPeerId) {
            sendOnConnection(connection, resolvedMessage);
          }
        }
      }
      if (!isHost && message.type === SIGNALING_MESSAGE.HOST_PRESENT) {
        setHostPresent(true);
        setConnectionError(null);
      }
    } catch (error) {
      console.warn("[peer] invalid message", error);
    }
  });
}

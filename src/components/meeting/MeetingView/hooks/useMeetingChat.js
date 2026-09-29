import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import { hostPeerId } from "@/lib/webrtc/peerClient";

export function useMeetingChat({
  isHost,
  roomId,
  roomConnectionRef,
  isChatVisible,
  setHasUnreadChat,
}) {
  const [chatMessages, setChatMessages] = useState([]);
  const chatIdCounterRef = useRef(0);
  const receiveChatMessage = (message) => {
    const localId = isHost
      ? roomId
        ? hostPeerId(roomId)
        : ""
      : (roomConnectionRef.current?.localParticipantId ?? "");
    const isSelf = message.senderId === localId;
    const id = `${message.timestamp}-${message.senderId}-${chatIdCounterRef.current}`;
    chatIdCounterRef.current += 1;
    setChatMessages((previous) => [
      ...previous,
      {
        id,
        senderId: message.senderId,
        senderName: message.senderName || "Guest",
        text: message.text,
        timestamp: message.timestamp,
        isPrivate: message.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE,
        recipientId: message.recipientId,
        isSelf,
      },
    ]);
    if (!isChatVisible) {
      setHasUnreadChat(true);
    }
  };

  useEffect(() => {
    if (isChatVisible) {
      setHasUnreadChat(false);
    }
  }, [isChatVisible, setHasUnreadChat]);

  const handleSendChatMessage = useCallback(
    (text, recipientId) => {
      const connection = roomConnectionRef.current;
      if (recipientId) {
        connection?.sendPrivateChatMessage(text, recipientId);
      } else {
        connection?.sendChatMessage(text);
      }
    },
    [roomConnectionRef],
  );

  return { chatMessages, receiveChatMessage, handleSendChatMessage };
}

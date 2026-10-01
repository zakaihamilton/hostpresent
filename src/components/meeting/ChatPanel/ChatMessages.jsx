import { Chat as ChatIcon } from "@/components/ui/Icons";
import styles from "./ChatPanel.module.css";
import { formatTime } from "./formatTime";

export function ChatMessages({ messages, messagesEndRef }) {
  return (
    <div className={styles.messages}>
      {messages.length === 0 ? (
        <div className={styles.empty}>
          <ChatIcon size={24} />
          <span>No messages yet</span>
          <span>Send a message to everyone or privately to a participant.</span>
        </div>
      ) : (
        messages.map((msg) => {
          const isSelf = msg.isSelf;
          const isPrivateMessage = msg.isPrivate;
          const senderLabel = isSelf ? "You" : msg.senderName || "Guest";

          return (
            <div
              key={msg.id}
              className={`${styles.message} ${isSelf ? styles.messageSelf : styles.messageOther} ${isPrivateMessage ? styles.messagePrivate : ""}`}
            >
              <div className={styles.messageBubble}>{msg.text}</div>
              <div className={styles.messageMeta}>
                <span>{senderLabel}</span>
                <span>{formatTime(msg.timestamp)}</span>
                {isPrivateMessage ? (
                  <span className={styles.privateBadge}>private</span>
                ) : null}
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

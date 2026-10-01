import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Chat as ChatIcon, Download, Send, X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { buildRecordingFilename } from "@/lib/recordingFilename";
import { ChatMessages } from "./ChatMessages";
import styles from "./ChatPanel.module.css";
import { formatTime } from "./formatTime";
import { RecipientDropdown } from "./RecipientDropdown";

export const ChatPanel = memo(function ChatPanel({
  visible,
  messages,
  participants = [],
  onClose,
  onSendMessage,
  flex,
  sessionName,
}) {
  const [text, setText] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const recipientName =
    recipientId && recipientId !== "everyone"
      ? (participants.find((p) => p.id === recipientId)?.name ?? "")
      : "";

  const isPrivate = Boolean(recipientId && recipientId !== "everyone");

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isPrivate && recipientId) {
      onSendMessage(trimmed, recipientId);
    } else {
      onSendMessage(trimmed);
    }
    setText("");
    inputRef.current?.focus();
  }, [text, isPrivate, recipientId, onSendMessage]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleDownloadChat = useCallback(() => {
    if (messages.length === 0) return;
    const lines = messages.map((msg) => {
      const sender = msg.isSelf ? "You" : msg.senderName || "Guest";
      const time = formatTime(msg.timestamp);
      const label = msg.isPrivate ? " (private)" : "";
      return `[${time}] ${sender}${label}: ${msg.text}`;
    });
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const filename = buildRecordingFilename({ sessionName, extension: "txt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, sessionName]);

  return (
    <div
      className={`${styles.slot} ${visible ? "" : styles.slotClosed} ${flex ? styles.slotFlex : ""}`}
      aria-hidden={!visible}
    >
      <aside className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <ChatIcon size={18} />
            <span>Chat</span>
          </div>
          <div className={styles.headerActions}>
            {messages.length > 0
              ? <Tooltip text="Save chat" placement="left">
                  <button
                    type="button"
                    className={styles.downloadButton}
                    onClick={handleDownloadChat}
                    aria-label="Save chat"
                  >
                    <Download size={18} />
                  </button>
                </Tooltip>
              : null}
            {onClose
              ? <Tooltip text="Close chat" placement="left">
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close chat"
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              : null}
          </div>
        </div>

        <ChatMessages messages={messages} messagesEndRef={messagesEndRef} />

        <div className={styles.inputArea}>
          <div className={styles.recipientToggle}>
            <span className={styles.recipientLabel}>To:</span>
            <RecipientDropdown
              participants={participants}
              recipientId={recipientId}
              onChange={setRecipientId}
            />
            {isPrivate
              ? <span className={styles.privateHint}>(private)</span>
              : null}
          </div>
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.textInput}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isPrivate && recipientName
                  ? `Message ${recipientName}…`
                  : "Send a message…"
              }
              rows={1}
              aria-label="Chat message"
            />
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!text.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
});

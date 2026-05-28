import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Chat as ChatIcon, ChevronDown, Send, X } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./ChatPanel.module.css";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RecipientDropdown({ participants, recipientId, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const selectedName =
    recipientId && recipientId !== "everyone"
      ? (participants.find((p) => p.id === recipientId)?.name ?? "Everyone")
      : "Everyone";

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPositioned(false);
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    setCoords({
      top: triggerRect.bottom + 4,
      left: Math.max(8, triggerRect.left + triggerRect.width - menuRect.width),
    });
    setPositioned(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = useCallback(
    (id) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div className={styles.dropdownWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.dropdownTrigger} ${open ? styles.dropdownTriggerActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select message recipient"
      >
        <span className={styles.dropdownLabel}>{selectedName}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          <ChevronDown size={14} />
        </span>
      </button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              className={`${styles.dropdownMenu} ${positioned ? styles.dropdownMenuVisible : ""}`}
              style={{
                top: coords.top,
                left: coords.left,
              }}
            >
              <button
                type="button"
                role="option"
                aria-selected={!recipientId || recipientId === "everyone"}
                className={`${styles.dropdownItem} ${(!recipientId || recipientId === "everyone") ? styles.dropdownItemSelected : ""}`}
                onClick={() => handleSelect("")}
              >
                <span className={styles.dropdownItemIcon}>
                  {!recipientId || recipientId === "everyone" ? <span className={styles.dropdownCheckmark}>&#10003;</span> : null}
                </span>
                <span>Everyone</span>
              </button>
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={recipientId === p.id}
                  className={`${styles.dropdownItem} ${recipientId === p.id ? styles.dropdownItemSelected : ""}`}
                  onClick={() => handleSelect(p.id)}
                >
                  <span className={styles.dropdownItemIcon}>
                    {recipientId === p.id ? <span className={styles.dropdownCheckmark}>&#10003;</span> : null}
                  </span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ChatPanel({
  visible,
  messages,
  participants = [],
  onClose,
  onSendMessage,
  flex,
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

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
    }
  }, [visible]);

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

        <div className={styles.messages}>
          {messages.length === 0
            ? <div className={styles.empty}>
                <ChatIcon size={24} />
                <span>No messages yet</span>
                <span>
                  Send a message to everyone or privately to a participant.
                </span>
              </div>
            : messages.map((msg) => {
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
                      {isPrivateMessage
                        ? <span className={styles.privateBadge}>private</span>
                        : null}
                    </div>
                  </div>
                );
              })}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <div className={styles.recipientToggle}>
            <span>To:</span>
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
}

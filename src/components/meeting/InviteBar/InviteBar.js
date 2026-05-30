"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import styles from "./InviteBar.module.css";

export const InviteBar = memo(function InviteBar({
  inviteLink,
  inviteCopyMessage,
  onCopyInviteLink,
  onDismiss,
  roomId,
}) {
  const dialogId = useId();
  const inviteCopyButtonLabel = inviteCopyMessage || "Copy link";
  const shareButtonClassName = [
    styles.shareButton,
    inviteCopyMessage === "Copied!" && styles.shareButtonSuccess,
    inviteCopyMessage === "Copy failed" && styles.shareButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  const [codeCopyMessage, setCodeCopyMessage] = useState("");
  const codeCopyTimerRef = useRef(null);

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) return;
    if (codeCopyTimerRef.current) clearTimeout(codeCopyTimerRef.current);
    const copied = await copyTextToClipboard(roomId);
    setCodeCopyMessage(copied ? "Copied!" : "Copy failed");
    codeCopyTimerRef.current = setTimeout(() => {
      setCodeCopyMessage("");
      codeCopyTimerRef.current = null;
    }, 2500);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (codeCopyTimerRef.current) clearTimeout(codeCopyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const codeButtonClassName = [
    styles.codeButton,
    codeCopyMessage === "Copied!" && styles.codeButtonSuccess,
    codeCopyMessage === "Copy failed" && styles.codeButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.backdrop} onClick={onDismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={dialogId} className={styles.title}>
            Invite participants
          </h2>
          <Tooltip text="Hide invite link" placement="top">
            <button
              type="button"
              className={styles.shareDismiss}
              onClick={onDismiss}
              aria-label="Hide invite link"
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        <p className={styles.description}>
          Share this link with others so they can join your meeting.
        </p>

        <div className={styles.shareBar}>
          <input
            className={styles.shareInput}
            readOnly
            value={inviteLink}
            aria-label="Participant invite link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={shareButtonClassName}
            onClick={onCopyInviteLink}
            aria-live="polite"
          >
            {inviteCopyButtonLabel}
          </button>
        </div>

        {roomId && (
          <div className={styles.codeSection}>
            <span className={styles.codeLabel}>Room code</span>
            <div className={styles.codeRow}>
              <span className={styles.codeValue}>{roomId}</span>
              <button
                type="button"
                className={codeButtonClassName}
                onClick={handleCopyRoomId}
                aria-live="polite"
                aria-label="Copy room code"
              >
                {codeCopyMessage || "Copy code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

"use client";

import { memo, useEffect, useId } from "react";
import { X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./InviteBar.module.css";

export const InviteBar = memo(function InviteBar({
  inviteLink,
  inviteCopyMessage,
  onCopyInviteLink,
  onDismiss,
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

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
      </div>
    </div>
  );
});

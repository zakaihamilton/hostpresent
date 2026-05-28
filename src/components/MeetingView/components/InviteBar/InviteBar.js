"use client";

import { memo } from "react";
import { X } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./InviteBar.module.css";

export const InviteBar = memo(function InviteBar({
  inviteLink,
  inviteCopyMessage,
  onCopyInviteLink,
  onDismiss,
}) {
  const inviteCopyButtonLabel = inviteCopyMessage || "Copy link";
  const shareButtonClassName = [
    styles.shareButton,
    inviteCopyMessage === "Copied!" && styles.shareButtonSuccess,
    inviteCopyMessage === "Copy failed" && styles.shareButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.shareBar}>
      <input
        className={styles.shareInput}
        readOnly
        value={inviteLink}
        aria-label="Participant invite link"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className={styles.shareActions}>
        <button
          type="button"
          className={shareButtonClassName}
          onClick={onCopyInviteLink}
          aria-live="polite"
        >
          {inviteCopyButtonLabel}
        </button>
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
    </div>
  );
});

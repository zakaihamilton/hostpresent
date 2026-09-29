import { useCallback, useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";

export function useMeetingInvite(inviteLink) {
  const [inviteBarVisible, setInviteBarVisible] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const inviteCopyTimerRef = useRef(null);
  useEffect(
    () => () => {
      if (inviteCopyTimerRef.current) clearTimeout(inviteCopyTimerRef.current);
    },
    [],
  );
  const handleShowInviteBar = useCallback(() => {
    setInviteBarVisible(true);
  }, []);

  const handleDismissInviteBar = useCallback(() => {
    setInviteBarVisible(false);
  }, []);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    if (inviteCopyTimerRef.current) {
      clearTimeout(inviteCopyTimerRef.current);
    }

    const copied = await copyTextToClipboard(inviteLink);
    setInviteCopyMessage(copied ? "Copied!" : "Copy failed");

    inviteCopyTimerRef.current = setTimeout(() => {
      setInviteCopyMessage("");
      inviteCopyTimerRef.current = null;
    }, 2500);
  };

  return {
    inviteBarVisible,
    inviteCopyMessage,
    handleShowInviteBar,
    handleDismissInviteBar,
    handleCopyInviteLink,
  };
}

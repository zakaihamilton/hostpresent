import { useCallback, useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import styles from "./Header.module.css";

export function JoinCodeControl({ roomId }) {
  const [roomIdCopyMessage, setRoomIdCopyMessage] = useState("");
  const roomIdCopyTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (roomIdCopyTimerRef.current) {
        clearTimeout(roomIdCopyTimerRef.current);
      }
    },
    [],
  );

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) return;

    if (roomIdCopyTimerRef.current) {
      clearTimeout(roomIdCopyTimerRef.current);
    }

    const copied = await copyTextToClipboard(roomId);
    setRoomIdCopyMessage(copied ? "Copied!" : "Copy failed");

    roomIdCopyTimerRef.current = setTimeout(() => {
      setRoomIdCopyMessage("");
      roomIdCopyTimerRef.current = null;
    }, 2500);
  }, [roomId]);

  const roomIdButtonLabel = roomIdCopyMessage || roomId;
  const roomIdButtonClassName = [
    styles.roomIdCopyButton,
    roomIdCopyMessage === "Copied!" && styles.roomIdCopyButtonSuccess,
    roomIdCopyMessage === "Copy failed" && styles.roomIdCopyButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {roomId
        ? <div className={`${styles.stat} ${styles.statRoom}`}>
            <span className={styles.statLabel}>Join code</span>
            <Tooltip text="Copy join code" placement="bottom">
              <button
                type="button"
                className={roomIdButtonClassName}
                onClick={handleCopyRoomId}
                aria-live="polite"
                aria-label={
                  roomIdCopyMessage
                    ? roomIdCopyMessage
                    : `Copy join code ${roomId}`
                }
              >
                <span className={styles.roomIdValue}>{roomIdButtonLabel}</span>
              </button>
            </Tooltip>
          </div>
        : null}
    </>
  );
}

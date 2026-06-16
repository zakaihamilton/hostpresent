import { Chat, Gallery, Pip, Users } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./LayoutControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function LayoutControls({
  isGalleryVisible,
  isSidebarVisible,
  isPipVisible,
  isChatVisible,
  hasUnreadChat = false,
  onToggleGallery,
  onToggleSidebar,
  onTogglePip,
  onToggleChat,
  participantCount = 0,
}) {
  return (
    <div className={styles.cluster}>
      <Tooltip
        text={isGalleryVisible ? "Hide Video Gallery" : "Show Video Gallery"}
      >
        <button
          type="button"
          className={btnClass(isGalleryVisible && styles.btnActive)}
          onClick={onToggleGallery}
          aria-label={
            isGalleryVisible ? "Hide video gallery" : "Show video gallery"
          }
        >
          <Gallery />
        </button>
      </Tooltip>

      <Tooltip
        text={isSidebarVisible ? "Hide Participants" : "Show Participants"}
      >
        <button
          type="button"
          className={btnClass(isSidebarVisible && styles.btnActive)}
          onClick={onToggleSidebar}
          aria-label={
            isSidebarVisible ? "Hide participants" : "Show participants"
          }
        >
          <Users />
          {participantCount > 0
            ? <span className={styles.countBadge}>{participantCount}</span>
            : null}
        </button>
      </Tooltip>

      <Tooltip text={isChatVisible ? "Hide Chat" : "Show Chat"}>
        <button
          type="button"
          className={btnClass(isChatVisible && styles.btnActive)}
          onClick={onToggleChat}
          aria-label={isChatVisible ? "Hide chat" : "Show chat"}
        >
          <Chat />
          {hasUnreadChat && !isChatVisible
            ? <span className={styles.unreadBadge} aria-hidden="true" />
            : null}
        </button>
      </Tooltip>

      <Tooltip text={isPipVisible ? "Hide Self-View" : "Show Self-View"}>
        <button
          type="button"
          className={btnClass(isPipVisible && styles.btnActive)}
          onClick={onTogglePip}
          aria-label={isPipVisible ? "Hide self-view" : "Show self-view"}
        >
          <Pip />
        </button>
      </Tooltip>
    </div>
  );
}

import { Chat, Gallery, Pip, Users } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./LayoutControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function LayoutControls({
  isGalleryVisible,
  isSidebarVisible,
  isPipVisible,
  isChatVisible,
  onToggleGallery,
  onToggleSidebar,
  onTogglePip,
  onToggleChat,
}) {
  return (
    <div className={styles.cluster}>
      <Tooltip
        text={isGalleryVisible ? "Hide Video Gallery" : "Show Video Gallery"}
      >
        <button
          type="button"
          className={btnClass(
            styles.galleryBtn,
            isGalleryVisible && styles.btnActive,
          )}
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
          className={btnClass(
            styles.sidebarBtn,
            isSidebarVisible && styles.btnActive,
          )}
          onClick={onToggleSidebar}
          aria-label={
            isSidebarVisible ? "Hide participants" : "Show participants"
          }
        >
          <Users />
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
        </button>
      </Tooltip>

      <Tooltip text={isPipVisible ? "Hide Self-View" : "Show Self-View"}>
        <button
          type="button"
          className={btnClass(styles.pipBtn, isPipVisible && styles.btnActive)}
          onClick={onTogglePip}
          aria-label={isPipVisible ? "Hide self-view" : "Show self-view"}
        >
          <Pip />
        </button>
      </Tooltip>
    </div>
  );
}

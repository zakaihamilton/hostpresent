import { Gallery, Users } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./LayoutControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function LayoutControls({
  isGalleryVisible,
  isSidebarVisible,
  onToggleGallery,
  onToggleSidebar,
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
            styles.participantsBtn,
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
    </div>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ScreenShare } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./ScreenShareControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function ScreenShareControls({
  screenStream,
  shareScreenAudio,
  isScreenAudioShared,
  onToggleScreenShare,
  onShareScreenAudioChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const clusterRef = useRef(null);
  const menuId = useId();
  const headingId = `${menuId}-heading`;
  const isSharing = Boolean(screenStream);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event) => {
      if (!clusterRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isSharing) return;
    setMenuOpen(false);
  }, [isSharing]);

  return (
    <div className={styles.cluster} ref={clusterRef}>
      <Tooltip text={isSharing ? "Stop screen sharing" : "Share screen"}>
        <button
          type="button"
          className={btnClass(styles.shareBtn, isSharing && styles.btnActive)}
          onClick={onToggleScreenShare}
        >
          <ScreenShare />
          <span className={styles.shareLabel}>
            {isSharing ? "Stop" : "Share"}
          </span>
        </button>
      </Tooltip>

      <div className={styles.menuWrap}>
        <Tooltip text="Screen share settings">
          <button
            type="button"
            className={btnClass(
              styles.menuBtn,
              isSharing && styles.btnActive,
              menuOpen && styles.menuBtnOpen,
            )}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown />
          </button>
        </Tooltip>

        {menuOpen && (
          <div
            id={menuId}
            role="dialog"
            aria-labelledby={headingId}
            className={styles.menu}
          >
            <p id={headingId} className={styles.menuHeading}>
              Screen share settings
            </p>

            {isSharing && (
              <p className={styles.menuStatus}>
                Currently sharing{" "}
                <strong>
                  {isScreenAudioShared ? "with audio" : "video only"}
                </strong>
                . Change the option below for your next share.
              </p>
            )}

            <fieldset className={styles.menuFieldset}>
              <legend className={styles.menuLegend}>Audio</legend>
              <label
                className={`${styles.menuOption} ${!shareScreenAudio ? styles.menuOptionSelected : ""}`}
              >
                <input
                  type="radio"
                  name="screenShareMode"
                  checked={!shareScreenAudio}
                  onChange={() => onShareScreenAudioChange(false)}
                  className={styles.menuOptionInput}
                />
                <span className={styles.menuOptionContent}>
                  <span className={styles.menuOptionTitle}>Video only</span>
                  <span className={styles.menuOptionHint}>
                    Share your screen without tab or system audio
                  </span>
                </span>
              </label>
              <label
                className={`${styles.menuOption} ${shareScreenAudio ? styles.menuOptionSelected : ""}`}
              >
                <input
                  type="radio"
                  name="screenShareMode"
                  checked={shareScreenAudio}
                  onChange={() => onShareScreenAudioChange(true)}
                  className={styles.menuOptionInput}
                />
                <span className={styles.menuOptionContent}>
                  <span className={styles.menuOptionTitle}>With audio</span>
                  <span className={styles.menuOptionHint}>
                    Include tab or system audio when the browser allows it
                  </span>
                </span>
              </label>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}

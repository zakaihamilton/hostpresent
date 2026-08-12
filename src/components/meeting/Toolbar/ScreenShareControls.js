"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ScreenShare } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToolbarMenuPosition } from "./useToolbarMenu";
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
  const menuAnchorRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const headingId = `${menuId}-heading`;
  const isSharing = Boolean(screenStream);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
  }, []);

  const { menuCoords, menuPositioned, mounted } = useToolbarMenuPosition({
    menuOpen,
    menuAnchorRef,
    menuRef,
  });


  useEffect(() => {
    if (!menuOpen) return;

    requestAnimationFrame(() => {
      menuRef.current?.querySelector("input, button")?.focus();
    });

    const handlePointerDown = (event) => {
      if (
        clusterRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      closeMenu(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    if (!isSharing) return;
    closeMenu(true);
  }, [closeMenu, isSharing]);

  return (
    <div className={styles.cluster} ref={clusterRef}>
      <Tooltip text={isSharing ? "Stop screen sharing" : "Share screen"}>
        <button
          type="button"
          className={btnClass(styles.shareBtn, isSharing && styles.btnActive)}
          onClick={onToggleScreenShare}
          aria-label={isSharing ? "Stop screen sharing" : "Share screen"}
        >
          <ScreenShare />
        </button>
      </Tooltip>

      <div className={styles.menuWrap} ref={menuAnchorRef}>
        <Tooltip text="Screen share settings" forceHidden={menuOpen}>
          <button
            ref={menuTriggerRef}
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
      </div>

      {mounted && menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="dialog"
              aria-labelledby={headingId}
              className={styles.menu}
              style={{
                top: menuCoords.top,
                left: menuCoords.left,
                visibility: menuPositioned ? "visible" : "hidden",
              }}
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

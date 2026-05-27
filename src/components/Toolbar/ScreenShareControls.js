"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ScreenShare } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./ScreenShareControls.module.css";

const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeMenuPosition(anchorRect, menuRect) {
  const width = menuRect.width;
  let left = anchorRect.right - width;
  left = clamp(
    left,
    VIEWPORT_PADDING,
    window.innerWidth - width - VIEWPORT_PADDING,
  );

  let top = anchorRect.top - MENU_GAP - menuRect.height;
  if (top < VIEWPORT_PADDING) {
    top = anchorRect.bottom + MENU_GAP;
  }
  top = clamp(
    top,
    VIEWPORT_PADDING,
    window.innerHeight - menuRect.height - VIEWPORT_PADDING,
  );

  return { top, left };
}

export function ScreenShareControls({
  screenStream,
  shareScreenAudio,
  isScreenAudioShared,
  onToggleScreenShare,
  onShareScreenAudioChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [menuPositioned, setMenuPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const clusterRef = useRef(null);
  const menuAnchorRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const headingId = `${menuId}-heading`;
  const isSharing = Boolean(screenStream);

  const updateMenuPosition = () => {
    const anchor = menuAnchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    setMenuCoords(computeMenuPosition(anchorRect, menuRect));
  };

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPositioned(false);
      return;
    }

    updateMenuPosition();
    setMenuPositioned(true);

    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [menuOpen, isSharing, shareScreenAudio]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event) => {
      if (
        clusterRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setMenuOpen(false);
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
          aria-label={isSharing ? "Stop screen sharing" : "Share screen"}
        >
          <ScreenShare />
        </button>
      </Tooltip>

      <div className={styles.menuWrap} ref={menuAnchorRef}>
        <Tooltip text="Screen share settings" forceHidden={menuOpen}>
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

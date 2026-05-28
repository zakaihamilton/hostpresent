"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Mic, MicOff, Video, VideoOff } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./MediaControls.module.css";

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

export function MediaControls({
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  availableCameras = [],
  selectedCamera = "",
  onCameraChange,
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
  }, [menuOpen, availableCameras]);

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

  return (
    <div className={styles.cluster}>
      <Tooltip text={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}>
        <button
          type="button"
          className={btnClass(styles.audioBtn, isAudioMuted && styles.btnDanger)}
          onClick={onToggleAudio}
          aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isAudioMuted ? <MicOff /> : <Mic />}
        </button>
      </Tooltip>

      <div className={styles.videoCluster} ref={clusterRef}>
        <Tooltip text={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}>
          <button
            type="button"
            className={btnClass(styles.videoBtn, isVideoMuted && styles.btnDanger)}
            onClick={onToggleVideo}
            aria-label={isVideoMuted ? "Turn camera on" : "Turn camera off"}
          >
            {isVideoMuted ? <VideoOff /> : <Video />}
          </button>
        </Tooltip>

        <div className={styles.menuWrap} ref={menuAnchorRef}>
          <Tooltip text="Camera settings" forceHidden={menuOpen}>
            <button
              type="button"
              className={btnClass(
                styles.menuBtn,
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
                Camera
              </p>

              {availableCameras.length === 0 ? (
                <p className={styles.menuEmpty}>No cameras detected</p>
              ) : (
                <fieldset className={styles.menuFieldset}>
                  <legend className={styles.menuLegend}>Camera</legend>
                  {availableCameras.map((camera) => (
                    <label
                      key={camera.deviceId}
                      className={`${styles.menuOption} ${selectedCamera === camera.deviceId ? styles.menuOptionSelected : ""}`}
                    >
                      <input
                        type="radio"
                        name="camera"
                        checked={selectedCamera === camera.deviceId}
                        onChange={() => onCameraChange?.(camera.deviceId)}
                        className={styles.menuOptionInput}
                      />
                      <span className={styles.menuOptionContent}>
                        <span className={styles.menuOptionTitle}>
                          {camera.label ||
                            `Camera ${availableCameras.indexOf(camera) + 1}`}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

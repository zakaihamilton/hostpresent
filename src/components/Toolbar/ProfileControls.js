"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserCircle } from "@/components/Icons";
import { DisplayNameField } from "@/components/DisplayNameField";
import { ParticipantModeToggle } from "@/components/ParticipantModeToggle";
import { Tooltip } from "@/components/Tooltip";
import tooltipStyles from "@/components/Tooltip/Tooltip.module.css";
import { resolveDisplayName } from "@/lib/settings/displayNameSettings";
import styles from "./ProfileControls.module.css";

const POPUP_GAP = 8;
const VIEWPORT_PADDING = 8;

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computePopupPosition(anchorRect, popupRect) {
  const width = popupRect.width;
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  left = clamp(
    left,
    VIEWPORT_PADDING,
    window.innerWidth - width - VIEWPORT_PADDING,
  );

  let top = anchorRect.top - POPUP_GAP - popupRect.height;
  if (top < VIEWPORT_PADDING) {
    top = anchorRect.bottom + POPUP_GAP;
  }
  top = clamp(
    top,
    VIEWPORT_PADDING,
    window.innerHeight - popupRect.height - VIEWPORT_PADDING,
  );

  return { top, left };
}

export function ProfileControls({
  displayName,
  onDisplayNameChange,
  participantMode = null,
  onParticipantModeChange = null,
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [popupPositioned, setPopupPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const clusterRef = useRef(null);
  const anchorRef = useRef(null);
  const popupRef = useRef(null);
  const popupId = useId();
  const headingId = `${popupId}-heading`;
  const resolvedName = resolveDisplayName(displayName);

  const updatePopupPosition = () => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    setPopupCoords(computePopupPosition(anchorRect, popupRect));
  };

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!popupOpen) {
      setPopupPositioned(false);
      return;
    }

    updatePopupPosition();
    setPopupPositioned(true);

    const handleReposition = () => updatePopupPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [popupOpen, participantMode]);

  useEffect(() => {
    if (!popupOpen) return;

    const handlePointerDown = (event) => {
      if (
        clusterRef.current?.contains(event.target) ||
        popupRef.current?.contains(event.target)
      ) {
        return;
      }
      setPopupOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPopupOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [popupOpen]);

  useEffect(() => {
    if (!popupOpen) return;
    document.getElementById("meeting-display-name")?.focus();
  }, [popupOpen]);

  return (
    <div className={styles.cluster} ref={clusterRef}>
      <div ref={anchorRef}>
        <Tooltip
          forceHidden={popupOpen}
          content={
            <>
              <span className={tooltipStyles.tooltipPrimary}>{resolvedName}</span>
              <span className={tooltipStyles.tooltipSecondary}>
                Click to edit name
              </span>
            </>
          }
        >
          <button
            type="button"
            className={btnClass(popupOpen && styles.btnActive)}
            aria-expanded={popupOpen}
            aria-haspopup="dialog"
            aria-controls={popupId}
            aria-label={`Display name: ${resolvedName}`}
            onClick={() => setPopupOpen((open) => !open)}
          >
            <UserCircle />
          </button>
        </Tooltip>
      </div>

      {mounted && popupOpen
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              role="dialog"
              aria-labelledby={headingId}
              className={styles.popup}
              style={{
                top: popupCoords.top,
                left: popupCoords.left,
                visibility: popupPositioned ? "visible" : "hidden",
              }}
            >
              <p id={headingId} className={styles.popupHeading}>
                Your name
              </p>
              <p className={styles.popupHint}>
                This is how other participants will see you in the meeting.
              </p>

              <DisplayNameField
                id="meeting-display-name"
                label="Display name"
                value={displayName}
                onChange={onDisplayNameChange}
                placeholder="Enter your name"
                className={styles.nameField}
              />

              {onParticipantModeChange && participantMode
                ? <>
                    <p className={styles.modeHeading}>Participation mode</p>
                    <ParticipantModeToggle
                      value={participantMode}
                      onChange={onParticipantModeChange}
                    />
                  </>
                : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ParticipantModeToggle } from "@/components/meeting/ParticipantModeToggle";
import { DisplayNameField } from "@/components/ui/DisplayNameField";
import { UserCircle } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import tooltipStyles from "@/components/ui/Tooltip/Tooltip.module.css";
import {
  PARTICIPANT_MODE,
  participantModeLabel,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";
import { useMicrophoneTest } from "./useMicrophoneTest";
import styles from "./ProfileControls.module.css";

const POPUP_GAP = 12;
const VIEWPORT_PADDING = 8;

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}


function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computePopupPosition(anchorRect, popupRect) {
  const width = popupRect.width;
  let left = anchorRect.left;

  // Align to anchor left or center, keep in viewport
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
  availableMicrophones = [],
  selectedMicrophone = "",
  onMicrophoneChange = null,
  isVoiceIsolationEnabled = true,
  isVoiceIsolationChanging = false,
  onVoiceIsolationChange = null,
  availableSpeakers = [],
  selectedSpeaker = "",
  onSpeakerChange = null,
  availableCameras = [],
  selectedCamera = "",
  onCameraChange = null,
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [popupPositioned, setPopupPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(displayName);

  const clusterRef = useRef(null);
  const anchorRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const popupId = useId();
  const headingId = `${popupId}-heading`;

  const resolvedName = resolveDisplayName(displayName);
  const hasParticipantMode = Boolean(
    onParticipantModeChange && participantMode,
  );
  const isListeningOnly = participantMode === PARTICIPANT_MODE.LISTENING;
  const modeLabel = participantModeLabel(participantMode);

  const closePopup = useCallback((restoreFocus = false) => {
    setPopupOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const updatePopupPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    setPopupCoords(computePopupPosition(anchorRect, popupRect));
  }, []);

  useEffect(() => {
    if (popupOpen) {
      setLocalDisplayName(displayName);
    }
  }, [popupOpen, displayName]);

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
  }, [popupOpen, updatePopupPosition]);

  useEffect(() => {
    if (!popupOpen) return;

    requestAnimationFrame(() => {
      popupRef.current?.querySelector("input, select, button")?.focus();
    });

    const handlePointerDown = (event) => {
      if (
        clusterRef.current?.contains(event.target) ||
        popupRef.current?.contains(event.target)
      ) {
        return;
      }
      closePopup(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closePopup(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePopup, popupOpen]);

  const { micTestState, micTestLevel, micTestStatus, handleTestMicrophone, stopMicTest } =
    useMicrophoneTest(selectedMicrophone);


  return (
    <div className={styles.cluster} ref={clusterRef}>
      <div ref={anchorRef}>
        <Tooltip
          forceHidden={popupOpen}
          content={
            <>
              <span className={tooltipStyles.tooltipPrimary}>
                {resolvedName}
              </span>
              <span className={tooltipStyles.tooltipSecondary}>
                {hasParticipantMode
                  ? "Click to edit name, participation mode, and device settings"
                  : "Click to edit name and device settings"}
              </span>
            </>
          }
        >
          <button
            ref={triggerRef}
            type="button"
            className={btnClass(popupOpen && styles.btnActive)}
            aria-expanded={popupOpen}
            aria-haspopup="dialog"
            aria-controls={popupId}
            aria-label={
              hasParticipantMode
                ? `Display name: ${resolvedName}. Participation mode: ${modeLabel}`
                : `Display name: ${resolvedName}`
            }
            onClick={() => setPopupOpen((open) => !open)}
          >
            <UserCircle />
            {hasParticipantMode
              ? <span
                  className={`${styles.modeBadge} ${isListeningOnly ? styles.modeBadgeListening : styles.modeBadgeAvailable}`}
                  aria-hidden
                >
                  {isListeningOnly ? "L" : "A"}
                </span>
              : null}
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
              <div className={styles.popupScroll}>
                <section className={styles.popupSection}>
                  <p id={headingId} className={styles.popupHeading}>
                    Your profile
                  </p>
                  <DisplayNameField
                    id="meeting-display-name"
                    label="Display name"
                    value={localDisplayName}
                    onChange={setLocalDisplayName}
                    placeholder="Enter your name"
                    className={styles.nameField}
                  />

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => closePopup(true)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={() => {
                        onDisplayNameChange(localDisplayName);
                        closePopup(true);
                      }}
                    >
                      Save
                    </button>
                  </div>

                  {onParticipantModeChange && participantMode
                    ? <>
                        <p className={styles.modeHeading}>Participation mode</p>
                        <ParticipantModeToggle
                          value={participantMode}
                          onChange={onParticipantModeChange}
                        />
                      </>
                    : null}
                </section>

                <div className={styles.popupDivider} />

                <section className={styles.popupSection}>
                  <p className={styles.popupHeading}>Audio & video devices</p>

                  <div className={styles.deviceField}>
                    <label
                      className={styles.deviceLabel}
                      htmlFor="microphone-device"
                    >
                      Microphone
                    </label>
                    {availableMicrophones.length === 0
                      ? <p className={styles.emptyDevices}>
                          No microphones detected
                        </p>
                      : <select
                          id="microphone-device"
                          className={styles.deviceSelect}
                          value={selectedMicrophone}
                          onChange={(e) => onMicrophoneChange?.(e.target.value)}
                          aria-label="Select microphone"
                        >
                          {availableMicrophones.map((mic) => (
                            <option key={mic.deviceId} value={mic.deviceId}>
                              {mic.label || "Microphone"}
                            </option>
                          ))}
                        </select>}

                    <label className={styles.voiceIsolationToggle}>
                      <input
                        type="checkbox"
                        checked={isVoiceIsolationEnabled}
                        disabled={
                          availableMicrophones.length === 0 ||
                          isVoiceIsolationChanging
                        }
                        onChange={(event) =>
                          onVoiceIsolationChange?.(event.target.checked)
                        }
                      />
                      <span className={styles.voiceIsolationCopy}>
                        <span className={styles.voiceIsolationTitle}>
                          Voice isolation
                        </span>
                        <span className={styles.voiceIsolationHint}>
                          Reduce background voices and noise
                        </span>
                      </span>
                      {isVoiceIsolationChanging
                        ? <span className={styles.voiceIsolationStatus}>
                            Updating...
                          </span>
                        : null}
                    </label>

                    <div className={styles.micTest}>
                      <button
                        type="button"
                        className={styles.testButton}
                        onClick={handleTestMicrophone}
                        disabled={
                          availableMicrophones.length === 0 ||
                          micTestState === "testing"
                        }
                      >
                        {micTestState === "testing" ? "Testing..." : "Test mic"}
                      </button>
                      <p className={styles.micTestStatus} aria-live="polite">
                        {micTestStatus}
                      </p>
                      <div className={styles.micMeter} aria-hidden>
                        <span
                          className={styles.micMeterBar}
                          style={{
                            transform: `scaleX(${Math.max(0.04, micTestLevel)})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.deviceField}>
                    <label
                      className={styles.deviceLabel}
                      htmlFor="speaker-device"
                    >
                      Audio output
                    </label>
                    {availableSpeakers.length === 0
                      ? <p className={styles.emptyDevices}>
                          Default system output
                        </p>
                      : <select
                          id="speaker-device"
                          className={styles.deviceSelect}
                          value={selectedSpeaker}
                          onChange={(e) => onSpeakerChange?.(e.target.value)}
                          aria-label="Select speaker"
                        >
                          {availableSpeakers.map((spk) => (
                            <option key={spk.deviceId} value={spk.deviceId}>
                              {spk.label || "Speaker"}
                            </option>
                          ))}
                        </select>}
                  </div>

                  <div className={styles.deviceField}>
                    <label
                      className={styles.deviceLabel}
                      htmlFor="camera-device"
                    >
                      Camera
                    </label>
                    {availableCameras.length === 0
                      ? <p className={styles.emptyDevices}>
                          No cameras detected
                        </p>
                      : <select
                          id="camera-device"
                          className={styles.deviceSelect}
                          value={selectedCamera}
                          onChange={(e) => onCameraChange?.(e.target.value)}
                          aria-label="Select camera"
                        >
                          {availableCameras.map((cam) => (
                            <option key={cam.deviceId} value={cam.deviceId}>
                              {cam.label || "Camera"}
                            </option>
                          ))}
                        </select>}
                  </div>
                </section>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

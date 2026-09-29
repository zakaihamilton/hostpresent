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
import styles from "./ProfileControls.module.css";
import { ProfileDeviceSettings } from "./ProfileDeviceSettings";
import { computePopupPosition } from "./popupPosition";
import { useMicrophoneTest } from "./useMicrophoneTest";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
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
  const { micTestState, micTestLevel, micTestStatus, handleTestMicrophone } =
    useMicrophoneTest(selectedMicrophone);

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
    setPopupCoords(computePopupPosition(anchorRect, popupRect, { gap: 12 }));
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

    const focusFrame = requestAnimationFrame(() => {
      if (!popupRef.current?.contains(document.activeElement)) {
        popupRef.current?.querySelector("input, button")?.focus();
      }
    });

    const handlePointerDown = (event) => {
      if (
        clusterRef.current?.contains(event.target) ||
        popupRef.current?.contains(event.target) ||
        event.target.closest?.("[data-custom-select-listbox]")
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
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePopup, popupOpen]);

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

                <ProfileDeviceSettings
                  {...{
                    availableMicrophones,
                    selectedMicrophone,
                    onMicrophoneChange,
                    isVoiceIsolationEnabled,
                    isVoiceIsolationChanging,
                    onVoiceIsolationChange,
                    availableSpeakers,
                    selectedSpeaker,
                    onSpeakerChange,
                    availableCameras,
                    selectedCamera,
                    onCameraChange,
                    micTestState,
                    micTestLevel,
                    micTestStatus,
                    handleTestMicrophone,
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

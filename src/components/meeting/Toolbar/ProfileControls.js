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

const POPUP_GAP = 12;
const VIEWPORT_PADDING = 8;
const MIC_TEST_DURATION_MS = 2200;
const MIC_TEST_FRAME_MS = 120;
const MIC_SIGNAL_THRESHOLD = 0.04;

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
  const [micTestState, setMicTestState] = useState("idle");
  const [micTestLevel, setMicTestLevel] = useState(0);

  const clusterRef = useRef(null);
  const anchorRef = useRef(null);
  const popupRef = useRef(null);
  const micTestCleanupRef = useRef(null);
  const popupId = useId();
  const headingId = `${popupId}-heading`;

  const resolvedName = resolveDisplayName(displayName);
  const hasParticipantMode = Boolean(
    onParticipantModeChange && participantMode,
  );
  const isListeningOnly = participantMode === PARTICIPANT_MODE.LISTENING;
  const modeLabel = participantModeLabel(participantMode);

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

  useEffect(
    () => () => {
      micTestCleanupRef.current?.();
    },
    [],
  );

  const stopMicTest = () => {
    micTestCleanupRef.current?.();
    micTestCleanupRef.current = null;
  };

  const handleTestMicrophone = async () => {
    stopMicTest();
    setMicTestState("testing");
    setMicTestLevel(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicrophone
          ? { deviceId: { exact: selectedMicrophone } }
          : true,
        video: false,
      });
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("AudioContext is not available");
      }

      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let peakLevel = 0;

      const sample = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 3);
        peakLevel = Math.max(peakLevel, level);
        setMicTestLevel(level);
      };

      const intervalId = window.setInterval(sample, MIC_TEST_FRAME_MS);
      const timeoutId = window.setTimeout(() => {
        stopMicTest();
        setMicTestLevel(peakLevel);
        setMicTestState(
          peakLevel >= MIC_SIGNAL_THRESHOLD ? "detected" : "quiet",
        );
      }, MIC_TEST_DURATION_MS);

      micTestCleanupRef.current = () => {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
        source.disconnect();
        void context.close?.();
        for (const track of stream.getTracks()) {
          track.stop();
        }
      };
    } catch {
      stopMicTest();
      setMicTestLevel(0);
      setMicTestState("error");
    }
  };

  const micTestStatus =
    micTestState === "testing"
      ? "Testing..."
      : micTestState === "detected"
        ? "Microphone is working"
        : micTestState === "quiet"
          ? "No input detected"
          : micTestState === "error"
            ? "Could not test microphone"
            : "Speak after starting the test";

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
                      onClick={() => setPopupOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={() => {
                        onDisplayNameChange(localDisplayName);
                        setPopupOpen(false);
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
                    <label className={styles.deviceLabel}>Microphone</label>
                    {availableMicrophones.length === 0
                      ? <p className={styles.emptyDevices}>
                          No microphones detected
                        </p>
                      : <select
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
                    <label className={styles.deviceLabel}>Audio output</label>
                    {availableSpeakers.length === 0
                      ? <p className={styles.emptyDevices}>
                          Default system output
                        </p>
                      : <select
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
                    <label className={styles.deviceLabel}>Camera</label>
                    {availableCameras.length === 0
                      ? <p className={styles.emptyDevices}>
                          No cameras detected
                        </p>
                      : <select
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

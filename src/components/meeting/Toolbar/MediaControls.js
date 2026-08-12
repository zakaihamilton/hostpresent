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
import {
  ChevronDown,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMicrophoneTest } from "./useMicrophoneTest";
import { useToolbarMenuPosition } from "./useToolbarMenu";
import styles from "./MediaControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function MediaControls({
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  availableMicrophones = [],
  selectedMicrophone = "",
  onMicrophoneChange,
  availableSpeakers = [],
  selectedSpeaker = "",
  onSpeakerChange,
  availableCameras = [],
  selectedCamera = "",
  onCameraChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const clusterRef = useRef(null);
  const menuAnchorRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const headingId = `${menuId}-heading`;
  const microphoneSectionId = `${menuId}-microphone`;
  const outputSectionId = `${menuId}-output`;
  const videoSectionId = `${menuId}-video`;

  const { micTestState, micTestLevel, micTestStatus, handleTestMicrophone, stopMicTest } =
    useMicrophoneTest(selectedMicrophone);

  const { menuCoords, menuPositioned, mounted } = useToolbarMenuPosition({
    menuOpen,
    menuAnchorRef,
    menuRef,
  });

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
          className={btnClass(
            styles.audioBtn,
            isAudioMuted && styles.btnDanger,
          )}
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
            className={btnClass(
              styles.videoBtn,
              isVideoMuted && styles.btnDanger,
            )}
            onClick={onToggleVideo}
            aria-label={isVideoMuted ? "Turn camera on" : "Turn camera off"}
          >
            {isVideoMuted ? <VideoOff /> : <Video />}
          </button>
        </Tooltip>

        <div className={styles.menuWrap} ref={menuAnchorRef}>
          <Tooltip text="Audio & video settings" forceHidden={menuOpen}>
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
              <header className={styles.menuHeader}>
                <p id={headingId} className={styles.menuHeading}>
                  Audio & video
                </p>
                <p className={styles.menuSubheading}>
                  Choose the devices for this meeting.
                </p>
              </header>

              <div className={styles.menuContent}>
                <section
                  className={styles.menuSection}
                  aria-labelledby={microphoneSectionId}
                >
                  <div className={styles.menuSectionHeader}>
                    <h3
                      id={microphoneSectionId}
                      className={styles.menuSectionTitle}
                    >
                      Microphone
                    </h3>
                    <span className={styles.menuSectionMeta}>
                      {availableMicrophones.length > 0
                        ? `${availableMicrophones.length} available`
                        : "Unavailable"}
                    </span>
                  </div>

                  {availableMicrophones.length === 0
                    ? <p className={styles.menuEmpty}>
                        No microphones detected
                      </p>
                    : <fieldset className={styles.menuFieldset}>
                        <legend className={styles.menuLegend}>
                          Microphone
                        </legend>
                        {availableMicrophones.map((microphone, index) => (
                          <label
                            key={microphone.deviceId}
                            className={`${styles.menuOption} ${selectedMicrophone === microphone.deviceId ? styles.menuOptionSelected : ""}`}
                          >
                            <input
                              type="radio"
                              name="microphone"
                              checked={
                                selectedMicrophone === microphone.deviceId
                              }
                              onChange={() =>
                                onMicrophoneChange?.(microphone.deviceId)
                              }
                              className={styles.menuOptionInput}
                            />
                            <span className={styles.menuOptionContent}>
                              <span className={styles.menuOptionTitle}>
                                {microphone.label || `Microphone ${index + 1}`}
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>}
                  <div className={styles.micTest}>
                    <div className={styles.micTestControls}>
                      <button
                        type="button"
                        className={styles.testButton}
                        onClick={handleTestMicrophone}
                        disabled={
                          availableMicrophones.length === 0 ||
                          micTestState === "testing"
                        }
                      >
                        {micTestState === "testing"
                          ? "Testing..."
                          : "Test microphone"}
                      </button>
                      <p className={styles.micTestStatus} aria-live="polite">
                        {micTestStatus}
                      </p>
                    </div>
                    <div className={styles.micMeter} aria-hidden>
                      <span
                        className={styles.micMeterBar}
                        style={{
                          transform: `scaleX(${Math.max(0.04, micTestLevel)})`,
                        }}
                      />
                    </div>
                  </div>
                </section>

                <section
                  className={styles.menuSection}
                  aria-labelledby={outputSectionId}
                >
                  <div className={styles.menuSectionHeader}>
                    <h3
                      id={outputSectionId}
                      className={styles.menuSectionTitle}
                    >
                      Audio output
                    </h3>
                    <span className={styles.menuSectionMeta}>
                      {availableSpeakers.length > 0
                        ? `${availableSpeakers.length} available`
                        : "Browser limited"}
                    </span>
                  </div>

                  {availableSpeakers.length === 0
                    ? <p className={styles.menuEmpty}>
                        Output selection is not available in this browser
                      </p>
                    : <fieldset className={styles.menuFieldset}>
                        <legend className={styles.menuLegend}>
                          Audio output
                        </legend>
                        {availableSpeakers.map((speaker, index) => (
                          <label
                            key={speaker.deviceId}
                            className={`${styles.menuOption} ${selectedSpeaker === speaker.deviceId ? styles.menuOptionSelected : ""}`}
                          >
                            <input
                              type="radio"
                              name="speaker"
                              checked={selectedSpeaker === speaker.deviceId}
                              onChange={() =>
                                onSpeakerChange?.(speaker.deviceId)
                              }
                              className={styles.menuOptionInput}
                            />
                            <span className={styles.menuOptionContent}>
                              <span className={styles.menuOptionTitle}>
                                {speaker.label || `Speaker ${index + 1}`}
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>}
                </section>

                <section
                  className={styles.menuSection}
                  aria-labelledby={videoSectionId}
                >
                  <div className={styles.menuSectionHeader}>
                    <h3 id={videoSectionId} className={styles.menuSectionTitle}>
                      Video
                    </h3>
                    <span className={styles.menuSectionMeta}>
                      {availableCameras.length > 0
                        ? `${availableCameras.length} available`
                        : "Unavailable"}
                    </span>
                  </div>

                  {availableCameras.length === 0
                    ? <p className={styles.menuEmpty}>No cameras detected</p>
                    : <fieldset className={styles.menuFieldset}>
                        <legend className={styles.menuLegend}>Camera</legend>
                        {availableCameras.map((camera, index) => (
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
                                {camera.label || `Camera ${index + 1}`}
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>}
                </section>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

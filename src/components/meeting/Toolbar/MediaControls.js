"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./MediaControls.module.css";

const MENU_GAP = 8;
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
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [menuPositioned, setMenuPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [micTestState, setMicTestState] = useState("idle");
  const [micTestLevel, setMicTestLevel] = useState(0);
  const clusterRef = useRef(null);
  const menuAnchorRef = useRef(null);
  const menuRef = useRef(null);
  const micTestCleanupRef = useRef(null);
  const menuId = useId();
  const headingId = `${menuId}-heading`;
  const microphoneSectionId = `${menuId}-microphone`;
  const outputSectionId = `${menuId}-output`;
  const videoSectionId = `${menuId}-video`;

  const updateMenuPosition = () => {
    const anchor = menuAnchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const nextCoords = computeMenuPosition(anchorRect, menuRect);
    setMenuCoords((prev) =>
      prev.top === nextCoords.top && prev.left === nextCoords.left
        ? prev
        : nextCoords,
    );
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
  }, [menuOpen, updateMenuPosition]);

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

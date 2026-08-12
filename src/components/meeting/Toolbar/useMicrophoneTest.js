import { useEffect, useRef, useState } from "react";

export const MIC_TEST_DURATION_MS = 2200;
export const MIC_TEST_FRAME_MS = 120;
export const MIC_SIGNAL_THRESHOLD = 0.04;

export function useMicrophoneTest(selectedMicrophone) {
  const [micTestState, setMicTestState] = useState("idle");
  const [micTestLevel, setMicTestLevel] = useState(0);
  const micTestCleanupRef = useRef(null);

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

  return {
    micTestState,
    micTestLevel,
    micTestStatus,
    handleTestMicrophone,
    stopMicTest,
  };
}

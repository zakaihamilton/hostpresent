"use client";

import { useCallback, useEffect, useState } from "react";

export function useSessionTimers({ isRecording, isRecordingPaused, enabled }) {
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const resetRecordingTimer = useCallback(() => {
    setRecordingSeconds(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setMeetingSeconds((prev) => prev + 1);
      if (isRecording && !isRecordingPaused) {
        setRecordingSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, isRecording, isRecordingPaused]);

  return {
    meetingSeconds,
    recordingSeconds,
    resetRecordingTimer,
  };
}

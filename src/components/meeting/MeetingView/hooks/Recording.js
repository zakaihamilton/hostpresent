import { useCallback, useEffect, useRef, useState } from "react";
import { buildRecordingFilename } from "@/lib/recordingFilename";
import { createRecordingStateMessage } from "@/lib/signaling/messages";
import {
  loadSavedRecording,
  clearSavedRecording,
  saveRecordingChunk,
  saveRecordingMeta,
} from "@/lib/recordingStorage";
import {
  pickOutboundVideoTrack,
  resolveOutboundAudioTrack,
} from "@/lib/webrtc/outboundMedia";

function setStreamTracks(stream, tracks) {
  const currentTracks = stream.getTracks();
  for (const track of currentTracks) {
    if (!tracks.includes(track)) {
      stream.removeTrack(track);
    }
  }
  for (const track of tracks) {
    if (!currentTracks.includes(track)) {
      stream.addTrack(track);
    }
  }
}

function pickTracksForFocus({
  focusedParticipantId,
  videoParticipants,
  localStream,
  screenStream,
}) {
  const focusedParticipant =
    focusedParticipantId && focusedParticipantId !== "host"
      ? videoParticipants.find((p) => p.id === focusedParticipantId)
      : null;

  if (focusedParticipant?.stream) {
    return {
      videoTrack:
        focusedParticipant.stream
          .getVideoTracks()
          .find((t) => t.readyState === "live") ?? null,
      audioTrack:
        focusedParticipant.stream
          .getAudioTracks()
          .find((t) => t.readyState === "live") ?? null,
    };
  }

  return {
    videoTrack: pickOutboundVideoTrack(localStream, screenStream),
    audioTrack: null,
  };
}

function createRecorder(stream, options) {
  let recorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (e) {
    console.warn(
      "MP4 format not fully supported by browser, falling back to default.",
      e,
    );
    recorder = new MediaRecorder(stream);
  }
  return recorder;
}

export function Recording({
  isHost,
  roomConnection,
  localStream,
  screenStream,
  videoParticipants = [],
  focusedParticipantId = "host",
  resetRecordingTimer,
  videoParticipantsLength,
  isRecording,
  setIsRecording,
  isRecordingPaused,
  setIsRecordingPaused,
  sessionName = "",
}) {
  const [downloadState, setDownloadState] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const compositeStreamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const downloadDismissTimerRef = useRef(null);
  const switchingFocusRef = useRef(false);
  const prevFocusedIdRef = useRef(focusedParticipantId);
  const focusedIdRef = useRef(focusedParticipantId);
  focusedIdRef.current = focusedParticipantId;
  const chunkIndexRef = useRef(0);
  const unloadHandlerRef = useRef(null);

  const publishRecordingState = useCallback(
    (active, paused = false) => {
      if (!isHost) return;
      roomConnection?.send(createRecordingStateMessage({ active, paused }));
    },
    [isHost, roomConnection],
  );

  useEffect(() => {
    if (!isHost || !isRecording) return;
    publishRecordingState(true, isRecordingPaused);
  }, [
    isHost,
    isRecording,
    isRecordingPaused,
    publishRecordingState,
    videoParticipantsLength,
  ]);

  const dismissDownloadBanner = useCallback(() => {
    if (downloadDismissTimerRef.current) {
      clearTimeout(downloadDismissTimerRef.current);
      downloadDismissTimerRef.current = null;
    }
    setDownloadState(null);
  }, []);

  const updateDownloadProgress = useCallback((phase, progress, filename) => {
    setDownloadState({ phase, progress, filename });
  }, []);

  const sessionNameRef = useRef(sessionName);
  sessionNameRef.current = sessionName;

  const finalizeRecordingDownload = useCallback(async () => {
    const filename = buildRecordingFilename({
      sessionName: sessionNameRef.current,
    });
    const audioFilename = buildRecordingFilename({
      sessionName: sessionNameRef.current,
      extension: "m4a",
    });
    const chunks = recordingChunksRef.current;
    const chunkCount = chunks.length;

    updateDownloadProgress("building", 15, filename);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    for (let index = 0; index < chunkCount; index += 1) {
      const progress =
        15 + Math.round(((index + 1) / Math.max(chunkCount, 1)) * 55);
      updateDownloadProgress("building", progress, filename);
      if (index % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const blob = new Blob(chunks, { type: "video/mp4" });
    updateDownloadProgress("saving", 85, filename);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 100);

    if (
      audioRecorderRef.current &&
      audioRecorderRef.current.state !== "inactive"
    ) {
      await new Promise((resolve) => {
        const checkState = () => {
          if (
            !audioRecorderRef.current ||
            audioRecorderRef.current.state === "inactive"
          ) {
            resolve();
          } else {
            setTimeout(checkState, 10);
          }
        };
        checkState();
      });
    }

    const audioChunks = audioChunksRef.current;
    if (audioChunks.length > 0) {
      let audioMimeType = "audio/mp4";
      try {
        audioMimeType = audioChunks[0].type || "audio/mp4";
      } catch (e) {
        console.warn("Failed to read audio chunk mimeType", e);
      }
      const audioBlob = new Blob(audioChunks, { type: audioMimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioAnchor = document.createElement("a");
      audioAnchor.style.display = "none";
      audioAnchor.href = audioUrl;
      audioAnchor.download = audioFilename;

      document.body.appendChild(audioAnchor);
      audioAnchor.click();

      setTimeout(() => {
        document.body.removeChild(audioAnchor);
        window.URL.revokeObjectURL(audioUrl);
      }, 100);
    }

    recordingChunksRef.current = [];
    audioChunksRef.current = [];
    chunkIndexRef.current = 0;
    updateDownloadProgress("complete", 100, filename);
    clearSavedRecording().catch(() => {});

    downloadDismissTimerRef.current = setTimeout(() => {
      setDownloadState(null);
      downloadDismissTimerRef.current = null;
    }, 5000);
  }, [updateDownloadProgress]);

  const rebuildRecorder = useCallback(async () => {
    const { videoTrack, audioTrack } = pickTracksForFocus({
      focusedParticipantId,
      videoParticipants,
      localStream,
      screenStream,
    });

    let resolvedAudioTrack = audioTrack;
    if (!resolvedAudioTrack) {
      resolvedAudioTrack = await resolveOutboundAudioTrack(
        localStream,
        screenStream,
      );
    }

    const tracksToRecord = [videoTrack, resolvedAudioTrack].filter(Boolean);

    if (!compositeStreamRef.current) {
      compositeStreamRef.current = new MediaStream(tracksToRecord);
    } else {
      setStreamTracks(compositeStreamRef.current, tracksToRecord);
    }

    let options = { mimeType: "video/mp4;codecs=avc1" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/mp4" };
    }

    const recorder = createRecorder(compositeStreamRef.current, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        recordingChunksRef.current.push(event.data);
        const idx = chunkIndexRef.current;
        chunkIndexRef.current = idx + 1;
        saveRecordingChunk(idx, event.data).catch(() => {});
        saveRecordingMeta({
          chunkCount: idx + 1,
          sessionName: sessionNameRef.current,
          mimeType: "video/mp4",
          timestamp: Date.now(),
        }).catch(() => {});
      }
    };

    if (resolvedAudioTrack) {
      const audioStream = new MediaStream([resolvedAudioTrack]);
      let audioOptions = { mimeType: "audio/mp4" };
      if (!MediaRecorder.isTypeSupported(audioOptions.mimeType)) {
        audioOptions = {};
      }
      const audioRecorder = createRecorder(audioStream, audioOptions);
      audioRecorderRef.current = audioRecorder;
      audioRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      audioRecorder.start(1000);
    } else {
      audioRecorderRef.current = null;
    }

    recorder.start(1000);
  }, [focusedParticipantId, localStream, screenStream, videoParticipants]);

  const startRecording = useCallback(async () => {
    if (!isHost) return;

    recordingChunksRef.current = [];
    audioChunksRef.current = [];
    chunkIndexRef.current = 0;
    switchingFocusRef.current = false;
    prevFocusedIdRef.current = focusedIdRef.current;
    setSavedRecording(null);
    clearSavedRecording().catch(() => {});

    await rebuildRecorder();

    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
    publishRecordingState(true, false);
  }, [isHost, rebuildRecorder, resetRecordingTimer, publishRecordingState]);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (
        audioRecorderRef.current &&
        audioRecorderRef.current.state === "recording"
      ) {
        audioRecorderRef.current.pause();
      }
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
    }
  }, [publishRecordingState]);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      if (
        audioRecorderRef.current &&
        audioRecorderRef.current.state === "paused"
      ) {
        audioRecorderRef.current.resume();
      }
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
    }
  }, [publishRecordingState]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      updateDownloadProgress("preparing", 5);
      switchingFocusRef.current = false;
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        void finalizeRecordingDownload();
      };
      recorder.stop();
      if (
        audioRecorderRef.current &&
        audioRecorderRef.current.state !== "inactive"
      ) {
        audioRecorderRef.current.stop();
      }
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
      publishRecordingState(false, false);
    }
  }, [
    finalizeRecordingDownload,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
  ]);

  const stopRecordingAsync = useCallback(async () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }
    updateDownloadProgress("preparing", 5);
    switchingFocusRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (
      audioRecorderRef.current &&
      audioRecorderRef.current.state !== "inactive"
    ) {
      audioRecorderRef.current.stop();
    }
    await new Promise((resolve) => {
      recorder.onstop = async () => {
        await finalizeRecordingDownload();
        resolve();
      };
      recorder.stop();
    });
    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);
  }, [
    finalizeRecordingDownload,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
  ]);

  useEffect(() => {
    if (
      !isHost ||
      !isRecording ||
      !focusedParticipantId ||
      switchingFocusRef.current
    ) {
      return;
    }

    if (focusedParticipantId === prevFocusedIdRef.current) return;
    prevFocusedIdRef.current = focusedParticipantId;

    const prevRecorder = mediaRecorderRef.current;
    if (!prevRecorder || prevRecorder.state === "inactive") return;

    switchingFocusRef.current = true;
    prevRecorder.stop();

    const audioPrev = audioRecorderRef.current;
    if (audioPrev && audioPrev.state !== "inactive") {
      audioPrev.stop();
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || !isRecording) return;
      try {
        await rebuildRecorder();
      } finally {
        switchingFocusRef.current = false;
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [focusedParticipantId, isHost, isRecording, rebuildRecorder]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const handleUnload = () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      const audioRecorder = audioRecorderRef.current;
      if (audioRecorder && audioRecorder.state !== "inactive") {
        audioRecorder.stop();
      }
      const meta = {
        chunkCount: chunkIndexRef.current,
        sessionName: sessionNameRef.current,
        mimeType: "video/mp4",
        timestamp: Date.now(),
      };
      saveRecordingMeta(meta).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [isHost, isRecording]);

  useEffect(() => {
    let cancelled = false;
    loadSavedRecording().then((saved) => {
      if (cancelled || !saved) return;
      setSavedRecording(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownloadSavedRecording = useCallback(() => {
    const saved = savedRecording;
    if (!saved) return;
    const blob = new Blob(saved.chunks, { type: saved.meta.mimeType });
    const filename = buildRecordingFilename({
      sessionName: saved.meta.sessionName,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    clearSavedRecording().catch(() => {});
    setSavedRecording(null);
  }, [savedRecording]);

  const handleDiscardSavedRecording = useCallback(() => {
    clearSavedRecording().catch(() => {});
    setSavedRecording(null);
  }, []);

  return {
    downloadState,
    savedRecording,
    dismissDownloadBanner,
    downloadSavedRecording: handleDownloadSavedRecording,
    discardSavedRecording: handleDiscardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAsync,
    publishRecordingState,
  };
}

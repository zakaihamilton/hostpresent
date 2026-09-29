import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseRecordingDirectory,
  hasDirectFileExport,
} from "@/components/meeting/Recording/recordingExport";
import {
  beginRecordingSegment,
  clearSavedRecording,
  closeActiveRecordingSegment,
  createRecordingSession,
  flushRecordingWrites,
  getRecordingStoragePreflight,
  loadSavedRecording,
  updateRecordingSession,
} from "@/components/meeting/Recording/recordingStorage";
import { createRecordingStateMessage } from "@/lib/signaling/messages";
import { finalizePersistedRecording } from "./controllers/finalizePersistedRecording";
import { rebuildRecordingCapture } from "./controllers/rebuildRecordingCapture";
import {
  pickTracksForFocus,
  selectRecordingFormat,
  stopActiveRecorders,
} from "./media/recordingMedia";

export { CanvasVideoRenderer } from "./media/CanvasVideoRenderer";
export { RecordingAudioMixer } from "./media/RecordingAudioMixer";
export { getRecordingMediaSignature } from "./media/recordingMedia";

const MIN_RECORDING_STORAGE_BYTES = 128 * 1024 * 1024;
const LIVE_CAPTURE_STOP_TIMEOUT_MS = 15_000;

export function Recording({
  isHost,
  roomConnection,
  localStream,
  screenStream,
  videoParticipants = [],
  focusedParticipantId = "host",
  resetRecordingTimer,
  isRecording,
  setIsRecording,
  isRecordingPaused,
  setIsRecordingPaused,
  sessionName = "",
}) {
  const [downloadState, setDownloadState] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);
  const [canResumeSavedRecording, setCanResumeSavedRecording] = useState(false);
  const [_remoteTrackRevision, setRemoteTrackRevision] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const webCodecsWorkerRef = useRef(null);
  const recordingSessionRef = useRef(null);
  const recordingFormatsRef = useRef(null);
  const exportDirectoryRef = useRef(null);
  const videoChunkCountRef = useRef(0);
  const audioChunkCountRef = useRef(0);
  const compositeStreamRef = useRef(null);
  const downloadDismissTimerRef = useRef(null);
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const screenStreamRef = useRef(screenStream);
  screenStreamRef.current = screenStream;
  const videoParticipantsRef = useRef(videoParticipants);
  videoParticipantsRef.current = videoParticipants;

  const canvasRendererRef = useRef(null);
  const audioMixerRef = useRef(null);

  const focusedIdRef = useRef(focusedParticipantId);
  focusedIdRef.current = focusedParticipantId;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const chunkIndexRef = useRef(0);
  const stopForStorageRef = useRef(null);
  const persistedStopRef = useRef(null);
  const liveCaptureStopTimerRef = useRef(null);
  const captureSaveCompletionRef = useRef(null);
  const recordingStopRequestedRef = useRef(false);

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
  }, [isHost, isRecording, isRecordingPaused, publishRecordingState]);

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

  const monitorStorageEstimate = useCallback(
    (estimate) => {
      if (!estimate?.quota) return;
      const available = estimate.quota - (estimate.usage ?? 0);
      if (available < MIN_RECORDING_STORAGE_BYTES) {
        stopForStorageRef.current?.();
        return;
      }
      if (estimate.usage / estimate.quota > 0.9) {
        updateDownloadProgress("warning", 0, "Storage is nearly full");
      }
    },
    [updateDownloadProgress],
  );

  const sessionNameRef = useRef(sessionName);
  sessionNameRef.current = sessionName;

  const finalizeRecordingDownload = useCallback(async () => {
    return finalizePersistedRecording({
      exportDirectoryRef,
      recordingSessionRef,
      sessionName: sessionNameRef.current,
      updateProgress: updateDownloadProgress,
      workerRef: webCodecsWorkerRef,
    });
  }, [updateDownloadProgress]);

  const resolveCaptureSaveCompletion = useCallback(() => {
    if (liveCaptureStopTimerRef.current) {
      clearTimeout(liveCaptureStopTimerRef.current);
      liveCaptureStopTimerRef.current = null;
    }
    captureSaveCompletionRef.current?.();
    captureSaveCompletionRef.current = null;
  }, []);

  const rebuildRecorder = useCallback(async () => {
    await rebuildRecordingCapture({
      canvasRendererRef,
      audioMixerRef,
      focusedIdRef,
      videoParticipantsRef,
      localStreamRef,
      screenStreamRef,
      webCodecsWorkerRef,
      isRecordingRef,
      recordingSessionRef,
      persistedStopRef,
      finalizeRecordingDownload,
      resolveCaptureSaveCompletion,
      updateDownloadProgress,
      liveCaptureStopTimerRef,
      exportDirectoryRef,
      recordingFormatsRef,
      mediaRecorderRef,
      chunkIndexRef,
      videoChunkCountRef,
      monitorStorageEstimate,
      stopForStorageRef,
      audioRecorderRef,
      audioChunkCountRef,
      compositeStreamRef,
    });
  }, [
    finalizeRecordingDownload,
    resolveCaptureSaveCompletion,
    monitorStorageEstimate,
    updateDownloadProgress,
  ]);

  const startRecording = useCallback(async () => {
    if (!isHost) return;

    const preflight = await getRecordingStoragePreflight(
      MIN_RECORDING_STORAGE_BYTES,
    );
    if (!preflight.allowed) {
      updateDownloadProgress(
        "warning",
        0,
        "Not enough verified local storage to start a recording.",
      );
      return;
    }

    recordingFormatsRef.current = {
      video: selectRecordingFormat(
        [
          { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
          { mimeType: "video/mp4", extension: "mp4" },
          { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
        ],
        { mimeType: "video/webm", extension: "webm" },
      ),
      audio: selectRecordingFormat(
        [
          { mimeType: "audio/mp4", extension: "m4a" },
          { mimeType: "audio/webm;codecs=opus", extension: "webm" },
        ],
        { mimeType: "audio/webm", extension: "webm" },
      ),
    };
    recordingFormatsRef.current.recoveryVideo = selectRecordingFormat(
      [
        { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
        { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
        { mimeType: "video/webm", extension: "webm" },
      ],
      recordingFormatsRef.current.video,
    );
    recordingFormatsRef.current.recoveryAudio = selectRecordingFormat(
      [
        { mimeType: "audio/webm;codecs=opus", extension: "webm" },
        { mimeType: "audio/webm", extension: "webm" },
      ],
      recordingFormatsRef.current.audio,
    );

    if (hasDirectFileExport()) {
      exportDirectoryRef.current = await chooseRecordingDirectory();
    }
    if (
      !exportDirectoryRef.current &&
      (typeof Worker === "undefined" || typeof WebAssembly === "undefined")
    ) {
      updateDownloadProgress(
        "warning",
        0,
        "Your browser cannot export recordings on this device.",
      );
      return;
    }
    // Clear a recovered session before creating the new manifest. Clearing after
    // creation can race with persistence and delete the recording we just started.
    await clearSavedRecording();
    const session = await createRecordingSession({
      sessionName: sessionNameRef.current,
      tracks: {
        video: {
          ...recordingFormatsRef.current.video,
          stream: "video",
          chunkCount: 0,
        },
        audio: {
          ...recordingFormatsRef.current.audio,
          stream: "audio",
          chunkCount: 0,
        },
      },
    });
    const configuredSession = await updateRecordingSession({
      export: {
        checkpoint: "recording",
        destination: exportDirectoryRef.current ? "directory" : "download",
      },
    });
    recordingSessionRef.current = configuredSession ?? session;
    chunkIndexRef.current = 0;
    videoChunkCountRef.current = 0;
    audioChunkCountRef.current = 0;
    persistedStopRef.current = null;
    recordingStopRequestedRef.current = false;
    setSavedRecording(null);

    await rebuildRecorder();

    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
    publishRecordingState(true, false);
  }, [
    isHost,
    rebuildRecorder,
    resetRecordingTimer,
    publishRecordingState,
    setIsRecording,
    setIsRecordingPaused,
    updateDownloadProgress,
  ]);

  const pauseRecording = useCallback(() => {
    if (webCodecsWorkerRef.current) {
      webCodecsWorkerRef.current.postMessage({ type: "pause" });
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.pause();
      }
      if (audioRecorderRef.current?.state === "recording") {
        audioRecorderRef.current.pause();
      }
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
      return;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current?.state === "recording") {
        audioRecorderRef.current.pause();
      }
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

  const resumeSavedRecording = useCallback(async () => {
    if (!isHost) return;
    const saved = savedRecording;
    if (!saved?.meta) return;
    const preflight = await getRecordingStoragePreflight(
      MIN_RECORDING_STORAGE_BYTES,
    );
    const canCapture =
      typeof MediaRecorder !== "undefined" &&
      Boolean(
        localStreamRef.current
          ?.getVideoTracks()
          .find((track) => track.readyState === "live"),
      );
    if (!preflight.allowed || !canCapture) {
      updateDownloadProgress(
        "warning",
        0,
        "Resume is unavailable until recording storage and media capture are ready.",
      );
      return;
    }
    if (hasDirectFileExport() && !exportDirectoryRef.current) {
      exportDirectoryRef.current = await chooseRecordingDirectory();
    }
    recordingSessionRef.current = saved.meta;
    recordingFormatsRef.current = {
      video: saved.meta.tracks.video,
      audio: saved.meta.tracks.audio,
      recoveryVideo: saved.meta.tracks.video,
      recoveryAudio: saved.meta.tracks.audio,
    };
    chunkIndexRef.current = saved.meta.tracks.video.chunkCount;
    videoChunkCountRef.current = saved.meta.tracks.video.chunkCount;
    audioChunkCountRef.current = saved.meta.tracks.audio.chunkCount;
    const session = await beginRecordingSegment();
    recordingSessionRef.current = session;
    recordingStopRequestedRef.current = false;
    await rebuildRecorder();
    setSavedRecording(null);
    setCanResumeSavedRecording(false);
    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
    publishRecordingState(true, false);
  }, [
    isHost,
    publishRecordingState,
    rebuildRecorder,
    resetRecordingTimer,
    savedRecording,
    setIsRecording,
    setIsRecordingPaused,
    updateDownloadProgress,
  ]);

  const resumeRecording = useCallback(() => {
    if (webCodecsWorkerRef.current) {
      webCodecsWorkerRef.current.postMessage({ type: "resume" });
      if (mediaRecorderRef.current?.state === "paused") {
        mediaRecorderRef.current.resume();
      }
      if (audioRecorderRef.current?.state === "paused") {
        audioRecorderRef.current.resume();
      }
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
      return;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current?.state === "paused") {
        audioRecorderRef.current.resume();
      }
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

  const stopRecording = useCallback(() => {
    if (!isHost) return;

    recordingStopRequestedRef.current = true;
    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);

    if (webCodecsWorkerRef.current) {
      updateDownloadProgress("preparing", 5);
      const captureWorker = webCodecsWorkerRef.current;
      captureWorker.postMessage({ type: "stop" });
      persistedStopRef.current = stopActiveRecorders(
        mediaRecorderRef.current,
        audioRecorderRef.current,
      )
        .then(() => flushRecordingWrites())
        .then(() => closeActiveRecordingSegment("stopped"));
      if (liveCaptureStopTimerRef.current) {
        clearTimeout(liveCaptureStopTimerRef.current);
      }
      liveCaptureStopTimerRef.current = setTimeout(() => {
        if (webCodecsWorkerRef.current !== captureWorker) return;
        captureWorker.terminate();
        webCodecsWorkerRef.current = null;
        void (persistedStopRef.current ?? flushRecordingWrites()).then(
          async () => {
            persistedStopRef.current = null;
            await finalizeRecordingDownload();
          },
        );
      }, LIVE_CAPTURE_STOP_TIMEOUT_MS);
      canvasRendererRef.current?.stop();
      audioMixerRef.current?.destroy();
      return;
    }

    const recorder = mediaRecorderRef.current;
    const hasActiveRecorder = recorder && recorder.state !== "inactive";
    const audioRecorder = audioRecorderRef.current;
    const hasActiveAudioRecorder =
      audioRecorder && audioRecorder.state !== "inactive";

    if (hasActiveRecorder || hasActiveAudioRecorder) {
      updateDownloadProgress("preparing", 5);
      void stopActiveRecorders(recorder, audioRecorder).then(async () => {
        await flushRecordingWrites();
        await closeActiveRecordingSegment("stopped");
        canvasRendererRef.current?.stop();
        canvasRendererRef.current = null;
        audioMixerRef.current?.destroy();
        audioMixerRef.current = null;
        void finalizeRecordingDownload();
      });
      return;
    }

    if (videoChunkCountRef.current > 0) {
      updateDownloadProgress("preparing", 5);
      void flushRecordingWrites().then(async () => {
        await closeActiveRecordingSegment("stopped");
        canvasRendererRef.current?.stop();
        canvasRendererRef.current = null;
        audioMixerRef.current?.destroy();
        audioMixerRef.current = null;
        await finalizeRecordingDownload();
      });
    }
  }, [
    finalizeRecordingDownload,
    isHost,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
    setIsRecording,
    setIsRecordingPaused,
  ]);

  stopForStorageRef.current = () => {
    if (recordingStopRequestedRef.current) return;
    recordingStopRequestedRef.current = true;
    updateDownloadProgress(
      "warning",
      0,
      "Storage is full. Saving the partial recording.",
    );
    stopRecording();
  };

  const stopRecordingAsync = useCallback(async () => {
    if (!isHost) return;

    recordingStopRequestedRef.current = true;
    isRecordingRef.current = false;

    if (webCodecsWorkerRef.current) {
      updateDownloadProgress("preparing", 5);
      const captureWorker = webCodecsWorkerRef.current;
      const saving = new Promise((resolve) => {
        captureSaveCompletionRef.current = resolve;
      });
      captureWorker.postMessage({ type: "stop" });
      await stopActiveRecorders(
        mediaRecorderRef.current,
        audioRecorderRef.current,
      );
      await flushRecordingWrites();
      persistedStopRef.current = null;
      canvasRendererRef.current?.stop();
      canvasRendererRef.current = null;
      audioMixerRef.current?.destroy();
      audioMixerRef.current = null;
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
      publishRecordingState(false, false);
      await closeActiveRecordingSegment("stopped");
      liveCaptureStopTimerRef.current = setTimeout(() => {
        if (webCodecsWorkerRef.current !== captureWorker) return;
        captureWorker.terminate();
        webCodecsWorkerRef.current = null;
        void finalizeRecordingDownload().then(resolveCaptureSaveCompletion);
      }, LIVE_CAPTURE_STOP_TIMEOUT_MS);
      await saving;
      return;
    }

    const recorder = mediaRecorderRef.current;
    const hasActiveRecorder = recorder && recorder.state !== "inactive";
    const audioRecorder = audioRecorderRef.current;
    const hasActiveAudioRecorder =
      audioRecorder && audioRecorder.state !== "inactive";

    if (!hasActiveRecorder && !hasActiveAudioRecorder) {
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
      publishRecordingState(false, false);
      await flushRecordingWrites();
      await closeActiveRecordingSegment("stopped");
      if (videoChunkCountRef.current > 0) {
        updateDownloadProgress("preparing", 5);
        canvasRendererRef.current?.stop();
        canvasRendererRef.current = null;
        audioMixerRef.current?.destroy();
        audioMixerRef.current = null;
        await finalizeRecordingDownload();
      }
      return;
    }

    updateDownloadProgress("preparing", 5);
    await stopActiveRecorders(recorder, audioRecorder);
    await flushRecordingWrites();
    await closeActiveRecordingSegment("stopped");
    canvasRendererRef.current?.stop();
    canvasRendererRef.current = null;
    audioMixerRef.current?.destroy();
    audioMixerRef.current = null;
    await finalizeRecordingDownload();
    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);
  }, [
    finalizeRecordingDownload,
    isHost,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
    setIsRecording,
    setIsRecordingPaused,
    resolveCaptureSaveCompletion,
  ]);

  useEffect(() => {
    if (!isHost || !isRecording) return undefined;
    if (!focusedParticipantId || focusedParticipantId === "host") {
      return undefined;
    }

    const participant = videoParticipantsRef.current.find(
      (entry) => entry.id === focusedParticipantId,
    );
    const stream = participant?.stream;
    if (!stream || typeof stream.addEventListener !== "function") {
      return undefined;
    }

    const handleTrackChange = () => {
      setRemoteTrackRevision((revision) => revision + 1);
    };

    stream.addEventListener("addtrack", handleTrackChange);
    stream.addEventListener("removetrack", handleTrackChange);

    return () => {
      stream.removeEventListener("addtrack", handleTrackChange);
      stream.removeEventListener("removetrack", handleTrackChange);
    };
  }, [focusedParticipantId, isHost, isRecording]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const { videoTrack } = pickTracksForFocus({
      focusedParticipantId,
      videoParticipants,
      localStream,
      screenStream,
    });
    canvasRendererRef.current?.setTrack(videoTrack);

    const micTrack = localStream
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const screenAudio = screenStream
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const remoteAudioTracks = videoParticipants
      .map((p) =>
        p.stream?.getAudioTracks().find((t) => t.readyState === "live"),
      )
      .filter(Boolean);

    const allAudioTracks = [micTrack, screenAudio, ...remoteAudioTracks].filter(
      Boolean,
    );
    audioMixerRef.current?.updateTracks(allAudioTracks);
  }, [
    isHost,
    isRecording,
    focusedParticipantId,
    videoParticipants,
    localStream,
    screenStream,
  ]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const handleUnload = () => {
      if (webCodecsWorkerRef.current) {
        webCodecsWorkerRef.current.postMessage({ type: "stop" });
      }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      const audioRecorder = audioRecorderRef.current;
      if (audioRecorder && audioRecorder.state !== "inactive") {
        audioRecorder.stop();
      }
      Promise.all([
        closeActiveRecordingSegment("unload"),
        updateRecordingSession({ status: "interrupted" }),
      ]).catch(() => {});
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

  useEffect(() => {
    let cancelled = false;
    if (!savedRecording || !isHost) {
      setCanResumeSavedRecording(false);
      return () => {
        cancelled = true;
      };
    }
    getRecordingStoragePreflight(MIN_RECORDING_STORAGE_BYTES)
      .then((preflight) => {
        const canCapture =
          typeof MediaRecorder !== "undefined" &&
          Boolean(
            localStream
              ?.getVideoTracks()
              .find((track) => track.readyState === "live"),
          );
        if (!cancelled)
          setCanResumeSavedRecording(preflight.allowed && canCapture);
      })
      .catch(() => {
        if (!cancelled) setCanResumeSavedRecording(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isHost, localStream, savedRecording]);

  useEffect(
    () => () => {
      if (liveCaptureStopTimerRef.current) {
        clearTimeout(liveCaptureStopTimerRef.current);
      }
    },
    [],
  );

  const handleDownloadSavedRecording = useCallback(async () => {
    const saved = savedRecording;
    if (!saved) return;
    const directory = await chooseRecordingDirectory();
    recordingSessionRef.current = saved.meta;
    exportDirectoryRef.current = directory ?? null;
    await finalizeRecordingDownload();
  }, [finalizeRecordingDownload, savedRecording]);

  const handleDiscardSavedRecording = useCallback(() => {
    clearSavedRecording().catch(() => {});
    setSavedRecording(null);
    setCanResumeSavedRecording(false);
  }, []);

  return {
    downloadState,
    savedRecording,
    canResumeSavedRecording,
    dismissDownloadBanner,
    downloadSavedRecording: handleDownloadSavedRecording,
    resumeSavedRecording,
    discardSavedRecording: handleDiscardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAsync,
    publishRecordingState,
  };
}

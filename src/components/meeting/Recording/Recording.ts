import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseRecordingDirectory,
  hasDirectFileExport,
} from "@/components/meeting/Recording/recordingExport";
import {
  clearSavedRecording,
  createRecordingSession,
  getRecordingStoragePreflight,
  updateRecordingSession,
} from "@/components/meeting/Recording/recordingStorage";
import { createRecordingStateMessage } from "@/lib/signaling/messages";
import { finalizePersistedRecording } from "./controllers/finalizePersistedRecording";
import { rebuildRecordingCapture } from "./controllers/rebuildRecordingCapture";
import { createRecordingFormats } from "./controllers/recordingFormats";
import { stopRecordingCapture } from "./controllers/stopRecordingCapture";
import { useRecordingTrackSync } from "./hooks/useRecordingTrackSync";
import { useSavedRecordingRecovery } from "./hooks/useSavedRecordingRecovery";

export { CanvasVideoRenderer } from "./media/CanvasVideoRenderer";
export { RecordingAudioMixer } from "./media/RecordingAudioMixer";
export { getRecordingMediaSignature } from "./media/recordingMedia";

const MIN_RECORDING_STORAGE_BYTES = 128 * 1024 * 1024;

export function Recording({
  isHost,
  roomConnection,
  localStream,
  localTrackRevision = 0,
  screenStream,
  videoParticipants = [],
  focusedParticipantId = "host",
  resetRecordingTimer,
  isRecording,
  setIsRecording,
  isRecordingPaused,
  setIsRecordingPaused,
  sessionName = "",
}: {
  isHost?: any;
  roomConnection?: any;
  localStream?: any;
  localTrackRevision?: any;
  screenStream?: any;
  videoParticipants?: any;
  focusedParticipantId?: any;
  resetRecordingTimer?: any;
  isRecording?: any;
  setIsRecording?: any;
  isRecordingPaused?: any;
  setIsRecordingPaused?: any;
  sessionName?: any;
}) {
  const [downloadState, setDownloadState] = useState(null);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const operationRef = useRef(null);

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

  const updateDownloadProgress = useCallback(
    (phase, progress, filename?: string) => {
      setDownloadState({ phase, progress, filename });
    },
    [],
  );

  // Hold the lock synchronously, before a picker or storage operation yields.
  // Every operation that can replace or delete the shared manifest uses it.
  const runRecordingOperation = useCallback((operation) => {
    if (operationRef.current) return operationRef.current;
    setIsRecordingBusy(true);
    const pending = Promise.resolve()
      .then(operation)
      .catch((error) => {
        setDownloadState({
          phase: "warning",
          progress: 0,
          filename:
            error instanceof Error ? error.message : "Recording failed.",
        });
        return false;
      })
      .finally(() => {
        operationRef.current = null;
        setIsRecordingBusy(false);
      });
    operationRef.current = pending;
    return pending;
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
      media: {
        canvasRendererRef,
        audioMixerRef,
        focusedIdRef,
        videoParticipantsRef,
        localStreamRef,
        screenStreamRef,
        webCodecsWorkerRef,
        isRecordingRef,
        mediaRecorderRef,
        audioRecorderRef,
        compositeStreamRef,
      },
      storage: {
        recordingSessionRef,
        persistedStopRef,
        liveCaptureStopTimerRef,
        exportDirectoryRef,
        recordingFormatsRef,
        chunkIndexRef,
        videoChunkCountRef,
        audioChunkCountRef,
        stopForStorageRef,
      },
      callbacks: {
        finalizeRecordingDownload,
        resolveCaptureSaveCompletion,
        updateDownloadProgress,
        monitorStorageEstimate,
      },
    });
  }, [
    finalizeRecordingDownload,
    resolveCaptureSaveCompletion,
    monitorStorageEstimate,
    updateDownloadProgress,
  ]);

  const {
    savedRecording,
    setSavedRecording,
    canResumeSavedRecording,
    resumeSavedRecording,
    downloadSavedRecording,
    discardSavedRecording,
  } = useSavedRecordingRecovery({
    isHost,
    localStream,
    minStorageBytes: MIN_RECORDING_STORAGE_BYTES,
    runRecordingOperation,
    mediaRecorderRef,
    localStreamRef,
    exportDirectoryRef,
    recordingSessionRef,
    recordingFormatsRef,
    chunkIndexRef,
    videoChunkCountRef,
    audioChunkCountRef,
    recordingStopRequestedRef,
    rebuildRecorder,
    finalizeRecordingDownload,
    updateDownloadProgress,
    resetRecordingTimer,
    setIsRecording,
    setIsRecordingPaused,
    publishRecordingState,
  });

  const startRecording = useCallback(
    () =>
      runRecordingOperation(async () => {
        if (
          !isHost ||
          mediaRecorderRef.current?.state === "recording" ||
          mediaRecorderRef.current?.state === "paused"
        )
          return;

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

        recordingFormatsRef.current = createRecordingFormats();

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
      }),
    [
      runRecordingOperation,
      isHost,
      rebuildRecorder,
      resetRecordingTimer,
      publishRecordingState,
      setIsRecording,
      setIsRecordingPaused,
      setSavedRecording,
      updateDownloadProgress,
    ],
  );

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
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current?.state === "recording") {
        audioRecorderRef.current.pause();
      }
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

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
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current?.state === "paused") {
        audioRecorderRef.current.resume();
      }
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

  const stopRecordingAsync = useCallback(
    () =>
      runRecordingOperation(async () => {
        if (!isHost) return;
        recordingStopRequestedRef.current = true;
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsRecordingPaused(false);
        await stopRecordingCapture({
          media: {
            webCodecsWorkerRef,
            mediaRecorderRef,
            audioRecorderRef,
            canvasRendererRef,
            audioMixerRef,
          },
          storage: {
            persistedStopRef,
            liveCaptureStopTimerRef,
            captureSaveCompletionRef,
            videoChunkCountRef,
          },
          callbacks: {
            updateDownloadProgress,
            finalizeRecordingDownload,
            resolveCaptureSaveCompletion,
            setIsRecording,
            setIsRecordingPaused,
            resetRecordingTimer,
            publishRecordingState,
          },
        });
      }),
    [
      runRecordingOperation,
      finalizeRecordingDownload,
      isHost,
      resetRecordingTimer,
      publishRecordingState,
      updateDownloadProgress,
      setIsRecording,
      setIsRecordingPaused,
      resolveCaptureSaveCompletion,
    ],
  );

  const stopRecording = useCallback(() => {
    void stopRecordingAsync();
  }, [stopRecordingAsync]);

  stopForStorageRef.current = () => {
    if (recordingStopRequestedRef.current) return;
    stopRecording();
  };

  useRecordingTrackSync({
    isHost,
    isRecording,
    localStream,
    screenStream,
    videoParticipants,
    focusedParticipantId,
    localTrackRevision,
    canvasRendererRef,
    audioMixerRef,
    webCodecsWorkerRef,
    mediaRecorderRef,
    audioRecorderRef,
    liveCaptureStopTimerRef,
  });

  return {
    isRecordingBusy,
    downloadState,
    savedRecording,
    canResumeSavedRecording,
    dismissDownloadBanner,
    downloadSavedRecording,
    resumeSavedRecording,
    discardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAsync,
    publishRecordingState,
  };
}

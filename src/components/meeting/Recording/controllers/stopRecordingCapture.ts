import { stopActiveRecorders } from "../media/recordingMedia";
import {
  closeActiveRecordingSegment,
  flushRecordingWrites,
} from "../recordingStorage";

const LIVE_CAPTURE_STOP_TIMEOUT_MS = 15_000;

function destroyCapturePipelines(
  canvasRendererRef: { current: any },
  audioMixerRef: { current: any },
) {
  canvasRendererRef.current?.stop();
  canvasRendererRef.current = null;
  audioMixerRef.current?.destroy();
  audioMixerRef.current = null;
}

export async function stopRecordingCapture({
  media,
  storage,
  callbacks,
}: {
  media: {
    webCodecsWorkerRef: { current: any };
    mediaRecorderRef: { current: any };
    audioRecorderRef: { current: any };
    canvasRendererRef: { current: any };
    audioMixerRef: { current: any };
  };
  storage: {
    persistedStopRef: { current: any };
    liveCaptureStopTimerRef: { current: any };
    captureSaveCompletionRef: { current: any };
    videoChunkCountRef: { current: number };
  };
  callbacks: {
    updateDownloadProgress: (
      phase: string,
      progress: number,
      filename?: string,
    ) => void;
    finalizeRecordingDownload: () => Promise<unknown>;
    resolveCaptureSaveCompletion: () => void;
    setIsRecording: (value: boolean) => void;
    setIsRecordingPaused: (value: boolean) => void;
    resetRecordingTimer: () => void;
    publishRecordingState: (active: boolean, paused?: boolean) => void;
  };
}): Promise<void> {
  const {
    webCodecsWorkerRef,
    mediaRecorderRef,
    audioRecorderRef,
    canvasRendererRef,
    audioMixerRef,
  } = media;
  const {
    persistedStopRef,
    liveCaptureStopTimerRef,
    captureSaveCompletionRef,
    videoChunkCountRef,
  } = storage;
  const {
    updateDownloadProgress,
    finalizeRecordingDownload,
    resolveCaptureSaveCompletion,
    setIsRecording,
    setIsRecordingPaused,
    resetRecordingTimer,
    publishRecordingState,
  } = callbacks;

  const resetUiState = () => {
    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);
  };

  if (webCodecsWorkerRef.current) {
    updateDownloadProgress("preparing", 5);
    const captureWorker = webCodecsWorkerRef.current;
    const saving = new Promise((resolve) => {
      captureSaveCompletionRef.current = resolve;
    });
    persistedStopRef.current = stopActiveRecorders(
      mediaRecorderRef.current,
      audioRecorderRef.current,
    )
      .then(() => flushRecordingWrites())
      .then(() => closeActiveRecordingSegment("stopped"));
    liveCaptureStopTimerRef.current = setTimeout(() => {
      if (webCodecsWorkerRef.current !== captureWorker) return;
      captureWorker.terminate();
      webCodecsWorkerRef.current = null;
      void finalizeRecordingDownload().finally(resolveCaptureSaveCompletion);
    }, LIVE_CAPTURE_STOP_TIMEOUT_MS);
    captureWorker.postMessage({ type: "stop" });
    await persistedStopRef.current;
    destroyCapturePipelines(canvasRendererRef, audioMixerRef);
    resetUiState();
    await saving;
    return;
  }

  const recorder = mediaRecorderRef.current;
  const hasActiveRecorder = recorder && recorder.state !== "inactive";
  const audioRecorder = audioRecorderRef.current;
  const hasActiveAudioRecorder =
    audioRecorder && audioRecorder.state !== "inactive";

  if (!hasActiveRecorder && !hasActiveAudioRecorder) {
    resetUiState();
    await flushRecordingWrites();
    await closeActiveRecordingSegment("stopped");
    if (videoChunkCountRef.current > 0) {
      updateDownloadProgress("preparing", 5);
      destroyCapturePipelines(canvasRendererRef, audioMixerRef);
      await finalizeRecordingDownload();
    }
    return;
  }

  updateDownloadProgress("preparing", 5);
  await stopActiveRecorders(recorder, audioRecorder);
  await flushRecordingWrites();
  await closeActiveRecordingSegment("stopped");
  destroyCapturePipelines(canvasRendererRef, audioMixerRef);
  await finalizeRecordingDownload();
  resetUiState();
}

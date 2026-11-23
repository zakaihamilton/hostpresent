import { useCallback, useEffect, useState } from "react";
import {
  chooseRecordingDirectory,
  hasDirectFileExport,
} from "@/components/meeting/Recording/recordingExport";
import {
  beginRecordingSegment,
  clearSavedRecording,
  getRecordingStoragePreflight,
  loadSavedRecording,
} from "@/components/meeting/Recording/recordingStorage";
import { createSavedRecordingFormats } from "../controllers/recordingFormats";

export function useSavedRecordingRecovery({
  isHost,
  localStream,
  minStorageBytes,
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
}: {
  isHost?: any;
  localStream?: any;
  minStorageBytes: number;
  runRecordingOperation: <T>(op: () => Promise<T>) => Promise<T | false>;
  mediaRecorderRef: { current: any };
  localStreamRef: { current: any };
  exportDirectoryRef: { current: any };
  recordingSessionRef: { current: any };
  recordingFormatsRef: { current: any };
  chunkIndexRef: { current: number };
  videoChunkCountRef: { current: number };
  audioChunkCountRef: { current: number };
  recordingStopRequestedRef: { current: boolean };
  rebuildRecorder: () => Promise<void>;
  finalizeRecordingDownload: () => Promise<unknown>;
  updateDownloadProgress: (
    phase: string,
    progress: number,
    filename?: string,
  ) => void;
  resetRecordingTimer: () => void;
  setIsRecording: (value: boolean) => void;
  setIsRecordingPaused: (value: boolean) => void;
  publishRecordingState: (active: boolean, paused?: boolean) => void;
}) {
  const [savedRecording, setSavedRecording] = useState(null);
  const [canResumeSavedRecording, setCanResumeSavedRecording] = useState(false);

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
    getRecordingStoragePreflight(minStorageBytes)
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
  }, [isHost, localStream, minStorageBytes, savedRecording]);

  const resumeSavedRecording = useCallback(
    () =>
      runRecordingOperation(async () => {
        if (
          !isHost ||
          mediaRecorderRef.current?.state === "recording" ||
          mediaRecorderRef.current?.state === "paused"
        )
          return;
        const saved = savedRecording;
        if (!saved?.meta) return;
        const preflight = await getRecordingStoragePreflight(minStorageBytes);
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
        recordingFormatsRef.current = createSavedRecordingFormats(
          saved.meta.tracks,
        );
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
      }),
    [
      runRecordingOperation,
      isHost,
      mediaRecorderRef,
      savedRecording,
      minStorageBytes,
      localStreamRef,
      exportDirectoryRef,
      recordingSessionRef,
      recordingFormatsRef,
      chunkIndexRef,
      videoChunkCountRef,
      audioChunkCountRef,
      recordingStopRequestedRef,
      rebuildRecorder,
      resetRecordingTimer,
      setIsRecording,
      setIsRecordingPaused,
      publishRecordingState,
      updateDownloadProgress,
    ],
  );

  const downloadSavedRecording = useCallback(
    () =>
      runRecordingOperation(async () => {
        const saved = savedRecording;
        if (
          !saved ||
          mediaRecorderRef.current?.state === "recording" ||
          mediaRecorderRef.current?.state === "paused"
        )
          return;
        const directory = await chooseRecordingDirectory();
        recordingSessionRef.current = saved.meta;
        exportDirectoryRef.current = directory ?? null;
        await finalizeRecordingDownload();
      }),
    [
      finalizeRecordingDownload,
      savedRecording,
      runRecordingOperation,
      mediaRecorderRef,
      recordingSessionRef,
      exportDirectoryRef,
    ],
  );

  const discardSavedRecording = useCallback(
    () =>
      runRecordingOperation(async () => {
        if (
          mediaRecorderRef.current?.state === "recording" ||
          mediaRecorderRef.current?.state === "paused"
        )
          return;
        await clearSavedRecording();
        setSavedRecording(null);
        setCanResumeSavedRecording(false);
      }),
    [runRecordingOperation, mediaRecorderRef],
  );

  return {
    savedRecording,
    setSavedRecording,
    canResumeSavedRecording,
    resumeSavedRecording,
    downloadSavedRecording,
    discardSavedRecording,
  };
}

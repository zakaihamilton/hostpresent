import { buildRecordingFilename } from "@/lib/recordingFilename";
import { CanvasVideoRenderer } from "../media/CanvasVideoRenderer";
import { RecordingAudioMixer } from "../media/RecordingAudioMixer";
import {
  createRecorder,
  pickTracksForFocus,
  setStreamTracks,
} from "../media/recordingMedia";
import { deliverRecordingExports } from "../recordingExport";
import {
  clearSavedRecording,
  closeActiveRecordingSegment,
  flushRecordingWrites,
  getRecordingStorageEstimate,
  saveRecordingFragment,
  updateRecordingSession,
} from "../recordingStorage";
import {
  createWebCodecsRecordingWorker,
  supportsWebCodecsRecording,
  supportsWebCodecsRecordingCodecs,
} from "../webCodecsRecording";

export async function rebuildRecordingCapture({ media, storage, callbacks }) {
  const {
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
  } = media;
  const {
    recordingSessionRef,
    persistedStopRef,
    liveCaptureStopTimerRef,
    exportDirectoryRef,
    recordingFormatsRef,
    chunkIndexRef,
    videoChunkCountRef,
    audioChunkCountRef,
    stopForStorageRef,
  } = storage;
  const {
    finalizeRecordingDownload,
    resolveCaptureSaveCompletion,
    updateDownloadProgress,
    monitorStorageEstimate,
  } = callbacks;
  const persistFragment = (stream, index, blob) => {
    saveRecordingFragment({ stream, index, blob })
      .then((session) => {
        recordingSessionRef.current = session;
        return getRecordingStorageEstimate();
      })
      .then(monitorStorageEstimate)
      .catch(() => stopForStorageRef.current?.());
  };
  const handleVideoFragment = (event) => {
    if (!(event.data?.size > 0)) return;
    const index = chunkIndexRef.current++;
    videoChunkCountRef.current = index + 1;
    persistFragment("video", index, event.data);
  };
  const handleAudioFragment = (event) => {
    if (!(event.data?.size > 0)) return;
    const index = audioChunkCountRef.current++;
    persistFragment("audio", index, event.data);
  };

  if (!canvasRendererRef.current) {
    canvasRendererRef.current = new CanvasVideoRenderer();
    canvasRendererRef.current.start();
  }
  if (!audioMixerRef.current) {
    audioMixerRef.current = new RecordingAudioMixer();
  }

  const { videoTrack } = pickTracksForFocus({
    focusedParticipantId: focusedIdRef.current,
    videoParticipants: videoParticipantsRef.current,
    localStream: localStreamRef.current,
    screenStream: screenStreamRef.current,
  });
  canvasRendererRef.current.setTrack(videoTrack);

  const micTrack = localStreamRef.current
    ?.getAudioTracks()
    .find((t) => t.readyState === "live");
  const screenAudio = screenStreamRef.current
    ?.getAudioTracks()
    .find((t) => t.readyState === "live");
  const remoteAudioTracks = videoParticipantsRef.current
    .map((p) => p.stream?.getAudioTracks().find((t) => t.readyState === "live"))
    .filter(Boolean);

  const allAudioTracks = [micTrack, screenAudio, ...remoteAudioTracks].filter(
    Boolean,
  );
  audioMixerRef.current.updateTracks(allAudioTracks);

  const recVideoTrack = canvasRendererRef.current
    .getStream()
    .getVideoTracks()[0];
  const recAudioTrack = audioMixerRef.current.getAudioTrack();

  const settings = videoTrack?.getSettings?.() ?? {};
  const webCodecsSupported =
    supportsWebCodecsRecording() &&
    recVideoTrack &&
    recAudioTrack &&
    (await supportsWebCodecsRecordingCodecs({
      width: settings.width ?? 1280,
      height: settings.height ?? 720,
    }));
  if (webCodecsSupported) {
    const worker = createWebCodecsRecordingWorker();
    webCodecsWorkerRef.current = worker;
    let workerFailed = false;
    const releaseWorker = () => {
      worker.terminate();
      if (webCodecsWorkerRef.current === worker) {
        webCodecsWorkerRef.current = null;
      }
    };
    const recoverAfterWorkerFailure = async (message) => {
      if (workerFailed) return;
      workerFailed = true;
      if (!isRecordingRef.current && recordingSessionRef.current) {
        releaseWorker();
        await (persistedStopRef.current ?? flushRecordingWrites());
        persistedStopRef.current = null;
        await finalizeRecordingDownload();
        resolveCaptureSaveCompletion();
        return;
      }
      Promise.all([
        closeActiveRecordingSegment("worker-failure"),
        updateRecordingSession({ status: "interrupted" }),
      ]).catch(() => {});
      releaseWorker();
      updateDownloadProgress("warning", 0, message);
      resolveCaptureSaveCompletion();
    };
    worker.onmessage = async ({ data }) => {
      if (data.type === "progress") {
        if (
          isRecordingRef.current &&
          (data.phase === "initializing" || data.phase === "encoding")
        ) {
          return;
        }
        updateDownloadProgress(data.phase, 50, "Recording export");
        return;
      }
      if (data.type === "failed") {
        await recoverAfterWorkerFailure(data.error);
        return;
      }
      if (data.type === "cancelled") {
        await updateRecordingSession({ status: "interrupted" });
        releaseWorker();
        updateDownloadProgress("cancelled", 0, "Recording export cancelled.");
        resolveCaptureSaveCompletion();
        return;
      }
      if (data.type === "complete") {
        if (data.capture && liveCaptureStopTimerRef.current) {
          clearTimeout(liveCaptureStopTimerRef.current);
          liveCaptureStopTimerRef.current = null;
        }
        const session = recordingSessionRef.current;
        if (!session) return;
        if (data.capture) {
          await (persistedStopRef.current ?? flushRecordingWrites());
          persistedStopRef.current = null;
          const updated = await updateRecordingSession({
            export: {
              ...session.export,
              checkpoint: "segment-complete",
              segments: [
                ...(session.export?.segments ?? []),
                {
                  id: session.segments?.at(-1)?.id ?? 0,
                  files: data.files,
                },
              ],
            },
          });
          recordingSessionRef.current = updated ?? session;
          worker.postMessage({ type: "finalize", sessionId: session.id });
          return;
        }
        const videoName = buildRecordingFilename({
          sessionName: session.sessionName,
          extension: "mp4",
        });
        const audioName = buildRecordingFilename({
          sessionName: session.sessionName,
          extension: "m4a",
        });
        try {
          await deliverRecordingExports(
            data.files.map((file) => ({
              ...file,
              filename: file.stream === "video" ? videoName : audioName,
            })),
            { sessionId: session.id, directory: exportDirectoryRef.current },
          );
        } catch (error) {
          await updateRecordingSession({ status: "interrupted" });
          updateDownloadProgress(
            "warning",
            0,
            error instanceof Error
              ? error.message
              : "Could not deliver recording files.",
          );
          resolveCaptureSaveCompletion();
          return;
        }
        await updateRecordingSession({ status: "exported" });
        updateDownloadProgress("complete", 100, videoName);
        if (!data.files.some((file) => file.storage === "indexeddb")) {
          clearSavedRecording().catch(() => {});
        }
        recordingSessionRef.current = null;
        releaseWorker();
        resolveCaptureSaveCompletion();
      }
    };
    worker.onerror = (event) => {
      void recoverAfterWorkerFailure(
        event.message || "Recording worker failed.",
      );
    };
    worker.onmessageerror = () => {
      void recoverAfterWorkerFailure(
        "Recording worker returned unreadable data.",
      );
    };
    const videoReadable = new MediaStreamTrackProcessor({
      track: recVideoTrack.clone(),
    }).readable;
    const audioReadable = new MediaStreamTrackProcessor({
      track: recAudioTrack.clone(),
    }).readable;
    worker.postMessage(
      {
        type: "export",
        sessionId: recordingSessionRef.current.id,
        videoReadable,
        audioReadable,
        width: settings.width ?? 1280,
        height: settings.height ?? 720,
        sampleRate: 48_000,
        channels: 2,
        segmentId: recordingSessionRef.current.segments?.at(-1)?.id ?? 0,
      },
      [videoReadable, audioReadable],
    );

    // Keep the five-second persisted source fragments even while WebCodecs
    // is producing the low-latency segment. A page crash can interrupt the
    // live muxer, while these fragments remain recoverable after rejoin.
    const mirrorRecorder = createRecorder(
      new MediaStream([recVideoTrack, recAudioTrack].filter(Boolean)),
      { mimeType: recordingFormatsRef.current.recoveryVideo.mimeType },
    );
    mediaRecorderRef.current = mirrorRecorder;
    mirrorRecorder.ondataavailable = handleVideoFragment;
    mirrorRecorder.start(5000);

    if (recAudioTrack) {
      const mirrorAudioRecorder = createRecorder(
        new MediaStream([recAudioTrack]),
        { mimeType: recordingFormatsRef.current.recoveryAudio.mimeType },
      );
      audioRecorderRef.current = mirrorAudioRecorder;
      mirrorAudioRecorder.ondataavailable = handleAudioFragment;
      mirrorAudioRecorder.start(5000);
    }
    return;
  }

  const tracksToRecord = [recVideoTrack, recAudioTrack].filter(Boolean);
  if (!compositeStreamRef.current) {
    compositeStreamRef.current = new MediaStream(tracksToRecord);
  } else {
    setStreamTracks(compositeStreamRef.current, tracksToRecord);
  }

  const videoFormat = recordingFormatsRef.current.recoveryVideo;
  const options = { mimeType: videoFormat.mimeType };

  const recorder = createRecorder(compositeStreamRef.current, options);
  mediaRecorderRef.current = recorder;

  recorder.ondataavailable = handleVideoFragment;

  if (recAudioTrack) {
    const audioOptions = {
      mimeType: recordingFormatsRef.current.recoveryAudio.mimeType,
    };
    const audioRecorder = createRecorder(
      new MediaStream([recAudioTrack]),
      audioOptions,
    );
    audioRecorderRef.current = audioRecorder;
    audioRecorder.ondataavailable = handleAudioFragment;
    audioRecorder.start(5000);
  } else {
    audioRecorderRef.current = null;
  }

  recorder.start(5000);
}

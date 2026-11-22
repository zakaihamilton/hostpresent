import {
  encodeAudioTrack,
  encodeVideoTrack,
  type RecordingCaptureRuntime,
  type RecordingTrackReader,
} from "./encodeRecordingTracks";
import { exportPersistedRecording } from "./exportPersistedRecording";
import { terminateFfmpeg } from "./ffmpegTranscode";
import { validateMp4 } from "./mp4MuxPipeline";
import {
  parseRecordingWorkerCommand,
  type RecordingWorkerResponse,
} from "./recordingWorkerProtocol";
import {
  createOpfsOutput,
  removeCancelledExportOutputs,
  updateExportCheckpoint,
  type WorkerExportOutput,
} from "./workerStorage";

let cancelled = false;
let stopping = false;
let paused = false;
let resumePaused: (() => void) | null = null;
let pauseStartedAt = 0;
let timestampOffset = 0;
const readers = new Set<RecordingTrackReader>();
let activeSessionId: string | null = null;
let activeExportOutputs: WorkerExportOutput[] = [];

function post(message: RecordingWorkerResponse): void {
  self.postMessage(message);
}

async function waitForResume() {
  if (!paused) return;
  await new Promise<void>((resolve) => {
    resumePaused = resolve;
  });
}

const captureRuntime: RecordingCaptureRuntime = {
  readers,
  isCancelled: () => cancelled,
  isStopping: () => stopping,
  waitForResume,
  timestampOffset: () => timestampOffset,
  post,
};

self.onmessage = async ({ data: rawData }: MessageEvent<unknown>) => {
  const data = parseRecordingWorkerCommand(rawData);
  if (!data) return;
  if (data.type === "cancel") {
    cancelled = true;
    paused = false;
    resumePaused?.();
    resumePaused = null;
    await Promise.allSettled([...readers].map((reader) => reader.cancel()));
    terminateFfmpeg();
    void Promise.allSettled(
      activeExportOutputs.map((output) => output.cancel?.()),
    );
    if (activeSessionId) {
      void removeCancelledExportOutputs(activeSessionId);
    }
    return;
  }
  if (data.type === "stop") {
    stopping = true;
    paused = false;
    resumePaused?.();
    resumePaused = null;
    await Promise.allSettled([...readers].map((reader) => reader.cancel()));
    return;
  }
  if (data.type === "pause") {
    paused = true;
    pauseStartedAt = performance.now();
    post({ type: "paused" });
    return;
  }
  if (data.type === "resume") {
    if (paused) {
      timestampOffset += Math.round(
        (performance.now() - pauseStartedAt) * 1000,
      );
      paused = false;
      resumePaused?.();
      resumePaused = null;
      post({ type: "resumed" });
    }
    return;
  }
  if (data.type === "finalize") {
    try {
      cancelled = false;
      stopping = false;
      activeSessionId = data.sessionId;
      await exportPersistedRecording(data.sessionId, {
        isCancelled: () => cancelled,
        post,
        setActiveOutputs: (outputs) => {
          activeExportOutputs = outputs;
        },
        clearActiveOutputs: () => {
          activeExportOutputs = [];
        },
      });
    } catch (error) {
      if (cancelled) {
        await Promise.allSettled([
          removeCancelledExportOutputs(data.sessionId),
          updateExportCheckpoint(data.sessionId, "cancelled"),
        ]);
        post({ type: "cancelled" });
        return;
      }
      await updateExportCheckpoint(data.sessionId, "failed", {
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
      post({
        type: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      activeSessionId = null;
      activeExportOutputs = [];
    }
    return;
  }
  if (data.type !== "export") return;

  try {
    cancelled = false;
    stopping = false;
    paused = false;
    timestampOffset = 0;
    const root = await navigator.storage.getDirectory();
    activeSessionId = data.sessionId;
    const recordings = await root.getDirectoryHandle("hostpresent-recordings", {
      create: true,
    });
    const session = await recordings.getDirectoryHandle(data.sessionId, {
      create: true,
    });
    const exports = await session.getDirectoryHandle("exports", {
      create: true,
    });
    const segmentId = data.segmentId ?? 0;
    const videoFilename = `segment-${segmentId}-video.mp4`;
    const audioFilename = `segment-${segmentId}-audio.m4a`;
    const videoHandle = await exports.getFileHandle(videoFilename, {
      create: true,
    });
    const audioHandle = await exports.getFileHandle(audioFilename, {
      create: true,
    });
    const videoOutput = createOpfsOutput(videoHandle);
    const audioOutput = createOpfsOutput(audioHandle);
    post({ type: "progress", phase: "initializing" });
    await Promise.all([
      encodeVideoTrack({
        readable: data.videoReadable,
        writable: await videoHandle.createWritable(),
        width: data.width,
        height: data.height,
        runtime: captureRuntime,
      }),
      encodeAudioTrack({
        readable: data.audioReadable,
        writable: await audioHandle.createWritable(),
        sampleRate: data.sampleRate,
        channels: data.channels,
        runtime: captureRuntime,
      }),
    ]);
    post({ type: "progress", phase: "validating" });
    await Promise.all([
      validateMp4(videoOutput, "video"),
      validateMp4(audioOutput, "audio"),
    ]);
    post({ type: "progress", phase: "writing" });
    const files = [
      { stream: "video" as const, path: `exports/${videoFilename}` },
      { stream: "audio" as const, path: `exports/${audioFilename}` },
    ];
    post({
      type: cancelled && !stopping ? "cancelled" : "complete",
      capture: true,
      files,
    });
  } catch (error) {
    if (cancelled) {
      post({ type: "cancelled" });
      return;
    }
    post({
      type: "failed",
      capture: true,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeSessionId = null;
  }
};

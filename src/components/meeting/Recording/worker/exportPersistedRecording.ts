import { BlobSource, Input, MP4 } from "mediabunny";
import { createMp4EncodedMuxer, createMp4SampleMuxer } from "../mediaMuxer";
import { hasCompleteDirectSegmentExport } from "./exportSelection";
import {
  supportsNativeFinalization,
  transcodeFragment,
} from "./ffmpegTranscode";
import {
  appendEncodedPackets,
  appendInputSamples,
  muxFinalRecording,
  validateMp4,
} from "./mp4MuxPipeline";
import type {
  RecordingExportFile,
  RecordingWorkerResponse,
} from "./recordingWorkerProtocol";
import {
  createIndexedDbOutput,
  createOpfsOutput,
  MANIFEST_KEY,
  readDatabaseValue,
  readExportFile,
  readPersistedSegment,
  sourceFromPersistedFragments,
  updateExportCheckpoint,
  type WorkerExportOutput,
} from "./workerStorage";

interface ExportPersistedContext {
  isCancelled: () => boolean;
  post: (message: RecordingWorkerResponse) => void;
  setActiveOutputs: (outputs: WorkerExportOutput[]) => void;
  clearActiveOutputs: () => void;
}

function getTrackSegments(
  manifest: any,
  stream: "video" | "audio",
  chunkCount: number,
) {
  const startKey = stream === "video" ? "videoStartIndex" : "audioStartIndex";
  const endKey = stream === "video" ? "videoEndIndex" : "audioEndIndex";
  const segments = manifest.segments?.length
    ? manifest.segments
    : [{ id: 0, [startKey]: 0, [endKey]: chunkCount }];
  return {
    total: segments.length,
    items: segments.map((segment: any, index: number) => ({
      segment,
      index,
      start: segment[startKey] ?? 0,
      end: segment[endKey] ?? chunkCount,
    })),
  };
}

async function exportPersistedNativeTrack({
  manifest,
  stream,
  outputHandle,
  isCancelled,
  post,
}: {
  manifest: any;
  stream: "video" | "audio";
  outputHandle: WorkerExportOutput;
  isCancelled: () => boolean;
  post: (message: RecordingWorkerResponse) => void;
}) {
  const track = manifest.tracks[stream];
  const writable = await outputHandle.createWritable();
  const muxer = await createMp4SampleMuxer({ writable, stream });
  const trackSegments = getTrackSegments(manifest, stream, track.chunkCount);
  let timeline = 0;
  let samples = 0;
  try {
    for (const { segment, index, start, end } of trackSegments.items) {
      if (end <= start) continue;
      timeline += (segment.gapDurationMs ?? 0) / 1000;
      const result = await appendInputSamples({
        source: sourceFromPersistedFragments(
          manifest,
          stream,
          start,
          end,
          isCancelled,
        ),
        stream,
        muxer,
        timeline,
      });
      timeline = result.timeline;
      samples += result.samples;
      post({
        type: "progress",
        phase: "encoding",
        stream,
        completed: index + 1,
        total: trackSegments.total,
      });
    }
    if (samples === 0) throw new Error(`Recording has no ${stream} packets.`);
    await muxer.finalize();
  } catch (error) {
    await muxer.cancel().catch(() => {});
    throw error;
  }
}

async function exportPersistedTrack({
  manifest,
  stream,
  outputHandle,
  isCancelled,
  post,
}: {
  manifest: any;
  stream: "video" | "audio";
  outputHandle: WorkerExportOutput;
  isCancelled: () => boolean;
  post: (message: RecordingWorkerResponse) => void;
}) {
  if (await supportsNativeFinalization(stream)) {
    return exportPersistedNativeTrack({
      manifest,
      stream,
      outputHandle,
      isCancelled,
      post,
    });
  }
  const track = manifest.tracks[stream];
  let timeline = 0;
  let packets = 0;
  let muxer: Awaited<ReturnType<typeof createMp4EncodedMuxer>> | null = null;
  try {
    const trackSegments = getTrackSegments(manifest, stream, track.chunkCount);
    for (const { segment, index, start, end } of trackSegments.items) {
      if (end <= start) continue;
      timeline += (segment.gapDurationMs ?? 0) / 1000;
      if (isCancelled()) throw new Error("Recording export was cancelled.");
      const persistedSegment = await readPersistedSegment(
        manifest,
        stream,
        start,
        end,
        isCancelled,
      );
      if (persistedSegment?.size) {
        const sourceFile = await transcodeFragment(
          persistedSegment,
          stream,
          `${segment.id}`,
        );
        const input = new Input({
          formats: [MP4],
          source: new BlobSource(sourceFile, { maxCacheSize: 1_048_576 }),
        });
        try {
          if (!(await input.canRead())) {
            throw new Error(`Transcoded ${stream} fragment is unreadable.`);
          }
          const inputTrack =
            stream === "video"
              ? await input.getPrimaryVideoTrack()
              : await input.getPrimaryAudioTrack();
          if (inputTrack) {
            if (!muxer) {
              const writable = await outputHandle.createWritable();
              const decoderConfig = await inputTrack.getDecoderConfig();
              if (!decoderConfig) {
                throw new Error(
                  `FFmpeg did not provide ${stream} decoder metadata.`,
                );
              }
              muxer = await createMp4EncodedMuxer({
                writable,
                stream,
                decoderConfig,
              });
            }
            const result = await appendEncodedPackets({
              source: new BlobSource(sourceFile, { maxCacheSize: 1_048_576 }),
              stream,
              muxer,
              timeline,
            });
            timeline = result.timeline;
            packets += result.packets;
          }
        } finally {
          input.dispose();
        }
      }
      post({
        type: "progress",
        phase: "transcoding",
        stream,
        completed: index + 1,
        total: trackSegments.total,
      });
    }
    if (!muxer || packets === 0) {
      throw new Error(`Recording has no ${stream} packets.`);
    }
    await muxer.finalize();
  } catch (error) {
    await muxer?.cancel().catch(() => {});
    throw error;
  }
}

async function exportPersistedSegments({
  manifest,
  session,
  stream,
  outputHandle,
  isCancelled,
  post,
}: {
  manifest: any;
  session: FileSystemDirectoryHandle | null;
  stream: "video" | "audio";
  outputHandle: WorkerExportOutput;
  isCancelled: () => boolean;
  post: (message: RecordingWorkerResponse) => void;
}) {
  const writable = await outputHandle.createWritable();
  const muxer = await createMp4SampleMuxer({ writable, stream });
  let timeline = 0;
  let samples = 0;
  const segments = manifest.export?.segments ?? [];
  try {
    for (let index = 0; index < segments.length; index += 1) {
      if (isCancelled()) throw new Error("Recording export was cancelled.");
      const segment = segments[index];
      const gap = manifest.segments?.find((entry) => entry.id === segment.id);
      timeline += (gap?.gapDurationMs ?? 0) / 1000;
      const path = segment.files?.find((file) => file.stream === stream)?.path;
      if (!path) continue;
      const result = await appendInputSamples({
        source: new BlobSource(await readExportFile(session, path), {
          maxCacheSize: 1_048_576,
        }),
        stream,
        muxer,
        timeline,
      });
      timeline = result.timeline;
      samples += result.samples;
      post({
        type: "progress",
        phase: "remuxing",
        stream,
        completed: index + 1,
        total: segments.length,
      });
    }
    if (samples === 0) throw new Error(`Recording has no ${stream} samples.`);
    await muxer.finalize();
  } catch (error) {
    await muxer.cancel().catch(() => {});
    throw error;
  }
}

export async function exportPersistedRecording(
  sessionId: string,
  {
    isCancelled,
    post,
    setActiveOutputs,
    clearActiveOutputs,
  }: ExportPersistedContext,
): Promise<void> {
  const manifest = await readDatabaseValue(MANIFEST_KEY);
  if (!manifest || manifest.id !== sessionId) {
    throw new Error("The recording session is no longer available.");
  }
  const isOpfs = manifest.storage === "opfs";
  let session: FileSystemDirectoryHandle | null = null;
  let videoOutput: WorkerExportOutput;
  let audioOutput: WorkerExportOutput;
  let recordingOutput: WorkerExportOutput;
  if (isOpfs) {
    const root = await navigator.storage.getDirectory();
    const recordings = await root.getDirectoryHandle("hostpresent-recordings");
    session = await recordings.getDirectoryHandle(sessionId);
    const exports = await session.getDirectoryHandle("exports", {
      create: true,
    });
    videoOutput = createOpfsOutput(
      await exports.getFileHandle("final-video.mp4", { create: true }),
    );
    audioOutput = createOpfsOutput(
      await exports.getFileHandle("final-audio.m4a", { create: true }),
    );
    recordingOutput = createOpfsOutput(
      await exports.getFileHandle("final-recording.mp4", { create: true }),
    );
  } else {
    const previous = manifest.export?.files ?? [];
    videoOutput = createIndexedDbOutput({
      sessionId,
      filename: "final-video.mp4",
      previousChunks:
        previous.find((file) => file.path === "final-video.mp4")?.chunks ?? 0,
    });
    audioOutput = createIndexedDbOutput({
      sessionId,
      filename: "final-audio.m4a",
      previousChunks:
        previous.find((file) => file.path === "final-audio.m4a")?.chunks ?? 0,
    });
    recordingOutput = createIndexedDbOutput({
      sessionId,
      filename: "final-recording.mp4",
      previousChunks:
        previous.find((file) => file.path === "final-recording.mp4")?.chunks ??
        0,
    });
    await Promise.all([
      videoOutput.prepare?.(),
      audioOutput.prepare?.(),
      recordingOutput.prepare?.(),
    ]);
  }
  setActiveOutputs([videoOutput, audioOutput, recordingOutput]);
  await updateExportCheckpoint(sessionId, "remuxing");
  post({ type: "progress", phase: "remuxing" });
  // A completed WebCodecs segment is already a timestamped MP4. Prefer it to
  // the mirrored MediaRecorder fragments, which exist only for crash recovery
  // and can have browser-specific container timing.
  const exportTrack = hasCompleteDirectSegmentExport(manifest)
    ? exportPersistedSegments
    : exportPersistedTrack;
  await exportTrack({
    manifest,
    session,
    stream: "video",
    outputHandle: videoOutput,
    isCancelled,
    post,
  });
  await updateExportCheckpoint(sessionId, "video-export");
  await exportTrack({
    manifest,
    session,
    stream: "audio",
    outputHandle: audioOutput,
    isCancelled,
    post,
  });
  await updateExportCheckpoint(sessionId, "audio-export");
  await muxFinalRecording({
    videoOutput,
    audioOutput,
    outputHandle: recordingOutput,
  });
  await updateExportCheckpoint(sessionId, "recording-export");
  await updateExportCheckpoint(sessionId, "validating");
  post({ type: "progress", phase: "validating" });
  await Promise.all([
    validateMp4(videoOutput, "video"),
    validateMp4(audioOutput, "audio"),
    validateMp4(recordingOutput, "recording"),
  ]);
  await updateExportCheckpoint(sessionId, "writing");
  post({ type: "progress", phase: "writing" });
  const storage: "opfs" | "indexeddb" = isOpfs ? "opfs" : "indexeddb";
  const files: RecordingExportFile[] = [
    {
      stream: "video",
      path: isOpfs ? "exports/final-recording.mp4" : "final-recording.mp4",
      storage,
      chunks: recordingOutput.getChunks(),
    },
    {
      stream: "audio",
      path: isOpfs ? "exports/final-audio.m4a" : "final-audio.m4a",
      storage,
      chunks: audioOutput.getChunks(),
    },
  ];
  await updateExportCheckpoint(sessionId, "complete", { files });
  post({ type: "complete", files });
  clearActiveOutputs();
}

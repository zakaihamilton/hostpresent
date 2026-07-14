import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  EncodedPacketSink,
  Input,
  MP4,
  ReadableStreamSource,
  VideoSampleSink,
} from "mediabunny";
import {
  createMp4CombinedEncodedMuxer,
  createMp4EncodedMuxer,
  createMp4SampleMuxer,
  createMp4TrackMuxer,
} from "../mediaMuxer";
import { hasCompleteDirectSegmentExport } from "./exportSelection";
import { createFfmpegBridge } from "./ffmpegBridge";
import { getSafeSampleDuration, needsAudioSampleTrim } from "./sampleTiming";

let cancelled = false;
let stopping = false;
let paused = false;
let resumePaused = null;
let pauseStartedAt = 0;
let timestampOffset = 0;
const readers = new Set();
const DB_NAME = "HPRecording";
const STORE_NAME = "data";
const MANIFEST_KEY = "manifest";
let ffmpegPromise = null;
let ffmpegBridge = null;
let activeSessionId = null;
let activeExportOutputs = [];

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = createFfmpegBridge()
      .then((bridge) => {
        ffmpegBridge = bridge;
        return bridge;
      })
      .catch((error) => {
        ffmpegPromise = null;
        throw error;
      });
  }
  return ffmpegPromise;
}

function terminateFfmpeg() {
  ffmpegBridge?.terminate();
  ffmpegBridge = null;
  ffmpegPromise = null;
}

async function transcodeFragment(fragment, stream, id) {
  const ffmpeg = await getFfmpeg();
  const input = `fragment-${id}.${stream === "video" ? "webm" : "audio"}`;
  const output = `fragment-${id}.${stream === "video" ? "mp4" : "m4a"}`;
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await fragment.arrayBuffer()));
    const status = await ffmpeg.exec(
      stream === "video"
        ? [
            "-i",
            input,
            "-map",
            "0:v:0",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-profile:v",
            "baseline",
            "-level:v",
            "3.1",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            output,
          ]
        : [
            "-i",
            input,
            "-map",
            "0:a:0",
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output,
          ],
    );
    if (status !== 0) {
      throw new Error(`FFmpeg could not transcode ${stream} fragment ${id}.`);
    }
    const data = await ffmpeg.readFile(output);
    return new Blob([data], {
      type: stream === "video" ? "video/mp4" : "audio/mp4",
    });
  } finally {
    await Promise.allSettled([
      ffmpeg.deleteFile(input),
      ffmpeg.deleteFile(output),
    ]);
  }
}

async function supportsNativeFinalization(stream) {
  try {
    if (stream === "video") {
      if (typeof VideoEncoder === "undefined") return false;
      const support = await VideoEncoder.isConfigSupported({
        codec: "avc1.42E01F",
        width: 1280,
        height: 720,
        bitrate: 2_500_000,
      });
      return support.supported;
    }
    if (typeof AudioEncoder === "undefined") return false;
    const support = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate: 48_000,
      numberOfChannels: 2,
    });
    return support.supported;
  } catch {
    return false;
  }
}

async function validateMp4(output, stream) {
  const header = await output.readHeader();
  if (
    header.byteLength < 8 ||
    new TextDecoder().decode(header.slice(4, 8)) !== "ftyp"
  ) {
    throw new Error("The encoded output is not a valid ISO media file.");
  }
  const input = new Input({
    formats: [MP4],
    source: await output.createSource(),
  });
  try {
    if (!(await input.canRead())) {
      throw new Error("The encoded output cannot be read as MP4.");
    }
    if (stream === "recording") {
      const [videoTracks, audioTracks] = await Promise.all([
        input.getVideoTracks(),
        input.getAudioTracks(),
      ]);
      if (videoTracks.length === 0 || audioTracks.length === 0) {
        throw new Error(
          "The encoded recording output is missing a playable track.",
        );
      }
    } else {
      const tracks =
        stream === "video"
          ? await input.getVideoTracks()
          : await input.getAudioTracks();
      if (tracks.length === 0) {
        throw new Error(`The encoded ${stream} output has no playable track.`);
      }
    }
  } finally {
    input.dispose();
  }
}

async function waitForResume() {
  if (!paused) return;
  await new Promise((resolve) => {
    resumePaused = resolve;
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeDatabaseValue(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateExportCheckpoint(sessionId, checkpoint, extra = {}) {
  const manifest = await readDatabaseValue(MANIFEST_KEY);
  if (!manifest || manifest.id !== sessionId) return;
  await storeDatabaseValue(MANIFEST_KEY, {
    ...manifest,
    export: { ...manifest.export, checkpoint, ...extra },
    updatedAt: Date.now(),
  });
}

async function removeCancelledExportOutputs(sessionId) {
  if (typeof navigator.storage?.getDirectory !== "function") return;
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle("hostpresent-recordings", {
    create: false,
  });
  const session = await recordings.getDirectoryHandle(sessionId, {
    create: false,
  });
  await session.removeEntry("exports", { recursive: true }).catch(() => {});
}

async function readDatabaseValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function fragmentKey(stream, index) {
  return `chunk:${stream}:${String(index).padStart(9, "0")}`;
}

function exportChunkKey(sessionId, filename, index) {
  return `export:${sessionId}:${filename}:${String(index).padStart(9, "0")}`;
}

async function deleteDatabaseValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function createIndexedDbOutput({ sessionId, filename, previousChunks = 0 }) {
  let chunks = 0;
  let position = 0;
  let writeQueue = Promise.resolve();
  const clear = (count) =>
    Promise.all(
      Array.from({ length: count }, (_, index) =>
        deleteDatabaseValue(exportChunkKey(sessionId, filename, index)),
      ),
    );

  return {
    async prepare() {
      await clear(previousChunks);
    },
    createWritable() {
      return {
        write(chunk) {
          const bytes = (chunk?.type === "write" ? chunk.data : chunk)?.slice();
          const chunkPosition =
            chunk?.type === "write" ? chunk.position : position;
          if (!(bytes instanceof Uint8Array)) {
            return Promise.reject(
              new Error("IndexedDB export received invalid media bytes."),
            );
          }
          if (chunkPosition !== position) {
            return Promise.reject(
              new Error("IndexedDB export requires sequential media writes."),
            );
          }
          const index = chunks;
          chunks += 1;
          position += bytes.byteLength;
          writeQueue = writeQueue.then(() =>
            storeDatabaseValue(
              exportChunkKey(sessionId, filename, index),
              bytes,
            ),
          );
          return writeQueue;
        },
        close() {
          return writeQueue;
        },
        async abort() {
          await writeQueue.catch(() => {});
          await clear(chunks);
        },
      };
    },
    getChunks() {
      return chunks;
    },
    async cancel() {
      await writeQueue.catch(() => {});
      await clear(chunks);
    },
    createSource() {
      let index = 0;
      return new ReadableStreamSource(
        new ReadableStream({
          async pull(controller) {
            if (index >= chunks) {
              controller.close();
              return;
            }
            const value = await readDatabaseValue(
              exportChunkKey(sessionId, filename, index),
            );
            index += 1;
            if (value) controller.enqueue(value);
          },
        }),
        { maxCacheSize: 1_048_576 },
      );
    },
    async readHeader() {
      const value = await readDatabaseValue(
        exportChunkKey(sessionId, filename, 0),
      );
      if (value instanceof Blob)
        return new Uint8Array(await value.arrayBuffer());
      return value instanceof Uint8Array ? value : new Uint8Array(value ?? []);
    },
  };
}

async function readPersistedFragment(manifest, stream, index) {
  if (manifest.storage !== "opfs") {
    return readDatabaseValue(fragmentKey(stream, index));
  }
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle("hostpresent-recordings");
  const session = await recordings.getDirectoryHandle(manifest.id);
  const track = await session.getDirectoryHandle(stream);
  const handle = await track.getFileHandle(fragmentKey(stream, index));
  return handle.getFile();
}

async function* persistedFragmentBytes(manifest, stream, start, end) {
  for (let index = start; index < end; index += 1) {
    if (cancelled) throw new Error("Recording export was cancelled.");
    const fragment = await readPersistedFragment(manifest, stream, index);
    if (!fragment?.size) continue;
    for await (const bytes of fragment.stream()) yield bytes;
  }
}

async function readPersistedSegment(manifest, stream, start, end) {
  const fragments = [];
  for (let index = start; index < end; index += 1) {
    if (cancelled) throw new Error("Recording export was cancelled.");
    const fragment = await readPersistedFragment(manifest, stream, index);
    if (fragment?.size) fragments.push(fragment);
  }
  return fragments.length ? new Blob(fragments) : null;
}

function sourceFromPersistedFragments(manifest, stream, start, end) {
  const iterator = persistedFragmentBytes(manifest, stream, start, end);
  return new ReadableStreamSource(
    new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await iterator.return?.();
      },
    }),
    { maxCacheSize: 1_048_576 },
  );
}

async function appendInputSamples({ source, stream, muxer, timeline }) {
  const input = new Input({
    formats: ALL_FORMATS,
    source,
  });
  let samples = 0;
  try {
    if (!(await input.canRead())) {
      throw new Error(`Recording ${stream} input is unreadable.`);
    }
    const inputTrack =
      stream === "video"
        ? await input.getPrimaryVideoTrack()
        : await input.getPrimaryAudioTrack();
    if (!inputTrack) return { timeline, samples };
    const sink =
      stream === "video"
        ? new VideoSampleSink(inputTrack)
        : new AudioSampleSink(inputTrack);
    let normalizedTimestamp = timeline;
    for await (const sample of sink.samples()) {
      const duration = getSafeSampleDuration(stream, sample.duration);
      const muxSample =
        stream === "audio" && needsAudioSampleTrim(sample.duration)
          ? sample.trim(
              0,
              Math.max(1, Math.floor(sample.sampleRate * duration)),
            )
          : sample;
      muxSample.setTimestamp(normalizedTimestamp);
      // Audio samples derive their duration from their frame count and expose
      // no mutator. Video samples can carry corrupt container tail durations,
      // so normalize those before muxing.
      if (typeof muxSample.setDuration === "function") {
        muxSample.setDuration(duration);
      }
      await muxer.add(muxSample);
      muxSample.close();
      if (muxSample !== sample) sample.close();
      samples += 1;
      normalizedTimestamp += duration;
    }
    return { timeline: normalizedTimestamp, samples };
  } finally {
    input.dispose();
  }
}

async function appendEncodedPackets({ source, stream, muxer, timeline }) {
  const input = new Input({ formats: [MP4], source });
  let packets = 0;
  try {
    if (!(await input.canRead())) {
      throw new Error(`Transcoded ${stream} fragment is unreadable.`);
    }
    const track =
      stream === "video"
        ? await input.getPrimaryVideoTrack()
        : await input.getPrimaryAudioTrack();
    if (!track) return { timeline, packets };
    const expectedCodec = stream === "video" ? "avc" : "aac";
    if ((await track.getCodec()) !== expectedCodec) {
      throw new Error(`FFmpeg did not produce ${expectedCodec} ${stream}.`);
    }
    const decoderConfig = await track.getDecoderConfig();
    if (!decoderConfig) {
      throw new Error(`FFmpeg did not provide ${stream} decoder metadata.`);
    }
    const sink = new EncodedPacketSink(track);
    let firstTimestamp = null;
    for await (const packet of sink.packets()) {
      firstTimestamp ??= packet.timestamp;
      const shifted = packet.clone({
        timestamp: timeline + packet.timestamp - firstTimestamp,
      });
      timeline = Math.max(timeline, shifted.timestamp + shifted.duration);
      await muxer.add(shifted);
      packets += 1;
    }
    return { timeline, packets, decoderConfig };
  } finally {
    input.dispose();
  }
}

async function getEncodedTrackConfig({ source, stream }) {
  const input = new Input({ formats: [MP4], source });
  try {
    if (!(await input.canRead())) {
      throw new Error(`Final ${stream} track is unreadable.`);
    }
    const track =
      stream === "video"
        ? await input.getPrimaryVideoTrack()
        : await input.getPrimaryAudioTrack();
    const expectedCodec = stream === "video" ? "avc" : "aac";
    if (!track || (await track.getCodec()) !== expectedCodec) {
      throw new Error(`Final ${stream} track is not ${expectedCodec}.`);
    }
    const decoderConfig = await track.getDecoderConfig();
    if (!decoderConfig) {
      throw new Error(`Final ${stream} track has no decoder metadata.`);
    }
    return decoderConfig;
  } finally {
    input.dispose();
  }
}

async function appendFinalTrackToRecording({ source, stream, muxer }) {
  const input = new Input({ formats: [MP4], source });
  try {
    if (!(await input.canRead())) {
      throw new Error(`Final ${stream} track is unreadable.`);
    }
    const track =
      stream === "video"
        ? await input.getPrimaryVideoTrack()
        : await input.getPrimaryAudioTrack();
    if (!track) throw new Error(`Final ${stream} track is missing.`);
    const sink = new EncodedPacketSink(track);
    for await (const packet of sink.packets()) {
      await muxer.add(stream, packet);
    }
  } finally {
    input.dispose();
  }
}

async function muxFinalRecording({ videoOutput, audioOutput, outputHandle }) {
  const [videoDecoderConfig, audioDecoderConfig] = await Promise.all([
    getEncodedTrackConfig({
      source: await videoOutput.createSource(),
      stream: "video",
    }),
    getEncodedTrackConfig({
      source: await audioOutput.createSource(),
      stream: "audio",
    }),
  ]);
  const muxer = await createMp4CombinedEncodedMuxer({
    writable: await outputHandle.createWritable(),
    videoDecoderConfig,
    audioDecoderConfig,
  });
  try {
    await appendFinalTrackToRecording({
      source: await videoOutput.createSource(),
      stream: "video",
      muxer,
    });
    await appendFinalTrackToRecording({
      source: await audioOutput.createSource(),
      stream: "audio",
      muxer,
    });
    await muxer.finalize();
  } catch (error) {
    await muxer.cancel().catch(() => {});
    throw error;
  }
}

async function exportPersistedNativeTrack({ manifest, stream, outputHandle }) {
  const track = manifest.tracks[stream];
  const writable = await outputHandle.createWritable();
  const muxer = await createMp4SampleMuxer({ writable, stream });
  const startKey = stream === "video" ? "videoStartIndex" : "audioStartIndex";
  const endKey = stream === "video" ? "videoEndIndex" : "audioEndIndex";
  const segments = manifest.segments?.length
    ? manifest.segments
    : [{ id: 0, [startKey]: 0, [endKey]: track.chunkCount }];
  let timeline = 0;
  let samples = 0;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const start = segment[startKey] ?? 0;
      const end = segment[endKey] ?? track.chunkCount;
      if (end <= start) continue;
      timeline += (segment.gapDurationMs ?? 0) / 1000;
      const result = await appendInputSamples({
        source: sourceFromPersistedFragments(manifest, stream, start, end),
        stream,
        muxer,
        timeline,
      });
      timeline = result.timeline;
      samples += result.samples;
      post("progress", {
        phase: "encoding",
        stream,
        completed: index + 1,
        total: segments.length,
      });
    }
    if (samples === 0) throw new Error(`Recording has no ${stream} packets.`);
    await muxer.finalize();
  } catch (error) {
    await muxer.cancel().catch(() => {});
    throw error;
  }
}

async function exportPersistedTrack({ manifest, stream, outputHandle }) {
  const track = manifest.tracks[stream];
  const useFfmpegFallback = !(await supportsNativeFinalization(stream));
  if (!useFfmpegFallback) {
    return exportPersistedNativeTrack({ manifest, stream, outputHandle });
  }
  let timeline = 0;
  let packets = 0;
  let muxer = null;
  try {
    const startKey = stream === "video" ? "videoStartIndex" : "audioStartIndex";
    const endKey = stream === "video" ? "videoEndIndex" : "audioEndIndex";
    const segments = manifest.segments?.length
      ? manifest.segments
      : [{ id: 0, [startKey]: 0, [endKey]: track.chunkCount }];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const start = segment[startKey] ?? 0;
      const end = segment[endKey] ?? track.chunkCount;
      if (end <= start) continue;
      timeline += (segment.gapDurationMs ?? 0) / 1000;
      const persistedSegment = useFfmpegFallback
        ? await readPersistedSegment(manifest, stream, start, end)
        : null;
      const fragmentIndexes = useFfmpegFallback
        ? [null]
        : Array.from({ length: end - start }, (_, offset) => start + offset);
      for (const fragmentIndex of fragmentIndexes) {
        if (cancelled) throw new Error("Recording export was cancelled.");
        const fragment = useFfmpegFallback
          ? persistedSegment
          : await readPersistedFragment(manifest, stream, fragmentIndex);
        if (!fragment?.size) continue;
        const sourceFile = useFfmpegFallback
          ? await transcodeFragment(fragment, stream, `${segment.id}`)
          : fragment;
        const input = new Input({
          formats: useFfmpegFallback ? [MP4] : ALL_FORMATS,
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
          if (!inputTrack) continue;
          if (!muxer) {
            const writable = await outputHandle.createWritable();
            if (useFfmpegFallback) {
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
            } else {
              muxer = await createMp4SampleMuxer({ writable, stream });
            }
          }
          const result = useFfmpegFallback
            ? await appendEncodedPackets({
                source: new BlobSource(sourceFile, { maxCacheSize: 1_048_576 }),
                stream,
                muxer,
                timeline,
              })
            : await appendInputSamples({
                source: new BlobSource(sourceFile, { maxCacheSize: 1_048_576 }),
                stream,
                muxer,
                timeline,
              });
          timeline = result.timeline;
          packets += result.packets ?? result.samples;
        } finally {
          input.dispose();
        }
      }
      post("progress", {
        phase: useFfmpegFallback ? "transcoding" : "encoding",
        stream,
        completed: index + 1,
        total: segments.length,
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

async function readExportFile(session, path) {
  const [folder, filename] = path.split("/");
  const directory = await session.getDirectoryHandle(folder);
  const handle = await directory.getFileHandle(filename);
  return handle.getFile();
}

function createOpfsOutput(handle) {
  return {
    createWritable() {
      return handle.createWritable();
    },
    async createSource() {
      return new BlobSource(await handle.getFile(), {
        maxCacheSize: 1_048_576,
      });
    },
    async readHeader() {
      const file = await handle.getFile();
      return new Uint8Array(await file.slice(0, 8).arrayBuffer());
    },
    getChunks() {
      return undefined;
    },
  };
}

async function exportPersistedSegments({
  manifest,
  session,
  stream,
  outputHandle,
}) {
  const writable = await outputHandle.createWritable();
  const muxer = await createMp4SampleMuxer({ writable, stream });
  let timeline = 0;
  let samples = 0;
  const segments = manifest.export?.segments ?? [];
  try {
    for (let index = 0; index < segments.length; index += 1) {
      if (cancelled) throw new Error("Recording export was cancelled.");
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
      post("progress", {
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

async function exportPersistedRecording(sessionId) {
  const manifest = await readDatabaseValue(MANIFEST_KEY);
  if (!manifest || manifest.id !== sessionId) {
    throw new Error("The recording session is no longer available.");
  }
  const isOpfs = manifest.storage === "opfs";
  let session = null;
  let videoOutput;
  let audioOutput;
  let recordingOutput;
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
      videoOutput.prepare(),
      audioOutput.prepare(),
      recordingOutput.prepare(),
    ]);
  }
  activeExportOutputs = [videoOutput, audioOutput, recordingOutput];
  await updateExportCheckpoint(sessionId, "remuxing");
  post("progress", { phase: "remuxing" });
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
  });
  await updateExportCheckpoint(sessionId, "video-export");
  await exportTrack({
    manifest,
    session,
    stream: "audio",
    outputHandle: audioOutput,
  });
  await updateExportCheckpoint(sessionId, "audio-export");
  await muxFinalRecording({
    videoOutput,
    audioOutput,
    outputHandle: recordingOutput,
  });
  await updateExportCheckpoint(sessionId, "recording-export");
  await updateExportCheckpoint(sessionId, "validating");
  post("progress", { phase: "validating" });
  await Promise.all([
    validateMp4(videoOutput, "video"),
    validateMp4(audioOutput, "audio"),
    validateMp4(recordingOutput, "recording"),
  ]);
  await updateExportCheckpoint(sessionId, "writing");
  post("progress", { phase: "writing" });
  const files = [
    {
      stream: "video",
      path: isOpfs ? "exports/final-recording.mp4" : "final-recording.mp4",
      storage: manifest.storage,
      chunks: recordingOutput.getChunks(),
    },
    {
      stream: "audio",
      path: isOpfs ? "exports/final-audio.m4a" : "final-audio.m4a",
      storage: manifest.storage,
      chunks: audioOutput.getChunks(),
    },
  ];
  await updateExportCheckpoint(sessionId, "complete", { files });
  post("complete", {
    files,
  });
  activeExportOutputs = [];
}

async function encodeVideo({ readable, writable, width, height }) {
  const reader = readable.getReader();
  readers.add(reader);
  const muxer = await createMp4TrackMuxer({ writable, stream: "video" });
  let writes = Promise.resolve();
  let frames = 0;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      writes = writes.then(() => muxer.add(chunk, meta));
    },
    error: (error) => post("failed", { capture: true, error: error.message }),
  });
  encoder.configure({
    codec: "avc1.42E01F",
    width,
    height,
    bitrate: 2_500_000,
  });

  while (!cancelled && !stopping) {
    await waitForResume();
    const { value: frame, done } = await reader.read();
    if (done) break;
    const adjusted = new VideoFrame(frame, {
      timestamp: Math.max(0, frame.timestamp - timestampOffset),
    });
    encoder.encode(adjusted, { keyFrame: frames % 150 === 0 });
    adjusted.close();
    frame.close();
    frames += 1;
    if (frames % 30 === 0) post("progress", { phase: "encoding", frames });
  }
  await encoder.flush();
  await writes;
  await muxer.finalize();
  readers.delete(reader);
}

async function encodeAudio({
  readable,
  writable,
  sampleRate = 48_000,
  channels = 2,
}) {
  const reader = readable.getReader();
  readers.add(reader);
  const muxer = await createMp4TrackMuxer({ writable, stream: "audio" });
  let writes = Promise.resolve();
  const encodedOffsets = [];
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      const offset = encodedOffsets.shift() ?? timestampOffset;
      writes = writes.then(() => muxer.add(chunk, meta, offset));
    },
    error: (error) => post("failed", { capture: true, error: error.message }),
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels: channels,
  });
  while (!cancelled && !stopping) {
    await waitForResume();
    const { value: audioData, done } = await reader.read();
    if (done) break;
    encodedOffsets.push(timestampOffset);
    encoder.encode(audioData);
    audioData.close();
  }
  await encoder.flush();
  await writes;
  await muxer.finalize();
  readers.delete(reader);
}

self.onmessage = async ({ data }) => {
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
    post("paused");
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
      post("resumed");
    }
    return;
  }
  if (data.type === "finalize") {
    try {
      cancelled = false;
      stopping = false;
      activeSessionId = data.sessionId;
      await exportPersistedRecording(data.sessionId);
    } catch (error) {
      if (cancelled) {
        await Promise.allSettled([
          removeCancelledExportOutputs(data.sessionId),
          updateExportCheckpoint(data.sessionId, "cancelled"),
        ]);
        post("cancelled");
        return;
      }
      await updateExportCheckpoint(data.sessionId, "failed", {
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
      post("failed", {
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
    post("progress", { phase: "initializing" });
    await Promise.all([
      encodeVideo({
        readable: data.videoReadable,
        writable: await videoHandle.createWritable(),
        width: data.width,
        height: data.height,
      }),
      encodeAudio({
        readable: data.audioReadable,
        writable: await audioHandle.createWritable(),
        sampleRate: data.sampleRate,
        channels: data.channels,
      }),
    ]);
    post("progress", { phase: "validating" });
    await Promise.all([
      validateMp4(videoOutput, "video"),
      validateMp4(audioOutput, "audio"),
    ]);
    post("progress", { phase: "writing" });
    post(cancelled && !stopping ? "cancelled" : "complete", {
      capture: true,
      files: [
        { stream: "video", path: `exports/${videoFilename}` },
        { stream: "audio", path: `exports/${audioFilename}` },
      ],
    });
  } catch (error) {
    if (cancelled) {
      post("cancelled");
      return;
    }
    post("failed", {
      capture: true,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeSessionId = null;
  }
};

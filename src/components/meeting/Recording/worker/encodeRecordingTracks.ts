import { createMp4TrackMuxer } from "../mediaMuxer";
import type { RecordingWorkerResponse } from "./recordingWorkerProtocol";

export type RecordingTrackReader =
  | ReadableStreamDefaultReader<VideoFrame>
  | ReadableStreamDefaultReader<AudioData>;

export interface RecordingCaptureRuntime {
  readers: Set<RecordingTrackReader>;
  isCancelled: () => boolean;
  isStopping: () => boolean;
  waitForResume: () => Promise<void>;
  timestampOffset: () => number;
  post: (message: RecordingWorkerResponse) => void;
}

export async function encodeVideoTrack({
  readable,
  writable,
  width,
  height,
  runtime,
}: {
  readable: ReadableStream<VideoFrame>;
  writable: FileSystemWritableFileStream;
  width: number;
  height: number;
  runtime: RecordingCaptureRuntime;
}): Promise<void> {
  const reader = readable.getReader();
  runtime.readers.add(reader);
  const muxer = await createMp4TrackMuxer({ writable, stream: "video" });
  let writes = Promise.resolve();
  let frames = 0;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      writes = writes.then(() => muxer.add(chunk, metadata));
    },
    error: (error) =>
      runtime.post({ type: "failed", capture: true, error: error.message }),
  });
  encoder.configure({
    codec: "avc1.42E01F",
    width,
    height,
    bitrate: 2_500_000,
  });

  while (!runtime.isCancelled() && !runtime.isStopping()) {
    await runtime.waitForResume();
    const { value: frame, done } = await reader.read();
    if (done) break;
    const adjusted = new VideoFrame(frame, {
      timestamp: Math.max(0, frame.timestamp - runtime.timestampOffset()),
    });
    encoder.encode(adjusted, { keyFrame: frames % 150 === 0 });
    adjusted.close();
    frame.close();
    frames += 1;
    if (frames % 30 === 0) {
      runtime.post({ type: "progress", phase: "encoding", frames });
    }
  }
  await encoder.flush();
  await writes;
  await muxer.finalize();
  runtime.readers.delete(reader);
}

export async function encodeAudioTrack({
  readable,
  writable,
  sampleRate = 48_000,
  channels = 2,
  runtime,
}: {
  readable: ReadableStream<AudioData>;
  writable: FileSystemWritableFileStream;
  sampleRate?: number;
  channels?: number;
  runtime: RecordingCaptureRuntime;
}): Promise<void> {
  const reader = readable.getReader();
  runtime.readers.add(reader);
  const muxer = await createMp4TrackMuxer({ writable, stream: "audio" });
  let writes = Promise.resolve();
  const encodedOffsets: number[] = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      const offset = encodedOffsets.shift() ?? runtime.timestampOffset();
      writes = writes.then(() => muxer.add(chunk, metadata, offset));
    },
    error: (error) =>
      runtime.post({ type: "failed", capture: true, error: error.message }),
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels: channels,
  });
  while (!runtime.isCancelled() && !runtime.isStopping()) {
    await runtime.waitForResume();
    const { value: audioData, done } = await reader.read();
    if (done) break;
    encodedOffsets.push(runtime.timestampOffset());
    encoder.encode(audioData);
    audioData.close();
  }
  await encoder.flush();
  await writes;
  await muxer.finalize();
  runtime.readers.delete(reader);
}

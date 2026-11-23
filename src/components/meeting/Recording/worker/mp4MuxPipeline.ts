import {
  ALL_FORMATS,
  AudioSampleSink,
  EncodedPacketSink,
  Input,
  MP4,
  VideoSampleSink,
} from "mediabunny";
import { createMp4CombinedEncodedMuxer } from "../mediaMuxer";
import { getSafeSampleDuration, needsAudioSampleTrim } from "./sampleTiming";
import type { WorkerExportOutput } from "./workerStorage";

export async function validateMp4(
  output: WorkerExportOutput,
  stream: "video" | "audio" | "recording",
): Promise<void> {
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

export async function appendInputSamples({
  source,
  stream,
  muxer,
  timeline,
}: {
  source?: any;
  stream?: any;
  muxer?: any;
  timeline?: any;
}) {
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
        ? new VideoSampleSink(
            inputTrack as import("mediabunny").InputVideoTrack,
          )
        : new AudioSampleSink(
            inputTrack as import("mediabunny").InputAudioTrack,
          );
    let normalizedTimestamp = timeline;
    for await (const sample of sink.samples()) {
      const duration = getSafeSampleDuration(stream, sample.duration);
      const audioSample = sample as import("mediabunny").AudioSample;
      const muxSample =
        stream === "audio" && needsAudioSampleTrim(sample.duration)
          ? audioSample.trim(
              0,
              Math.max(1, Math.floor(audioSample.sampleRate * duration)),
            )
          : sample;
      muxSample.setTimestamp(normalizedTimestamp);
      // Audio samples derive their duration from their frame count and expose
      // no mutator. Video samples can carry corrupt container tail durations,
      // so normalize those before muxing.
      if (
        "setDuration" in muxSample &&
        typeof muxSample.setDuration === "function"
      ) {
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

export async function appendEncodedPackets({
  source,
  stream,
  muxer,
  timeline,
}: {
  source?: any;
  stream?: any;
  muxer?: any;
  timeline?: any;
}) {
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
    for await (const packet of sink.packets()) {
      // Browser MediaRecorder fragments occasionally expose a corrupt final
      // packet timestamp or duration after FFmpeg remuxing. Normalize encoded
      // packets just as we do decoded samples so one tail packet cannot extend
      // a short recording into minutes of silent media.
      const duration = getSafeSampleDuration(stream, packet.duration);
      const shifted = packet.clone({
        timestamp: timeline,
        duration,
      });
      timeline += duration;
      await muxer.add(shifted);
      packets += 1;
    }
    return { timeline, packets, decoderConfig };
  } finally {
    input.dispose();
  }
}

async function withFinalTrack<T>(
  {
    source,
    stream,
  }: {
    source: any;
    stream: "video" | "audio";
  },
  readTrack: (track: any) => Promise<T>,
): Promise<T> {
  const input = new Input({ formats: [MP4], source });
  try {
    if (!(await input.canRead())) {
      throw new Error(`Final ${stream} track is unreadable.`);
    }
    const track =
      stream === "video"
        ? await input.getPrimaryVideoTrack()
        : await input.getPrimaryAudioTrack();
    return await readTrack(track);
  } finally {
    input.dispose();
  }
}

async function getEncodedTrackConfig({
  source,
  stream,
}: {
  source?: any;
  stream?: any;
}) {
  return withFinalTrack({ source, stream }, async (track) => {
    const expectedCodec = stream === "video" ? "avc" : "aac";
    if (!track || (await track.getCodec()) !== expectedCodec) {
      throw new Error(`Final ${stream} track is not ${expectedCodec}.`);
    }
    const decoderConfig = await track.getDecoderConfig();
    if (!decoderConfig) {
      throw new Error(`Final ${stream} track has no decoder metadata.`);
    }
    return decoderConfig;
  });
}

async function appendFinalTrackToRecording({
  source,
  stream,
  muxer,
}: {
  source?: any;
  stream?: any;
  muxer?: any;
}) {
  return withFinalTrack({ source, stream }, async (track) => {
    if (!track) throw new Error(`Final ${stream} track is missing.`);
    const sink = new EncodedPacketSink(track);
    let timeline = 0;
    for await (const packet of sink.packets()) {
      const duration = getSafeSampleDuration(stream, packet.duration);
      const normalized = packet.clone({ timestamp: timeline, duration });
      timeline += duration;
      await muxer.add(stream, normalized);
    }
  });
}

export async function muxFinalRecording({
  videoOutput,
  audioOutput,
  outputHandle,
}: {
  videoOutput?: any;
  audioOutput?: any;
  outputHandle?: any;
}): Promise<void> {
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

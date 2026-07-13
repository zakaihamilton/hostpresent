import {
  AudioSampleSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  VideoSampleSource,
} from "mediabunny";

function createSeekableTarget(writable) {
  return new StreamTarget(
    new WritableStream({
      write(chunk) {
        return writable.write(chunk);
      },
      close() {
        return writable.close();
      },
      abort(reason) {
        return writable.abort(reason);
      },
    }),
    { chunked: true, chunkSize: 1_048_576 },
  );
}

/**
 * Keeps the recording worker independent of a particular MP4 muxer. The
 * target is seekable OPFS output, so Mediabunny can write a real MP4 without
 * holding the completed file in page memory.
 */
export async function createMp4TrackMuxer({ writable, stream }) {
  const source =
    stream === "video"
      ? new EncodedVideoPacketSource("avc")
      : new EncodedAudioPacketSource("aac");
  const target = createSeekableTarget(writable);
  const output = new Output({ format: new Mp4OutputFormat(), target });
  if (stream === "video") output.addVideoTrack(source);
  else output.addAudioTrack(source);
  await output.start();

  return {
    add(chunk, meta, timestampOffset = 0) {
      let packet = EncodedPacket.fromEncodedChunk(chunk);
      if (timestampOffset) {
        packet = packet.clone({
          timestamp: Math.max(
            0,
            packet.timestamp - timestampOffset / 1_000_000,
          ),
        });
      }
      return source.add(packet, meta);
    },
    finalize() {
      return output.finalize();
    },
    cancel() {
      return output.cancel();
    },
  };
}

export async function createMp4SampleMuxer({ writable, stream }) {
  const source =
    stream === "video"
      ? new VideoSampleSource({ codec: "avc", bitrate: 2_500_000 })
      : new AudioSampleSource({ codec: "aac", bitrate: 128_000 });
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: createSeekableTarget(writable),
  });
  if (stream === "video") output.addVideoTrack(source);
  else output.addAudioTrack(source);
  await output.start();

  return {
    add(sample) {
      return source.add(sample);
    },
    finalize() {
      return output.finalize();
    },
    cancel() {
      return output.cancel();
    },
  };
}

/**
 * Adds already-encoded AVC/AAC packets to an MP4. This is used after the
 * per-fragment FFmpeg fallback so Safari/Firefox do not need WebCodecs
 * encoders merely to finalize a MediaRecorder recording.
 */
export async function createMp4EncodedMuxer({
  writable,
  stream,
  decoderConfig,
}) {
  const source =
    stream === "video"
      ? new EncodedVideoPacketSource("avc")
      : new EncodedAudioPacketSource("aac");
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: createSeekableTarget(writable),
  });
  if (stream === "video") output.addVideoTrack(source);
  else output.addAudioTrack(source);
  await output.start();

  let needsDecoderConfig = true;
  return {
    add(packet) {
      const metadata = needsDecoderConfig ? { decoderConfig } : undefined;
      needsDecoderConfig = false;
      return source.add(packet, metadata);
    },
    finalize() {
      return output.finalize();
    },
    cancel() {
      return output.cancel();
    },
  };
}

export async function createMp4CombinedEncodedMuxer({
  writable,
  videoDecoderConfig,
  audioDecoderConfig,
}) {
  const videoSource = new EncodedVideoPacketSource("avc");
  const audioSource = new EncodedAudioPacketSource("aac");
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: createSeekableTarget(writable),
  });
  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource);
  await output.start();

  const needsDecoderConfig = { video: true, audio: true };
  return {
    add(stream, packet) {
      const metadata = needsDecoderConfig[stream]
        ? {
            decoderConfig:
              stream === "video" ? videoDecoderConfig : audioDecoderConfig,
          }
        : undefined;
      needsDecoderConfig[stream] = false;
      return stream === "video"
        ? videoSource.add(packet, metadata)
        : audioSource.add(packet, metadata);
    },
    finalize() {
      return output.finalize();
    },
    cancel() {
      return output.cancel();
    },
  };
}

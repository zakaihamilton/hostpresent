export function supportsWebCodecsRecording() {
  return (
    typeof Worker !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof MediaStreamTrackProcessor !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

export async function supportsWebCodecsRecordingCodecs({ width, height }) {
  if (!supportsWebCodecsRecording()) return false;
  try {
    const [video, audio] = await Promise.all([
      VideoEncoder.isConfigSupported({
        // Baseline Level 3.1 is the portable H.264 profile for 720p30.
        // Level 3.0 is too low for 1280×720 and can be rejected by Samsung
        // players even when the frames themselves are otherwise decodable.
        codec: "avc1.42E01F",
        width,
        height,
        bitrate: 2_500_000,
      }),
      AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: 48_000,
        numberOfChannels: 2,
      }),
    ]);
    return video.supported && audio.supported;
  } catch {
    // Browsers can expose WebCodecs while rejecting a particular hardware or
    // software configuration. Treat that as a capability miss and use the
    // persisted MediaRecorder path rather than failing to start a recording.
    return false;
  }
}

export function createWebCodecsRecordingWorker() {
  return new Worker(
    new URL("./worker/webCodecsRecording.worker.js", import.meta.url),
    {
      type: "module",
    },
  );
}

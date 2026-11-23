import { createFfmpegBridge } from "./ffmpegBridge";

let ffmpegPromise: Promise<
  ReturnType<typeof createFfmpegBridge> extends Promise<infer T> ? T : any
> | null = null;
let ffmpegBridge: any = null;

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

export function terminateFfmpeg(): void {
  ffmpegBridge?.terminate();
  ffmpegBridge = null;
  ffmpegPromise = null;
}

export async function transcodeFragment(
  fragment: Blob,
  stream: "video" | "audio",
  id: string,
): Promise<Blob> {
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

export async function supportsNativeFinalization(
  stream: "video" | "audio",
): Promise<boolean> {
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

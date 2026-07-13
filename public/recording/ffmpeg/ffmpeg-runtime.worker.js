/* global createFFmpegCore */

// This worker intentionally stays classic: the UMD FFmpeg core is loaded with
// importScripts so Firefox does not need to dynamically import a blob module.
let ffmpeg = null;

function respond(id, result, transfer = []) {
  self.postMessage({ id, result }, transfer);
}

function fail(id, error) {
  self.postMessage({
    id,
    error: error instanceof Error ? error.message : String(error),
  });
}

self.onmessage = async ({ data }) => {
  const { id, type, payload = {} } = data;
  try {
    if (type === "load") {
      importScripts("/recording/ffmpeg/ffmpeg-core.js");
      ffmpeg = await createFFmpegCore();
      respond(id, true);
      return;
    }
    if (!ffmpeg) throw new Error("FFmpeg is not loaded.");
    if (type === "write") {
      ffmpeg.FS.writeFile(payload.path, new Uint8Array(payload.data));
      respond(id, true);
      return;
    }
    if (type === "exec") {
      respond(id, ffmpeg.exec(...payload.args));
      return;
    }
    if (type === "read") {
      const bytes = ffmpeg.FS.readFile(payload.path);
      respond(id, bytes.buffer, [bytes.buffer]);
      return;
    }
    if (type === "delete") {
      ffmpeg.FS.unlink(payload.path);
      respond(id, true);
      return;
    }
    throw new Error(`Unknown FFmpeg worker request: ${type}`);
  } catch (error) {
    fail(id, error);
  }
};

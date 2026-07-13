import { createIndexedDbExportStream } from "./recordingStorage";

export function hasDirectFileExport() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseRecordingDirectory() {
  if (!hasDirectFileExport()) return null;
  try {
    return await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if (error?.name === "AbortError") return null;
    throw error;
  }
}

export function downloadRecordingFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

function triggerDownload(url, filename, { cleanup = true } = {}) {
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  if (cleanup) setTimeout(() => document.body.removeChild(anchor), 100);
}

export async function downloadRecordingStream(stream, filename) {
  return requestServiceWorkerDownload({ stream, filename });
}

async function requestServiceWorkerDownload(payload) {
  const controller = navigator.serviceWorker?.controller;
  if (!controller || typeof MessageChannel === "undefined") return false;
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 5_000);
    channel.port1.onmessage = ({ data }) => {
      if (data?.type !== "recording-download-ready" || data.id !== id) return;
      clearTimeout(timeout);
      // Chromium can cancel a navigation-backed stream when its initiating
      // anchor is removed before the response body finishes.
      triggerDownload(`/recording-download/${id}`, payload.filename, {
        cleanup: false,
      });
      channel.port1.close();
      resolve(true);
    };
    try {
      controller.postMessage(
        { type: "recording-download", id, ...payload },
        payload.stream ? [payload.stream, channel.port2] : [channel.port2],
      );
    } catch {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(false);
    }
  });
}

export function downloadIndexedDbRecording({
  sessionId,
  path,
  chunks,
  filename,
}) {
  return requestServiceWorkerDownload({
    type: "recording-indexeddb-download",
    sessionId,
    filename,
    chunks,
    sourceFilename: path,
  });
}

async function streamToWritable(stream, writable) {
  const writer = writable.getWriter?.();
  if (writer) {
    try {
      for await (const chunk of stream) await writer.write(chunk);
      await writer.close();
    } catch (error) {
      await writer.abort(error).catch(() => {});
      throw error;
    }
    return;
  }
  await stream.pipeTo(writable);
}

function withFilenameSuffix(filename, suffix) {
  const extensionIndex = filename.lastIndexOf(".");
  if (extensionIndex <= 0) return `${filename} (${suffix})`;
  return `${filename.slice(0, extensionIndex)} (${suffix})${filename.slice(extensionIndex)}`;
}

async function getAvailableFileHandle(directory, filename) {
  for (let suffix = 0; ; suffix += 1) {
    const candidate =
      suffix === 0 ? filename : withFilenameSuffix(filename, suffix);
    try {
      await directory.getFileHandle(candidate);
    } catch (error) {
      if (error?.name !== "NotFoundError") throw error;
      return directory.getFileHandle(candidate, { create: true });
    }
  }
}

export async function deliverOpfsExport({
  sessionId,
  path,
  directory,
  filename,
}) {
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle("hostpresent-recordings");
  const session = await recordings.getDirectoryHandle(sessionId);
  const [folder, file] = path.split("/");
  const source = await (await session.getDirectoryHandle(folder)).getFileHandle(
    file,
  );
  const output = await source.getFile();
  if (directory) {
    const target = await getAvailableFileHandle(directory, filename);
    const writable = await target.createWritable();
    await streamToWritable(output.stream(), writable);
    return;
  }
  if (await downloadRecordingStream(output.stream(), filename)) return;
  // Older browsers may not support transferable ReadableStreams. The fallback
  // still hands the OPFS File directly to the browser; it never builds a
  // complete recording Blob in the page.
  downloadRecordingFile(output, filename);
}

export async function deliverIndexedDbExport({
  sessionId,
  path,
  chunks,
  directory,
  filename,
}) {
  const createStream = () =>
    createIndexedDbExportStream({ sessionId, filename: path, chunks });
  if (directory) {
    const target = await getAvailableFileHandle(directory, filename);
    await streamToWritable(createStream(), await target.createWritable());
    return;
  }
  if (
    await downloadIndexedDbRecording({
      sessionId,
      path,
      chunks,
      filename,
    })
  ) {
    return;
  }
  if (hasDirectFileExport()) {
    throw new Error(
      "Choose an export folder to save this IndexedDB-only recording in Chromium.",
    );
  }
  throw new Error(
    "This browser cannot stream the IndexedDB recording to a download.",
  );
}

export function deliverRecordingExport({ storage = "opfs", ...options }) {
  return storage === "indexeddb"
    ? deliverIndexedDbExport(options)
    : deliverOpfsExport(options);
}

export async function deliverRecordingExports(files, options) {
  for (const file of files) {
    await deliverRecordingExport({ ...options, ...file });
    // A streamed download starts asynchronously. Yield before starting the
    // second attachment so Chromium does not classify it as a blocked burst.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

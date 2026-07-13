import { buildRecordingFilename } from "@/lib/recordingFilename";
import { deliverRecordingExports } from "../recordingExport";
import {
  clearSavedRecording,
  flushRecordingWrites,
  updateRecordingSession,
} from "../recordingStorage";
import { createWebCodecsRecordingWorker } from "../webCodecsRecording";

/**
 * Finalizes the durable fragment store. This controller deliberately has no
 * React state: callers own their refs and translate worker progress into UI.
 */
export async function finalizePersistedRecording({
  exportDirectoryRef,
  recordingSessionRef,
  sessionName,
  updateProgress,
  workerRef,
}) {
  await flushRecordingWrites();
  const session = recordingSessionRef.current;
  if (!session) return;

  const videoFilename = buildRecordingFilename({
    sessionName,
    extension: "mp4",
  });
  const audioFilename = buildRecordingFilename({
    sessionName,
    extension: "m4a",
  });
  updateProgress("initializing", 5, videoFilename);

  const worker = createWebCodecsRecordingWorker();
  workerRef.current = worker;
  return new Promise((resolve) => {
    let settled = false;
    const releaseWorker = () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      releaseWorker();
      resolve(result);
    };
    const fail = async (error, phase = "warning") => {
      if (settled) return;
      await updateRecordingSession({ status: "interrupted" });
      updateProgress(
        phase,
        0,
        phase === "cancelled"
          ? "Recording export cancelled."
          : error instanceof Error
            ? error.message
            : String(error ?? "Could not deliver recording files."),
      );
      finish(false);
    };
    worker.onmessage = async ({ data }) => {
      if (data.type === "progress") {
        updateProgress(data.phase, 50, videoFilename);
        return;
      }
      if (data.type === "failed" || data.type === "cancelled") {
        await fail(
          data.error,
          data.type === "failed" ? "warning" : "cancelled",
        );
        return;
      }
      if (data.type !== "complete") return;

      try {
        await deliverRecordingExports(
          data.files.map((file) => ({
            ...file,
            filename: file.stream === "video" ? videoFilename : audioFilename,
          })),
          { sessionId: session.id, directory: exportDirectoryRef.current },
        );
        await updateRecordingSession({ status: "exported" });
        updateProgress("complete", 100, videoFilename);
        // A browser download stream pulls IndexedDB bytes after its request has
        // started. Keep that source until the next recording/discard so the
        // service worker cannot race with a manifest cleanup.
        if (!data.files.some((file) => file.storage === "indexeddb")) {
          clearSavedRecording().catch(() => {});
        }
        recordingSessionRef.current = null;
        finish(true);
      } catch (error) {
        await fail(error);
      }
    };
    worker.onerror = (event) => {
      void fail(new Error(event.message || "Recording export worker failed."));
    };
    worker.onmessageerror = () => {
      void fail(new Error("Recording export worker returned unreadable data."));
    };
    worker.postMessage({ type: "finalize", sessionId: session.id });
  });
}

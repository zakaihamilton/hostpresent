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
    worker.onmessage = async ({ data }) => {
      if (data.type === "progress") {
        updateProgress(data.phase, 50, videoFilename);
        return;
      }
      if (data.type === "failed" || data.type === "cancelled") {
        await updateRecordingSession({ status: "interrupted" });
        workerRef.current?.terminate();
        workerRef.current = null;
        updateProgress(
          data.type === "failed" ? "warning" : "cancelled",
          0,
          data.type === "failed" ? data.error : "Recording export cancelled.",
        );
        resolve(false);
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
        resolve(true);
      } catch (error) {
        await updateRecordingSession({ status: "interrupted" });
        updateProgress(
          "warning",
          0,
          error instanceof Error
            ? error.message
            : "Could not deliver recording files.",
        );
        resolve(false);
      } finally {
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };
    worker.postMessage({ type: "finalize", sessionId: session.id });
  });
}

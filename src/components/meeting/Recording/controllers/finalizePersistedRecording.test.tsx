import { deliverRecordingExports } from "../recordingExport";
import {
  flushRecordingWrites,
  updateRecordingSession,
} from "../recordingStorage";
import { createWebCodecsRecordingWorker } from "../webCodecsRecording";
import { finalizePersistedRecording } from "./finalizePersistedRecording";

jest.mock("../recordingExport", () => ({
  deliverRecordingExports: jest.fn(),
}));
jest.mock("../recordingStorage", () => ({
  clearSavedRecording: jest.fn(),
  flushRecordingWrites: jest.fn(),
  updateRecordingSession: jest.fn(),
}));
jest.mock("../webCodecsRecording", () => ({
  createWebCodecsRecordingWorker: jest.fn(),
}));

function createWorker() {
  return {
    postMessage: jest.fn(),
    terminate: jest.fn(),
  };
}

beforeEach(() => {
  flushRecordingWrites.mockResolvedValue(undefined);
  updateRecordingSession.mockResolvedValue(undefined);
  deliverRecordingExports.mockResolvedValue(undefined);
});

describe("finalizePersistedRecording", () => {
  it("resolves as recoverable failure when the export worker crashes", async () => {
    const worker = createWorker();
    createWebCodecsRecordingWorker.mockReturnValue(worker);
    const workerRef = { current: null };

    const result = finalizePersistedRecording({
      exportDirectoryRef: { current: null },
      recordingSessionRef: { current: { id: "recording-1" } },
      sessionName: "Meeting",
      updateProgress: jest.fn(),
      workerRef,
    });
    await Promise.resolve();
    worker.onerror({ message: "Worker crashed" });

    await expect(result).resolves.toBe(false);
    expect(updateRecordingSession).toHaveBeenCalledWith({
      status: "interrupted",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(workerRef.current).toBeNull();
  });

  it("does not terminate a replacement worker during late cleanup", async () => {
    const worker = createWorker();
    const replacement = createWorker();
    createWebCodecsRecordingWorker.mockReturnValue(worker);
    const workerRef = { current: null };
    const result = finalizePersistedRecording({
      exportDirectoryRef: { current: null },
      recordingSessionRef: { current: { id: "recording-1" } },
      sessionName: "Meeting",
      updateProgress: jest.fn(),
      workerRef,
    });
    await Promise.resolve();
    workerRef.current = replacement;
    worker.onerror({ message: "Worker crashed" });

    await expect(result).resolves.toBe(false);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(replacement.terminate).not.toHaveBeenCalled();
    expect(workerRef.current).toBe(replacement);
  });
});

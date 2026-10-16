import {
  isRecordingWorkerResponse,
  parseRecordingWorkerCommand,
} from "./recordingWorkerProtocol";

describe("recording worker protocol", () => {
  it("accepts the existing control and finalize commands", () => {
    expect(parseRecordingWorkerCommand({ type: "pause" })).toEqual({
      type: "pause",
    });
    expect(
      parseRecordingWorkerCommand({ type: "finalize", sessionId: "session-1" }),
    ).toEqual({ type: "finalize", sessionId: "session-1" });
  });

  it("rejects malformed commands at the worker boundary", () => {
    expect(parseRecordingWorkerCommand({ type: "finalize" })).toBeNull();
    expect(
      parseRecordingWorkerCommand({ type: "export", sessionId: "s" }),
    ).toBeNull();
    expect(parseRecordingWorkerCommand({ type: "unknown" })).toBeNull();
  });

  it("validates worker responses without changing their message shape", () => {
    expect(
      isRecordingWorkerResponse({
        type: "complete",
        capture: true,
        files: [
          { stream: "video", path: "exports/video.mp4" },
          { stream: "audio", path: "exports/audio.m4a" },
        ],
      }),
    ).toBe(true);
    expect(
      isRecordingWorkerResponse({ type: "progress", phase: "encoding" }),
    ).toBe(true);
    expect(
      isRecordingWorkerResponse({
        type: "cancelled",
        capture: true,
        files: [
          { stream: "video", path: "exports/video.mp4" },
          { stream: "audio", path: "exports/audio.m4a" },
        ],
      }),
    ).toBe(true);
    expect(
      isRecordingWorkerResponse({
        type: "complete",
        files: [{ stream: "document", path: "output" }],
      }),
    ).toBe(false);
    expect(
      isRecordingWorkerResponse({
        type: "cancelled",
        capture: true,
        files: [{ stream: "document", path: "output" }],
      }),
    ).toBe(false);
  });
});

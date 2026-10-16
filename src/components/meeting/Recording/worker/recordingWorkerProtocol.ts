export type RecordingStream = "audio" | "video";

export interface RecordingExportFile {
  stream: RecordingStream;
  path: string;
  storage?: "opfs" | "indexeddb";
  chunks?: number;
}

export type RecordingWorkerCommand =
  | { type: "cancel" }
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "finalize"; sessionId: string }
  | {
      type: "export";
      sessionId: string;
      videoReadable: ReadableStream<VideoFrame>;
      audioReadable: ReadableStream<AudioData>;
      width: number;
      height: number;
      sampleRate: number;
      channels: number;
      segmentId?: number;
    };

export type RecordingWorkerResponse =
  | { type: "paused" }
  | { type: "resumed" }
  | {
      type: "cancelled";
      capture?: boolean;
      files?: RecordingExportFile[];
    }
  | {
      type: "progress";
      phase: string;
      stream?: RecordingStream;
      completed?: number;
      total?: number;
      frames?: number;
    }
  | {
      type: "failed";
      capture?: boolean;
      error?: string;
    }
  | {
      type: "complete";
      capture?: boolean;
      files: RecordingExportFile[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isReadableStream(value: unknown): value is ReadableStream<unknown> {
  return isRecord(value) && typeof value.getReader === "function";
}

export function parseRecordingWorkerCommand(
  value: unknown,
): RecordingWorkerCommand | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  switch (value.type) {
    case "cancel":
    case "stop":
    case "pause":
    case "resume":
      return { type: value.type };
    case "finalize":
      return typeof value.sessionId === "string" && value.sessionId
        ? { type: "finalize", sessionId: value.sessionId }
        : null;
    case "export":
      if (
        typeof value.sessionId !== "string" ||
        !value.sessionId ||
        !isReadableStream(value.videoReadable) ||
        !isReadableStream(value.audioReadable) ||
        typeof value.width !== "number" ||
        typeof value.height !== "number" ||
        typeof value.sampleRate !== "number" ||
        typeof value.channels !== "number" ||
        (value.segmentId !== undefined && typeof value.segmentId !== "number")
      ) {
        return null;
      }
      return value as RecordingWorkerCommand;
    default:
      return null;
  }
}

function isRecordingExportFile(value: unknown): value is RecordingExportFile {
  if (!isRecord(value)) return false;
  return (
    (value.stream === "audio" || value.stream === "video") &&
    typeof value.path === "string" &&
    (value.storage === undefined ||
      value.storage === "opfs" ||
      value.storage === "indexeddb") &&
    (value.chunks === undefined || typeof value.chunks === "number")
  );
}

export function isRecordingWorkerResponse(
  value: unknown,
): value is RecordingWorkerResponse {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "paused":
    case "resumed":
      return true;
    case "cancelled":
      return (
        (value.capture === undefined || typeof value.capture === "boolean") &&
        (value.files === undefined ||
          (Array.isArray(value.files) &&
            value.files.every(isRecordingExportFile)))
      );
    case "progress":
      return (
        typeof value.phase === "string" &&
        (value.stream === undefined ||
          value.stream === "audio" ||
          value.stream === "video") &&
        (value.completed === undefined ||
          typeof value.completed === "number") &&
        (value.total === undefined || typeof value.total === "number") &&
        (value.frames === undefined || typeof value.frames === "number")
      );
    case "failed":
      return (
        (value.capture === undefined || typeof value.capture === "boolean") &&
        (value.error === undefined || typeof value.error === "string")
      );
    case "complete":
      return (
        (value.capture === undefined || typeof value.capture === "boolean") &&
        Array.isArray(value.files) &&
        value.files.every(isRecordingExportFile)
      );
    default:
      return false;
  }
}

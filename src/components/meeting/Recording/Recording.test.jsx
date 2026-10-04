import { act, renderHook } from "@testing-library/react";

HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  fillRect: jest.fn(),
  fillStyle: "",
}));

HTMLCanvasElement.prototype.captureStream = jest.fn(() => ({
  getVideoTracks: () => [
    {
      id: "canvas-video-track",
      kind: "video",
      readyState: "live",
      enabled: true,
      clone() {
        return this;
      },
    },
  ],
}));

const mockAudioDestination = {
  stream: {
    getAudioTracks: () => [
      {
        id: "mixer-audio-track",
        kind: "audio",
        readyState: "live",
        enabled: true,
        clone() {
          return this;
        },
      },
    ],
  },
};
const mockAudioSource = {
  connect: jest.fn(),
  disconnect: jest.fn(),
};

class MockAudioContext {
  constructor() {
    this.state = "running";
    this.createMediaStreamDestination = () => mockAudioDestination;
    this.createMediaStreamSource = () => mockAudioSource;
  }
  close() {
    return Promise.resolve();
  }
}
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;

import {
  clearSavedRecording,
  createRecordingSession,
  getRecordingStorageEstimate,
  getRecordingStoragePreflight,
  loadSavedRecording,
} from "@/components/meeting/Recording/recordingStorage";
import { finalizePersistedRecording } from "./controllers/finalizePersistedRecording";
import {
  CanvasVideoRenderer,
  getRecordingMediaSignature,
  Recording,
  RecordingAudioMixer,
} from "./Recording";
import {
  createWebCodecsRecordingWorker,
  supportsWebCodecsRecording,
} from "./webCodecsRecording";

jest.mock("./controllers/finalizePersistedRecording", () => ({
  finalizePersistedRecording: jest.fn().mockResolvedValue(true),
}));
jest.mock("./webCodecsRecording", () => ({
  supportsWebCodecsRecording: jest.fn(() => false),
  supportsWebCodecsRecordingCodecs: jest.fn().mockResolvedValue(true),
  createWebCodecsRecordingWorker: jest.fn(),
}));

jest.spyOn(CanvasVideoRenderer.prototype, "setTrack");
jest.spyOn(RecordingAudioMixer.prototype, "updateTracks");

jest.mock("@/components/meeting/Recording/recordingStorage", () => ({
  closeActiveRecordingSegment: jest.fn().mockResolvedValue(undefined),
  clearSavedRecording: jest.fn().mockResolvedValue(undefined),
  createRecordingSession: jest.fn().mockResolvedValue({
    id: "session-1",
    sessionName: "Test Session",
    tracks: {
      video: { stream: "video", chunkCount: 0 },
      audio: { stream: "audio", chunkCount: 0 },
    },
  }),
  flushRecordingWrites: jest.fn().mockResolvedValue(undefined),
  getRecordingStorageEstimate: jest.fn().mockResolvedValue(null),
  getRecordingStoragePreflight: jest.fn().mockResolvedValue({ allowed: true }),
  loadSavedRecording: jest.fn().mockResolvedValue(null),
  saveRecordingFragment: jest.fn().mockResolvedValue(undefined),
  updateRecordingSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/components/meeting/Recording/recordingExport", () => ({
  deliverRecordingExports: jest.fn().mockResolvedValue(undefined),
  chooseRecordingDirectory: jest.fn().mockResolvedValue({}),
  hasDirectFileExport: jest.fn(() => true),
}));

jest.mock("@/lib/webrtc/outboundMedia", () => ({
  pickOutboundVideoTrack: jest.fn(),
  resolveOutboundAudioTrack: jest.fn(),
}));

import {
  pickOutboundVideoTrack,
  resolveOutboundAudioTrack,
} from "@/lib/webrtc/outboundMedia";

function createTrack({
  kind,
  id = `${kind}-track`,
  enabled = true,
  readyState = "live",
} = {}) {
  return {
    id,
    kind,
    enabled,
    readyState,
    stop: jest.fn(),
  };
}

function createStream(tracks = [], emitTrackEvents = true) {
  const streamTracks = [...tracks];
  const listeners = new Map();

  const emit = (type) => {
    if (!emitTrackEvents) return;
    for (const handler of listeners.get(type) ?? []) {
      handler();
    }
  };

  return {
    id: `stream-${streamTracks.map((track) => track.id).join("-") || "empty"}`,
    getTracks: () => [...streamTracks],
    getAudioTracks: () =>
      streamTracks.filter((track) => track.kind === "audio"),
    getVideoTracks: () =>
      streamTracks.filter((track) => track.kind === "video"),
    addTrack: jest.fn((track) => {
      streamTracks.push(track);
      emit("addtrack");
    }),
    removeTrack: jest.fn((track) => {
      const index = streamTracks.indexOf(track);
      if (index >= 0) streamTracks.splice(index, 1);
      emit("removetrack");
    }),
    addEventListener: jest.fn((type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    }),
    removeEventListener: jest.fn((type, handler) => {
      listeners.get(type)?.delete(handler);
    }),
  };
}

function createMediaRecorderMock() {
  const instances = [];

  class MockMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.state = "inactive";
      this.ondataavailable = null;
      this.onstop = null;
      instances.push(this);
    }

    start() {
      this.state = "recording";
    }

    pause() {
      this.state = "paused";
    }

    resume() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.onstop?.();
    }
  }

  MockMediaRecorder.isTypeSupported = jest.fn(() => true);
  global.MediaRecorder = MockMediaRecorder;
  global.MediaStream = class MediaStream {
    constructor(tracks = []) {
      this._tracks = tracks;
    }

    getTracks() {
      return this._tracks;
    }

    addTrack(track) {
      this._tracks.push(track);
    }

    removeTrack(track) {
      this._tracks = this._tracks.filter((entry) => entry !== track);
    }
  };

  return instances;
}

function renderRecording({
  localStream = createStream([createTrack({ kind: "video", id: "camera" })]),
  screenStream = null,
  isRecording = false,
  ...overrides
} = {}) {
  const setIsRecording = jest.fn();
  const setIsRecordingPaused = jest.fn();
  const resetRecordingTimer = jest.fn();
  const send = jest.fn();

  const props = {
    isHost: true,
    roomConnection: { send },
    localStream,
    screenStream,
    videoParticipants: [],
    focusedParticipantId: "host",
    resetRecordingTimer,
    isRecording,
    setIsRecording,
    isRecordingPaused: false,
    setIsRecordingPaused,
    sessionName: "Test Session",
    ...overrides,
  };

  const view = renderHook((nextProps) => Recording(nextProps), {
    initialProps: props,
  });

  return {
    ...view,
    props,
    setIsRecording,
    setIsRecordingPaused,
    resetRecordingTimer,
    send,
  };
}

describe("getRecordingMediaSignature", () => {
  it("tracks host camera and screen-share sources", () => {
    const camera = createTrack({ kind: "video", id: "camera" });
    const mic = createTrack({ kind: "audio", id: "mic" });
    const localStream = createStream([camera, mic]);

    const before = getRecordingMediaSignature({
      focusedParticipantId: "host",
      videoParticipants: [],
      localStream,
      screenStream: null,
    });

    const screenVideo = createTrack({ kind: "video", id: "screen" });
    const screenAudio = createTrack({ kind: "audio", id: "tab-audio" });
    const screenStream = createStream([screenVideo, screenAudio]);

    const after = getRecordingMediaSignature({
      focusedParticipantId: "host",
      videoParticipants: [],
      localStream,
      screenStream,
    });

    expect(before).not.toBe(after);
    expect(after).toContain("screen");
    expect(after).toContain("tab-audio");
  });
});

describe("CanvasVideoRenderer", () => {
  it("letterboxes the source on a stable recording canvas", () => {
    const renderer = new CanvasVideoRenderer();
    Object.defineProperties(renderer.videoElement, {
      videoWidth: { value: 1440 },
      videoHeight: { value: 1080 },
    });

    const rect = renderer.getDrawRect();

    expect(renderer.canvas.width).toBe(1280);
    expect(renderer.canvas.height).toBe(720);
    expect(rect).toEqual({ x: 160, y: 0, width: 960, height: 720 });
  });
});

describe("Recording", () => {
  let recorderInstances;

  beforeEach(() => {
    jest.clearAllMocks();
    supportsWebCodecsRecording.mockReturnValue(false);
    finalizePersistedRecording.mockResolvedValue(true);
    jest.useFakeTimers();
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: jest.fn().mockResolvedValue({}),
    });
    recorderInstances = createMediaRecorderMock();
    pickOutboundVideoTrack.mockImplementation((local, screen) => {
      const screenTrack = screen?.getVideoTracks()[0] ?? null;
      if (screenTrack?.readyState === "live") return screenTrack;
      return local?.getVideoTracks()[0] ?? null;
    });
    resolveOutboundAudioTrack.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("serializes initialization and releases the lock after failure", async () => {
    let rejectPreflight;
    getRecordingStoragePreflight.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectPreflight = reject;
      }),
    );
    const { result } = renderRecording();
    let starting;
    act(() => {
      starting = result.current.startRecording();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRecordingBusy).toBe(true);
    expect(result.current.startRecording()).toBe(starting);
    expect(clearSavedRecording).not.toHaveBeenCalled();
    await act(async () => {
      rejectPreflight(new Error("Storage unavailable"));
      await starting;
    });
    expect(result.current.isRecordingBusy).toBe(false);
    await act(async () => {
      await result.current.startRecording();
    });
    expect(createRecordingSession).toHaveBeenCalledTimes(1);
  });

  it("blocks new starts and discards until export finishes", async () => {
    let finishExport;
    finalizePersistedRecording.mockReturnValueOnce(
      new Promise((resolve) => {
        finishExport = resolve;
      }),
    );
    const { result } = renderRecording();
    await act(async () => {
      await result.current.startRecording();
    });
    let saving;
    act(() => {
      saving = result.current.stopRecordingAsync();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isRecordingBusy).toBe(true);
    expect(result.current.startRecording()).toBe(saving);
    expect(result.current.discardSavedRecording()).toBe(saving);
    expect(result.current.stopRecordingAsync()).toBe(saving);
    expect(clearSavedRecording).toHaveBeenCalledTimes(1);
    expect(createRecordingSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishExport(true);
      await saving;
    });
    expect(result.current.isRecordingBusy).toBe(false);
    await act(async () => {
      await result.current.startRecording();
    });
    expect(createRecordingSession).toHaveBeenCalledTimes(2);
  });

  it("recreates video and audio capture after stopping a WebCodecs recording", async () => {
    supportsWebCodecsRecording.mockReturnValue(true);
    const worker = { postMessage: jest.fn(), terminate: jest.fn() };
    createWebCodecsRecordingWorker.mockReturnValue(worker);
    const originalProcessor = global.MediaStreamTrackProcessor;
    global.MediaStreamTrackProcessor = class {
      readable = {};
    };
    const startSpy = jest.spyOn(CanvasVideoRenderer.prototype, "start");
    const closeSpy = jest.spyOn(MockAudioContext.prototype, "close");
    const { result } = renderRecording();
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      let saving;
      act(() => {
        result.current.stopRecording();
        saving = result.current.stopRecordingAsync();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await worker.onmessage({
          data: { type: "complete", capture: true, files: [] },
        });
        await worker.onmessage({ data: { type: "complete", files: [] } });
        await saving;
      });
      expect(closeSpy).toHaveBeenCalledTimes(1);
      await act(async () => {
        await result.current.startRecording();
      });
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(recorderInstances).toHaveLength(4);
    } finally {
      global.MediaStreamTrackProcessor = originalProcessor;
      startSpy.mockRestore();
      closeSpy.mockRestore();
    }
  });

  it("updates local recording tracks after an in-place device replacement", async () => {
    const camera = createTrack({ kind: "video", id: "old-camera" });
    const mic = createTrack({ kind: "audio", id: "old-mic" });
    const stream = createStream([camera, mic], false);
    const props = {
      isHost: true,
      localStream: stream,
      screenStream: null,
      videoParticipants: [],
      focusedParticipantId: "host",
      isRecording: true,
      setIsRecording: jest.fn(),
      setIsRecordingPaused: jest.fn(),
      resetRecordingTimer: jest.fn(),
      roomConnection: { send: jest.fn() },
    };
    const { result, rerender } = renderHook((next) => Recording(next), {
      initialProps: props,
    });
    await act(async () => {
      await result.current.startRecording();
    });
    const replacementCamera = createTrack({ kind: "video", id: "new-camera" });
    const replacementMic = createTrack({ kind: "audio", id: "new-mic" });
    // Scripted MediaStream mutations do not emit browser track events.
    act(() => {
      stream.removeTrack(camera);
      stream.removeTrack(mic);
      stream.addTrack(replacementCamera);
      stream.addTrack(replacementMic);
      rerender({ ...props, localTrackRevision: 1 });
    });
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenLastCalledWith(
      replacementCamera,
    );
    expect(RecordingAudioMixer.prototype.updateTracks).toHaveBeenLastCalledWith(
      [replacementMic],
    );
  });

  it("clears a recovered session before creating the next manifest", async () => {
    const { result } = renderRecording();

    await act(async () => {
      await result.current.startRecording();
    });

    expect(clearSavedRecording).toHaveBeenCalledTimes(1);
    expect(createRecordingSession).toHaveBeenCalledTimes(1);
    expect(clearSavedRecording.mock.invocationCallOrder[0]).toBeLessThan(
      createRecordingSession.mock.invocationCallOrder[0],
    );
  });

  it("does not start when local storage cannot satisfy the safety reserve", async () => {
    getRecordingStoragePreflight.mockResolvedValueOnce({ allowed: false });
    const { result } = renderRecording();

    await act(async () => {
      await result.current.startRecording();
    });

    expect(createRecordingSession).not.toHaveBeenCalled();
    expect(result.current.downloadState).toMatchObject({ phase: "warning" });
  });

  it("safely stops both recorders when persisted storage becomes critical", async () => {
    getRecordingStorageEstimate.mockResolvedValueOnce({
      quota: 200 * 1024 * 1024,
      usage: 100 * 1024 * 1024,
    });
    const { result, setIsRecording } = renderRecording();

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      recorderInstances[0].ondataavailable({
        data: new Blob(["video"], { type: "video/webm" }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      recorderInstances.every((recorder) => recorder.state === "inactive"),
    ).toBe(true);
    expect(setIsRecording).toHaveBeenCalledWith(false);
    expect(result.current.downloadState).toMatchObject({ phase: "preparing" });
  });

  it("disables recovery resume when the host cannot capture video", async () => {
    loadSavedRecording.mockResolvedValueOnce({
      meta: {
        tracks: {
          video: { chunkCount: 1 },
          audio: { chunkCount: 1 },
        },
      },
    });
    const { result } = renderRecording({ localStream: createStream() });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.savedRecording).not.toBeNull();
    expect(result.current.canResumeSavedRecording).toBe(false);
    await act(async () => {
      await result.current.resumeSavedRecording();
    });
    expect(result.current.downloadState).toMatchObject({ phase: "warning" });
  });

  it("updates the canvas track when screen sharing starts during recording", async () => {
    const cameraTrack = createTrack({ kind: "video", id: "camera" });
    const localStream = createStream([cameraTrack]);

    const { result, rerender, props } = renderRecording({
      localStream,
      screenStream: null,
      isRecording: true,
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(recorderInstances).toHaveLength(2);
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenCalledWith(
      cameraTrack,
    );

    const screenTrack = createTrack({ kind: "video", id: "screen" });
    const screenStream = createStream([screenTrack]);

    act(() => {
      rerender({ ...props, screenStream });
    });

    expect(recorderInstances).toHaveLength(2);
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenLastCalledWith(
      screenTrack,
    );
  });

  it("updates the canvas track when screen sharing stops during recording", async () => {
    const cameraTrack = createTrack({ kind: "video", id: "camera" });
    const screenTrack = createTrack({ kind: "video", id: "screen" });
    const localStream = createStream([cameraTrack]);
    const screenStream = createStream([screenTrack]);

    const { result, rerender, props } = renderRecording({
      localStream,
      screenStream,
      isRecording: true,
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenCalledWith(
      screenTrack,
    );

    act(() => {
      rerender({ ...props, screenStream: null });
    });

    expect(recorderInstances).toHaveLength(2);
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenLastCalledWith(
      cameraTrack,
    );
  });

  it("updates the canvas track when a focused remote participant's tracks change", async () => {
    const cameraTrack = createTrack({ kind: "video", id: "remote-camera" });
    const remoteStream = createStream([cameraTrack]);
    const videoParticipants = [
      {
        id: "p1",
        name: "Pat One",
        stream: remoteStream,
      },
    ];

    const { result } = renderRecording({
      localStream: createStream([]),
      screenStream: null,
      videoParticipants,
      focusedParticipantId: "p1",
      isRecording: true,
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenCalledWith(
      cameraTrack,
    );

    const screenTrack = createTrack({ kind: "video", id: "remote-screen" });

    act(() => {
      remoteStream.removeTrack(cameraTrack);
      remoteStream.addTrack(screenTrack);
    });

    expect(recorderInstances).toHaveLength(2);
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenLastCalledWith(
      screenTrack,
    );
  });
});

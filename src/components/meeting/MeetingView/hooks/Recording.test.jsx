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
  CanvasVideoRenderer,
  getRecordingMediaSignature,
  Recording,
  RecordingAudioMixer,
} from "./Recording";

jest.spyOn(CanvasVideoRenderer.prototype, "setTrack");
jest.spyOn(RecordingAudioMixer.prototype, "updateTracks");

jest.mock("@/lib/recordingStorage", () => ({
  clearSavedRecording: jest.fn().mockResolvedValue(undefined),
  loadSavedRecording: jest.fn().mockResolvedValue(null),
  saveRecordingChunk: jest.fn().mockResolvedValue(undefined),
  saveRecordingMeta: jest.fn().mockResolvedValue(undefined),
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

function createStream(tracks = []) {
  const streamTracks = [...tracks];
  const listeners = new Map();

  const emit = (type) => {
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
  it("keeps the source aspect ratio when sizing the recording canvas", () => {
    const renderer = new CanvasVideoRenderer();
    Object.defineProperties(renderer.videoElement, {
      videoWidth: { value: 1440 },
      videoHeight: { value: 1080 },
    });

    renderer.resizeToSource();

    expect(renderer.canvas.width).toBe(1440);
    expect(renderer.canvas.height).toBe(1080);
  });
});

describe("Recording", () => {
  let recorderInstances;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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

  it("updates the canvas track when screen sharing starts during recording", async () => {
    const cameraTrack = createTrack({ kind: "video", id: "camera" });
    const localStream = createStream([cameraTrack]);

    const { result, rerender } = renderRecording({
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
      rerender({
        isHost: true,
        roomConnection: { send: jest.fn() },
        localStream,
        screenStream,
        videoParticipants: [],
        focusedParticipantId: "host",
        resetRecordingTimer: jest.fn(),
        isRecording: true,
        setIsRecording: jest.fn(),
        isRecordingPaused: false,
        setIsRecordingPaused: jest.fn(),
        sessionName: "Test Session",
      });
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

    const { result, rerender } = renderRecording({
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
      rerender({
        isHost: true,
        roomConnection: { send: jest.fn() },
        localStream,
        screenStream: null,
        videoParticipants: [],
        focusedParticipantId: "host",
        resetRecordingTimer: jest.fn(),
        isRecording: true,
        setIsRecording: jest.fn(),
        isRecordingPaused: false,
        setIsRecordingPaused: jest.fn(),
        sessionName: "Test Session",
      });
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

    const { result, rerender } = renderRecording({
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
      rerender({
        isHost: true,
        roomConnection: { send: jest.fn() },
        localStream: createStream([]),
        screenStream: null,
        videoParticipants,
        focusedParticipantId: "p1",
        resetRecordingTimer: jest.fn(),
        isRecording: true,
        setIsRecording: jest.fn(),
        isRecordingPaused: false,
        setIsRecordingPaused: jest.fn(),
        sessionName: "Test Session",
      });
    });

    expect(recorderInstances).toHaveLength(2);
    expect(CanvasVideoRenderer.prototype.setTrack).toHaveBeenLastCalledWith(
      screenTrack,
    );
  });
});

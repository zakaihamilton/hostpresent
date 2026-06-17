import { act, renderHook, waitFor } from "@testing-library/react";
import { MediaControls } from "./MediaControls";

function createTrack({
  kind,
  deviceId = "",
  id = `${kind}-${deviceId || "default"}`,
  enabled = true,
} = {}) {
  return {
    id,
    kind,
    enabled,
    readyState: "live",
    onended: null,
    getSettings: jest.fn(() => ({ deviceId })),
    stop: jest.fn(function stop() {
      this.readyState = "ended";
    }),
  };
}

function createStream(tracks = []) {
  const streamTracks = [...tracks];
  return {
    id: `stream-${Math.random().toString(36).slice(2)}`,
    active: true,
    getTracks: jest.fn(() => [...streamTracks]),
    getAudioTracks: jest.fn(() =>
      streamTracks.filter((track) => track.kind === "audio"),
    ),
    getVideoTracks: jest.fn(() =>
      streamTracks.filter((track) => track.kind === "video"),
    ),
    addTrack: jest.fn((track) => {
      streamTracks.push(track);
    }),
    removeTrack: jest.fn((track) => {
      const index = streamTracks.indexOf(track);
      if (index >= 0) streamTracks.splice(index, 1);
    }),
  };
}

describe("MediaControls Hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getDisplayMedia: jest.fn().mockResolvedValue({
          getVideoTracks: () => [],
          getAudioTracks: () => [],
          getTracks: () => [],
        }),
        getUserMedia: jest.fn().mockResolvedValue({
          getVideoTracks: () => [
            {
              getSettings: () => ({ deviceId: "" }),
              stop: jest.fn(),
              enabled: true,
            },
          ],
          getAudioTracks: () => [
            {
              getSettings: () => ({ deviceId: "" }),
              stop: jest.fn(),
              enabled: true,
            },
          ],
          getTracks: () => [],
          addTrack: jest.fn(),
          removeTrack: jest.fn(),
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  it("loads default media states (unmuted)", () => {
    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: { send: jest.fn() },
        streamListenerCleanupsRef: { current: [] },
        localStream: null,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.isVideoMuted).toBe(false);
  });

  it("requests microphone capture with voice isolation constraints", async () => {
    renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: { send: jest.fn() },
        streamListenerCleanupsRef: { current: [] },
        localStream: null,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: true,
        },
      });
    });
  });

  it("loads media states from localStorage if set to true", () => {
    window.localStorage.setItem("hostpresent.audioMuted", "true");
    window.localStorage.setItem("hostpresent.videoMuted", "true");

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: { send: jest.fn() },
        streamListenerCleanupsRef: { current: [] },
        localStream: null,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.isVideoMuted).toBe(true);
  });

  it("saves media states to localStorage on toggle", () => {
    const sendMock = jest.fn();
    const syncOutboundMedia = jest.fn();
    const mockAudioTrack = { enabled: true, stop: jest.fn() };
    const mockVideoTrack = { enabled: true, stop: jest.fn() };
    const mockStream = {
      getAudioTracks: () => [mockAudioTrack],
      getVideoTracks: () => [mockVideoTrack],
      getTracks: () => [mockAudioTrack, mockVideoTrack],
    };

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send: sendMock,
          localParticipantId: "p1",
          syncOutboundMedia,
        },
        streamListenerCleanupsRef: { current: [] },
        localStream: mockStream,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleAudio();
    });
    expect(result.current.isAudioMuted).toBe(true);
    expect(window.localStorage.getItem("hostpresent.audioMuted")).toBe("true");
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.toggleVideo();
    });
    expect(result.current.isVideoMuted).toBe(true);
    expect(window.localStorage.getItem("hostpresent.videoMuted")).toBe("true");
    expect(syncOutboundMedia).toHaveBeenCalledTimes(2);
  });

  it("switches camera by replacing the old video track and syncing outbound media", async () => {
    const oldVideoTrack = createTrack({
      kind: "video",
      deviceId: "front-camera-id",
      id: "front-camera-track",
    });
    const audioTrack = createTrack({ kind: "audio", deviceId: "mic-id" });
    const localStream = createStream([oldVideoTrack, audioTrack]);
    const newVideoTrack = createTrack({
      kind: "video",
      deviceId: "back-camera-id",
      id: "back-camera-track",
    });
    const newVideoStream = createStream([newVideoTrack]);
    const syncOutboundMedia = jest.fn();

    navigator.mediaDevices.getUserMedia
      .mockResolvedValueOnce(localStream)
      .mockResolvedValueOnce(newVideoStream);
    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      {
        kind: "videoinput",
        deviceId: "front-camera-id",
        label: "Front Camera",
      },
      {
        kind: "videoinput",
        deviceId: "back-camera-id",
        label: "Back Camera",
      },
      { kind: "audioinput", deviceId: "mic-id", label: "Microphone" },
    ]);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: true,
        roomConnection: { send: jest.fn(), syncOutboundMedia },
        localStream,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedCamera).toBe("front-camera-id");
    });

    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(newVideoStream);
    await result.current.switchCamera("back-camera-id");

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: "back-camera-id" } },
      audio: false,
    });
    expect(localStream.removeTrack).toHaveBeenCalledWith(oldVideoTrack);
    expect(oldVideoTrack.stop).toHaveBeenCalled();
    expect(localStream.addTrack).toHaveBeenCalledWith(newVideoTrack);
    expect(newVideoTrack.enabled).toBe(true);
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
  });

  it("switches microphone by replacing the old audio track and preserving muted state", async () => {
    window.localStorage.setItem("hostpresent.audioMuted", "true");
    const oldAudioTrack = createTrack({
      kind: "audio",
      deviceId: "builtin-mic-id",
      id: "builtin-mic-track",
      enabled: false,
    });
    const videoTrack = createTrack({ kind: "video", deviceId: "camera-id" });
    const localStream = createStream([oldAudioTrack, videoTrack]);
    const newAudioTrack = createTrack({
      kind: "audio",
      deviceId: "external-mic-id",
      id: "external-mic-track",
    });
    const newAudioStream = createStream([newAudioTrack]);
    const syncOutboundMedia = jest.fn();

    navigator.mediaDevices.getUserMedia
      .mockResolvedValueOnce(localStream)
      .mockResolvedValueOnce(newAudioStream);
    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      { kind: "videoinput", deviceId: "camera-id", label: "Camera" },
      {
        kind: "audioinput",
        deviceId: "builtin-mic-id",
        label: "Built-in Mic",
      },
      {
        kind: "audioinput",
        deviceId: "external-mic-id",
        label: "External Mic",
      },
    ]);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send: jest.fn(),
          localParticipantId: "p1",
          syncOutboundMedia,
        },
        localStream,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedMicrophone).toBe("builtin-mic-id");
    });

    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(newAudioStream);
    await result.current.switchMicrophone("external-mic-id");

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      audio: {
        deviceId: { exact: "external-mic-id" },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: true,
      },
      video: false,
    });
    expect(localStream.removeTrack).toHaveBeenCalledWith(oldAudioTrack);
    expect(oldAudioTrack.stop).toHaveBeenCalled();
    expect(localStream.addTrack).toHaveBeenCalledWith(newAudioTrack);
    expect(newAudioTrack.enabled).toBe(false);
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
  });

  it("starts and stops participant screen sharing with status messages and outbound sync", async () => {
    const screenTrack = createTrack({ kind: "video", id: "screen-track" });
    const screenStream = createStream([
      screenTrack,
      createTrack({ kind: "audio", id: "screen-audio-track" }),
    ]);
    const setScreenStream = jest.fn();
    const send = jest.fn();
    const syncOutboundMedia = jest.fn();

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const props = {
      isHost: false,
      roomConnection: {
        send,
        localParticipantId: "p1",
        syncOutboundMedia,
      },
      localStream: createStream([
        createTrack({ kind: "audio" }),
        createTrack({ kind: "video" }),
      ]),
      setLocalStream: jest.fn(),
      screenStream: null,
      setScreenStream,
    };

    const { result, rerender } = renderHook(
      (nextProps) => MediaControls(nextProps),
      { initialProps: props },
    );

    await result.current.toggleScreenShare();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: {
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    expect(setScreenStream).toHaveBeenCalledWith(screenStream);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "participant_screen_share_started",
        participantId: "p1",
      }),
    );

    rerender({ ...props, screenStream });

    await result.current.toggleScreenShare();

    expect(screenTrack.stop).toHaveBeenCalledTimes(1);
    expect(setScreenStream).toHaveBeenLastCalledWith(null);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "participant_screen_share_stopped",
        participantId: "p1",
      }),
    );
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
  });

  it("clears screen sharing when the browser ends capture", async () => {
    const screenTrack = createTrack({ kind: "video", id: "screen-track" });
    const screenStream = createStream([
      screenTrack,
      createTrack({ kind: "audio", id: "screen-audio-track" }),
    ]);
    const setScreenStream = jest.fn();
    const send = jest.fn();
    const syncOutboundMedia = jest.fn();

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send,
          localParticipantId: "p1",
          syncOutboundMedia,
        },
        localStream: createStream([]),
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream,
      }),
    );

    await result.current.toggleScreenShare();

    act(() => {
      screenTrack.onended();
    });

    expect(setScreenStream).toHaveBeenLastCalledWith(null);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "participant_screen_share_stopped",
        participantId: "p1",
      }),
    );
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
  });

  it("does not publish participant screen-share status for the host", async () => {
    const screenStream = createStream([
      createTrack({ kind: "video", id: "screen-track" }),
      createTrack({ kind: "audio", id: "screen-audio-track" }),
    ]);
    const setScreenStream = jest.fn();
    const send = jest.fn();

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: true,
        roomConnection: {
          send,
          localParticipantId: "host",
          syncOutboundMedia: jest.fn(),
        },
        localStream: createStream([]),
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream,
      }),
    );

    await result.current.toggleScreenShare();

    expect(setScreenStream).toHaveBeenCalledWith(screenStream);
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "participant_screen_share_started" }),
    );
  });

  it("requests screen sharing without audio when screen audio is disabled", async () => {
    const screenStream = createStream([
      createTrack({ kind: "video", id: "screen-track" }),
    ]);

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send: jest.fn(),
          localParticipantId: "p1",
          syncOutboundMedia: jest.fn(),
        },
        localStream: createStream([]),
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    act(() => {
      result.current.setShareScreenAudioPreference(false);
    });

    await result.current.toggleScreenShare();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    });
    expect(result.current.errorMsg).toBe("");
  });

  it("reports a warning when requested screen audio is missing", async () => {
    const screenStream = createStream([
      createTrack({ kind: "video", id: "screen-track" }),
    ]);

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send: jest.fn(),
          localParticipantId: "p1",
          syncOutboundMedia: jest.fn(),
        },
        localStream: createStream([]),
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await result.current.toggleScreenShare();

    await waitFor(() => {
      expect(result.current.errorMsg).toContain(
        "[E043] Screen shared without audio.",
      );
    });
  });

  it("reports cancellation when screen sharing is denied", async () => {
    navigator.mediaDevices.getDisplayMedia = jest.fn().mockRejectedValue(
      Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError",
      }),
    );

    const setScreenStream = jest.fn();
    const send = jest.fn();
    const syncOutboundMedia = jest.fn();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() =>
      MediaControls({
        isHost: false,
        roomConnection: {
          send,
          localParticipantId: "p1",
          syncOutboundMedia,
        },
        localStream: createStream([]),
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream,
      }),
    );

    await result.current.toggleScreenShare();

    await waitFor(() => {
      expect(result.current.errorMsg).toContain(
        "[E042] Screen sharing was cancelled or denied.",
      );
    });
    expect(setScreenStream).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "participant_screen_share_started" }),
    );
    expect(syncOutboundMedia).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

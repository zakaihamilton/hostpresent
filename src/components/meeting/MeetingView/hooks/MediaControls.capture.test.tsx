import { act, renderHook, waitFor } from "@testing-library/react";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";
import { MediaControls } from "./MediaControls";
import {
  createStream,
  createTrack,
  setupMediaDevicesMock,
} from "./mediaTestUtils";

describe("MediaControls Hook - Capture & State", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    setupMediaDevicesMock();
  });

  it("loads default media states (unmuted)", () => {
    const { result } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
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
        publishingGranted: true,
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
        video: PUBLISHER_VIDEO_CONSTRAINTS,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: true,
        },
      });
    });
  });

  it("does not capture media in listening-only mode and acquires it when enabled", async () => {
    const setLocalStream = jest.fn();
    const roomConnection = {
      send: jest.fn(),
      syncOutboundMedia: jest.fn(),
    };
    const { rerender } = renderHook(
      ({ participantMode }) =>
        MediaControls({
          publishingGranted: true,
          isHost: false,
          participantMode,
          roomConnection,
          localStream: null,
          setLocalStream,
          screenStream: null,
          setScreenStream: jest.fn(),
        }),
      { initialProps: { participantMode: PARTICIPANT_MODE.LISTENING } },
    );

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    rerender({ participantMode: PARTICIPANT_MODE.AVAILABLE });

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: PUBLISHER_VIDEO_CONSTRAINTS,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: true,
        },
      });
    });
  });

  it("replaces the microphone track when voice isolation changes", async () => {
    const oldAudioTrack = createTrack({ kind: "audio", deviceId: "mic-id" });
    const localStream = createStream([
      oldAudioTrack,
      createTrack({ kind: "video" }),
    ]);
    const replacementAudioTrack = createTrack({
      kind: "audio",
      deviceId: "mic-id",
      id: "isolated-mic",
    });
    const replacementStream = createStream([replacementAudioTrack]);
    const syncOutboundMedia = jest.fn();
    const setLocalStream = jest.fn();
    const roomConnection = {
      send: jest.fn(),
      syncOutboundMedia,
    };

    const { result } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
        isHost: false,
        roomConnection,
        localStream,
        setLocalStream,
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(
      replacementStream,
    );

    await act(async () => {
      await result.current.setVoiceIsolation(false);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: false,
        deviceId: { exact: "mic-id" },
      },
      video: false,
    });
    expect(oldAudioTrack.stop).toHaveBeenCalledTimes(1);
    expect(localStream.getAudioTracks()).toEqual([replacementAudioTrack]);
    expect(result.current.isVoiceIsolationEnabled).toBe(false);
    expect(result.current.localTrackRevision).toBe(1);
    expect(window.localStorage.getItem("hostpresent.voiceIsolation")).toBe(
      "false",
    );
    expect(syncOutboundMedia).toHaveBeenCalled();
  });

  it("syncs outbound media when localStream becomes available after join", async () => {
    const syncOutboundMedia = jest.fn();
    const acquired = createStream([
      createTrack({ kind: "audio" }),
      createTrack({ kind: "video" }),
    ]);
    navigator.mediaDevices.getUserMedia.mockResolvedValue(acquired);

    const { rerender } = renderHook(
      ({ localStream }) =>
        MediaControls({
          publishingGranted: true,
          isHost: false,
          roomConnection: {
            send: jest.fn(),
            syncOutboundMedia,
          },
          streamListenerCleanupsRef: { current: [] },
          localStream,
          setLocalStream: jest.fn(),
          screenStream: null,
          setScreenStream: jest.fn(),
        }),
      { initialProps: { localStream: null } },
    );

    expect(syncOutboundMedia).not.toHaveBeenCalled();

    rerender({ localStream: acquired });

    await waitFor(() => {
      expect(syncOutboundMedia).toHaveBeenCalled();
    });
  });

  it("surfaces an error when initial camera/mic permission is denied", async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError",
      }),
    );

    const { result } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
        isHost: false,
        roomConnection: { send: jest.fn(), syncOutboundMedia: jest.fn() },
        streamListenerCleanupsRef: { current: [] },
        localStream: null,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.errorMsg).toContain("E046");
    });
  });

  it("loads media states from localStorage if set to true", () => {
    window.localStorage.setItem("hostpresent.audioMuted", "true");
    window.localStorage.setItem("hostpresent.videoMuted", "true");

    const { result } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
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
        publishingGranted: true,
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
    expect(syncOutboundMedia).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.toggleVideo();
    });
    expect(result.current.isVideoMuted).toBe(true);
    expect(window.localStorage.getItem("hostpresent.videoMuted")).toBe("true");
    expect(syncOutboundMedia).toHaveBeenCalledTimes(3);
  });

  it("does not reacquire local media when mute states change", async () => {
    const localStream = createStream([
      createTrack({ kind: "audio" }),
      createTrack({ kind: "video" }),
    ]);
    navigator.mediaDevices.getUserMedia.mockResolvedValue(localStream);
    const setLocalStream = jest.fn();

    const { result } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
        isHost: false,
        roomConnection: {
          send: jest.fn(),
          localParticipantId: "p1",
          syncOutboundMedia: jest.fn(),
        },
        localStream,
        setLocalStream,
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });
    act(() => result.current.toggleAudio());
    act(() => result.current.toggleVideo());
    await act(async () => Promise.resolve());

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("stops media that resolves after the hook unmounts", async () => {
    let resolveMedia: (stream: ReturnType<typeof createStream>) => void =
      () => {};
    const lateStream = createStream([
      createTrack({ kind: "audio" }),
      createTrack({ kind: "video" }),
    ]);
    navigator.mediaDevices.getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        resolveMedia = resolve;
      }),
    );

    const { unmount } = renderHook(() =>
      MediaControls({
        publishingGranted: true,
        isHost: false,
        roomConnection: { send: jest.fn() },
        localStream: null,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    unmount();
    await act(async () => resolveMedia(lateStream));

    for (const track of lateStream.getTracks()) {
      expect(track.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the status publisher stable when the room connection object refreshes", () => {
    navigator.mediaDevices.getUserMedia.mockClear();
    const send = jest.fn();
    const setLocalStream = jest.fn();
    const setScreenStream = jest.fn();
    const { result, rerender } = renderHook(
      ({ roomConnection }) =>
        MediaControls({
          isHost: false,
          roomConnection,
          localStream: null,
          screenStream: null,
          setLocalStream,
          setScreenStream,
        }),
      {
        initialProps: { roomConnection: { send, localParticipantId: "guest" } },
      },
    );
    const publish = result.current.publishParticipantMediaStatus;
    rerender({
      roomConnection: { send, localParticipantId: "guest", mediaIncoming: 4 },
    });
    expect(result.current.publishParticipantMediaStatus).toBe(publish);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

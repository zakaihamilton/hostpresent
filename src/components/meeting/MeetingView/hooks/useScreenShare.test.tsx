import { act, renderHook, waitFor } from "@testing-library/react";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";
import { MediaControls } from "./MediaControls";
import {
  createStream,
  createTrack,
  setupMediaDevicesMock,
} from "./mediaTestUtils";

function renderScreenShareControls({
  isHost = false,
  send = jest.fn(),
  syncOutboundMedia = jest.fn(),
  setScreenStream = jest.fn(),
  setLocalStream = jest.fn(),
} = {}) {
  const props = {
    publishingGranted: true,
    isHost,
    roomConnection: {
      send,
      syncOutboundMedia,
      localParticipantId: isHost ? "host" : "p1",
    },
    localStream: createStream([]),
    screenStream: null,
    setLocalStream,
    setScreenStream,
  };
  return renderHook(() => MediaControls(props));
}

function renderVideoOnlyScreenShare() {
  navigator.mediaDevices.getDisplayMedia.mockResolvedValue(
    createStream([createTrack({ kind: "video" })]),
  );
  return renderScreenShareControls();
}

describe("MediaControls Hook - Screen Share", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    setupMediaDevicesMock();
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
      publishingGranted: true,
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

    await waitFor(() => {
      expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
    });
    syncOutboundMedia.mockClear();

    await result.current.toggleScreenShare();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: PUBLISHER_VIDEO_CONSTRAINTS,
      audio: {
        suppressLocalAudioPlayback: false,
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

    await waitFor(() => {
      expect(syncOutboundMedia).toHaveBeenCalledTimes(1);
    });

    await result.current.toggleScreenShare();

    expect(screenTrack.stop).toHaveBeenCalledTimes(1);
    expect(setScreenStream).toHaveBeenLastCalledWith(null);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "participant_screen_share_stopped",
        participantId: "p1",
      }),
    );

    rerender({ ...props, screenStream: null });

    await waitFor(() => {
      expect(syncOutboundMedia).toHaveBeenCalledTimes(3);
    });
  });

  it("clears screen sharing when the browser ends capture", async () => {
    const screenTrack = createTrack({ kind: "video", id: "screen-track" });
    const screenAudioTrack = createTrack({
      kind: "audio",
      id: "screen-audio-track",
    });
    const screenStream = createStream([screenTrack, screenAudioTrack]);
    const setScreenStream = jest.fn();
    const send = jest.fn();
    const syncOutboundMedia = jest.fn();

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(screenStream);

    const { result } = renderScreenShareControls({
      send,
      syncOutboundMedia,
      setScreenStream,
    });

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
    expect(syncOutboundMedia).toHaveBeenCalledTimes(2);
    expect(screenAudioTrack.stop).toHaveBeenCalledTimes(1);
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

    const { result } = renderScreenShareControls({
      isHost: true,
      send,
      setScreenStream,
    });

    await result.current.toggleScreenShare();

    expect(setScreenStream).toHaveBeenCalledWith(screenStream);
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "participant_screen_share_started" }),
    );
  });

  it("requests screen sharing without audio when screen audio is disabled", async () => {
    const { result } = renderVideoOnlyScreenShare();

    act(() => {
      result.current.setShareScreenAudioPreference(false);
    });

    await result.current.toggleScreenShare();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: PUBLISHER_VIDEO_CONSTRAINTS,
      audio: false,
    });
    expect(result.current.errorMsg).toBe("");
  });

  it("reports a warning when requested screen audio is missing", async () => {
    const { result } = renderVideoOnlyScreenShare();

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

    const { result } = renderScreenShareControls({
      send,
      syncOutboundMedia,
      setScreenStream,
    });

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
    expect(syncOutboundMedia).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("rejects and cleans up display media streams without a video track", async () => {
    const audioTrack = createTrack({ kind: "audio", id: "screen-audio-track" });
    const audioOnlyScreenStream = createStream([audioTrack]);
    const setScreenStream = jest.fn();
    const setLocalStream = jest.fn();
    const send = jest.fn();

    navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockResolvedValue(audioOnlyScreenStream);

    const { result } = renderScreenShareControls({
      isHost: true,
      send,
      setScreenStream,
      setLocalStream,
    });

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(setScreenStream).not.toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.errorMsg).toContain("[E041]");
    expect(send).not.toHaveBeenCalled();
  });
});

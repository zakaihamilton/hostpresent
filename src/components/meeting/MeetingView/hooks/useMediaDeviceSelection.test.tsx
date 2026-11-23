import { act, renderHook, waitFor } from "@testing-library/react";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";
import { MediaControls } from "./MediaControls";
import {
  createStream,
  createTrack,
  setupMediaDevicesMock,
} from "./mediaTestUtils";

describe("MediaControls Hook - Device Selection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    setupMediaDevicesMock();
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
    const setLocalStream = jest.fn();

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
        publishingGranted: true,
        isHost: true,
        roomConnection: { send: jest.fn(), syncOutboundMedia },
        localStream,
        setLocalStream,
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedCamera).toBe("front-camera-id");
    });

    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(newVideoStream);
    await act(async () => {
      await result.current.switchCamera("back-camera-id");
    });
    expect(result.current.localTrackRevision).toBe(1);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      video: {
        ...PUBLISHER_VIDEO_CONSTRAINTS,
        deviceId: { exact: "back-camera-id" },
      },
      audio: false,
    });
    expect(localStream.removeTrack).toHaveBeenCalledWith(oldVideoTrack);
    expect(oldVideoTrack.stop).toHaveBeenCalled();
    expect(localStream.addTrack).toHaveBeenCalledWith(newVideoTrack);
    expect(newVideoTrack.enabled).toBe(true);
    expect(syncOutboundMedia).toHaveBeenCalledTimes(2);
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
    const setLocalStream = jest.fn();

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
        publishingGranted: true,
        isHost: false,
        roomConnection: {
          send: jest.fn(),
          localParticipantId: "p1",
          syncOutboundMedia,
        },
        localStream,
        setLocalStream,
        screenStream: null,
        setScreenStream: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedMicrophone).toBe("builtin-mic-id");
    });

    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(newAudioStream);
    await act(async () => {
      await result.current.switchMicrophone("external-mic-id");
    });
    expect(result.current.localTrackRevision).toBe(1);

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
    expect(syncOutboundMedia).toHaveBeenCalledTimes(2);
  });
});

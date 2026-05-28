import { act, renderHook } from "@testing-library/react";
import { MediaControls } from "./MediaControls";

describe("MediaControls Hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn().mockResolvedValue({
          getVideoTracks: () => [
            { getSettings: () => ({ deviceId: "" }), stop: jest.fn(), enabled: true },
          ],
          getAudioTracks: () => [
            { getSettings: () => ({ deviceId: "" }), stop: jest.fn(), enabled: true },
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
      })
    );

    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.isVideoMuted).toBe(false);
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
      })
    );

    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.isVideoMuted).toBe(true);
  });

  it("saves media states to localStorage on toggle", () => {
    const sendMock = jest.fn();
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
        roomConnection: { send: sendMock, localParticipantId: "p1" },
        streamListenerCleanupsRef: { current: [] },
        localStream: mockStream,
        setLocalStream: jest.fn(),
        screenStream: null,
        setScreenStream: jest.fn(),
      })
    );

    act(() => {
      result.current.toggleAudio();
    });
    expect(result.current.isAudioMuted).toBe(true);
    expect(window.localStorage.getItem("hostpresent.audioMuted")).toBe("true");

    act(() => {
      result.current.toggleVideo();
    });
    expect(result.current.isVideoMuted).toBe(true);
    expect(window.localStorage.getItem("hostpresent.videoMuted")).toBe("true");
  });
});

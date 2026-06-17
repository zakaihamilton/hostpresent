import { act, renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import { RemoteParticipants } from "./RemoteParticipants";

function createRoomConnection() {
  const subscribers = [];
  return {
    localParticipantId: "local-1",
    hostPresent: true,
    send: jest.fn(),
    sendToParticipant: jest.fn(),
    subscribe: jest.fn((callback) => {
      subscribers.push(callback);
      return () => {};
    }),
    emit(message) {
      for (const callback of subscribers) callback(message);
    },
  };
}

function renderRemoteParticipants({
  isHost = true,
  roomConnection = createRoomConnection(),
  isAudioMuted = false,
  isVideoMuted = false,
} = {}) {
  const roomConnectionRef = createRef();
  roomConnectionRef.current = roomConnection;

  const view = renderHook(() =>
    RemoteParticipants({
      isHost,
      roomConnectionRef,
      roomConnection,
      localStream: null,
      screenStream: null,
      isAudioMuted,
      isVideoMuted,
      setIsAudioMuted: jest.fn(),
      setIsVideoMuted: jest.fn(),
      setIsRecording: jest.fn(),
      setIsRecordingPaused: jest.fn(),
      resetRecordingTimer: jest.fn(),
      publishParticipantMediaStatus: jest.fn(),
      setSessionTitle: jest.fn(),
    }),
  );

  return { ...view, roomConnection };
}

describe("RemoteParticipants", () => {
  it("adds participant profiles on the host and broadcasts them", async () => {
    const { result, roomConnection } = renderRemoteParticipants({
      isHost: true,
    });

    act(() => {
      roomConnection.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE,
        participantId: "p1",
        displayName: "Alex",
        mode: PARTICIPANT_MODE.LISTENING,
      });
    });

    await waitFor(() => {
      expect(result.current.videoParticipants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "p1",
            name: "Alex",
            mode: PARTICIPANT_MODE.LISTENING,
          }),
        ]),
      );
    });
    expect(roomConnection.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST,
        participantId: "p1",
        displayName: "Alex",
        mode: PARTICIPANT_MODE.LISTENING,
      }),
    );
  });

  it("updates participant screen-share state from signaling messages", async () => {
    const { result, roomConnection } = renderRemoteParticipants({
      isHost: true,
    });

    act(() => {
      result.current.handleRemoteParticipant({
        id: "p1",
        name: "Alex",
        mode: PARTICIPANT_MODE.AVAILABLE,
      });
    });

    act(() => {
      roomConnection.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED,
        participantId: "p1",
      });
    });

    await waitFor(() => {
      expect(result.current.videoParticipants[0].isScreenSharing).toBe(true);
    });

    act(() => {
      roomConnection.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED,
        participantId: "p1",
      });
    });

    await waitFor(() => {
      expect(result.current.videoParticipants[0].isScreenSharing).toBe(false);
    });
  });

  it("participants track host-present metadata and host mute messages", async () => {
    const setIsAudioMuted = jest.fn();
    const setIsVideoMuted = jest.fn();
    const roomConnection = createRoomConnection();
    const roomConnectionRef = createRef();
    roomConnectionRef.current = roomConnection;

    const { result } = renderHook(() =>
      RemoteParticipants({
        isHost: false,
        roomConnectionRef,
        roomConnection,
        localStream: null,
        screenStream: null,
        isAudioMuted: false,
        isVideoMuted: false,
        setIsAudioMuted,
        setIsVideoMuted,
        setIsRecording: jest.fn(),
        setIsRecordingPaused: jest.fn(),
        resetRecordingTimer: jest.fn(),
        publishParticipantMediaStatus: jest.fn(),
        setSessionTitle: jest.fn(),
      }),
    );

    act(() => {
      roomConnection.emit({
        type: SIGNALING_MESSAGE.HOST_PRESENT,
        displayName: "Host One",
        audioMuted: true,
        videoMuted: true,
        screenSharing: true,
        mode: PARTICIPANT_MODE.LISTENING,
      });
      roomConnection.emit({
        type: SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
      });
      roomConnection.emit({
        type: SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
      });
    });

    await waitFor(() => {
      expect(result.current.hostDisplayName).toBe("Host One");
    });
    expect(result.current.hostAudioMuted).toBe(true);
    expect(result.current.hostVideoMuted).toBe(true);
    expect(result.current.hostScreenSharing).toBe(true);
    expect(result.current.hostMode).toBe(PARTICIPANT_MODE.LISTENING);
    expect(setIsAudioMuted).toHaveBeenCalledWith(true);
    expect(setIsVideoMuted).toHaveBeenCalledWith(true);
  });
});

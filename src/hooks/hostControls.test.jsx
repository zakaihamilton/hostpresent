import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import { useHostControls } from "./hostControls";

function createSignaling() {
  const subscribers = [];
  return {
    send: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn((callback) => {
      subscribers.push(callback);
      return () => {};
    }),
    emit(message) {
      for (const callback of subscribers) callback(message);
    },
  };
}

function renderHostControls({
  confirm = jest.fn().mockResolvedValue(true),
  signaling = createSignaling(),
  enabled = true,
  initialVideoParticipants = [
    {
      id: "p1",
      name: "Alex",
      isAudioMuted: false,
      isVideoMuted: false,
    },
  ],
  initialAudioList = [
    {
      id: "a1",
      name: "Audio Guest",
      isMuted: false,
    },
  ],
} = {}) {
  const view = renderHook(() => {
    const [videoParticipants, setVideoParticipants] = useState(
      initialVideoParticipants,
    );
    const [audioList, setAudioList] = useState(initialAudioList);
    const controls = useHostControls({
      videoParticipants,
      audioList,
      setVideoParticipants,
      setAudioList,
      signaling,
      confirm,
      enabled,
    });
    return { ...controls, videoParticipants, audioList };
  });

  return { ...view, confirm, signaling };
}

describe("useHostControls", () => {
  it("confirms and mutes one participant microphone", async () => {
    const { result, confirm, signaling } = renderHostControls();

    await act(async () => {
      await result.current.muteParticipantAudio("p1", "video");
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mute participant",
        message: expect.stringContaining("Alex"),
      }),
    );
    expect(result.current.videoParticipants[0].isAudioMuted).toBe(true);
    expect(signaling.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
        participantId: "p1",
        participantType: "video",
      }),
    );
  });

  it("does not send a mute command when confirmation is cancelled", async () => {
    const { result, signaling } = renderHostControls({
      confirm: jest.fn().mockResolvedValue(false),
    });

    await act(async () => {
      await result.current.muteParticipantVideo("p1");
    });

    expect(result.current.videoParticipants[0].isVideoMuted).toBe(false);
    expect(signaling.send).not.toHaveBeenCalled();
  });

  it("does not send duplicate commands for already-muted participants", async () => {
    const { result, confirm, signaling } = renderHostControls({
      initialVideoParticipants: [
        {
          id: "p1",
          name: "Alex",
          isAudioMuted: true,
          isVideoMuted: true,
        },
      ],
    });

    await act(async () => {
      await result.current.muteParticipantAudio("p1", "video");
      await result.current.muteParticipantVideo("p1");
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(signaling.send).not.toHaveBeenCalled();
  });

  it("confirms and applies bulk mute commands", async () => {
    const { result, signaling } = renderHostControls();

    await act(async () => {
      await result.current.muteAllAudio();
      await result.current.muteAllVideo();
    });

    expect(result.current.videoParticipants[0].isAudioMuted).toBe(true);
    expect(result.current.videoParticipants[0].isVideoMuted).toBe(true);
    expect(result.current.audioList[0].isMuted).toBe(true);
    expect(signaling.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO }),
    );
    expect(signaling.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO }),
    );
  });

  it("updates local roster state from participant status messages", () => {
    const { result, signaling } = renderHostControls();

    act(() => {
      signaling.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
        participantId: "p1",
        participantType: "video",
      });
      signaling.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
        participantId: "p1",
      });
      signaling.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
        participantId: "p1",
        participantType: "video",
      });
      signaling.emit({
        type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED,
        participantId: "p1",
      });
    });

    expect(result.current.videoParticipants[0]).toEqual(
      expect.objectContaining({
        isAudioMuted: false,
        isVideoMuted: false,
      }),
    );
  });

  it("disables all host control actions when disabled", async () => {
    const { result, confirm, signaling } = renderHostControls({
      enabled: false,
    });

    await act(async () => {
      await result.current.muteAllAudio();
      await result.current.muteAllVideo();
      await result.current.muteParticipantAudio("p1", "video");
      await result.current.muteParticipantVideo("p1");
    });

    expect(result.current.canMuteAllAudio).toBe(false);
    expect(result.current.canMuteAllVideo).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(signaling.send).not.toHaveBeenCalled();
  });
});

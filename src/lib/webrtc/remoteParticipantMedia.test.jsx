import {
  attachRemoteStreamMediaListeners,
  hasPlayableRemoteAudio,
  isRemoteTrackMuted,
  readRemoteStreamMediaState,
} from "./remoteParticipantMedia.js";

function createTrack({
  kind,
  muted = false,
  enabled = true,
  readyState = "live",
}) {
  const listeners = new Map();
  return {
    kind,
    muted,
    enabled,
    readyState,
    addEventListener: (type, handler) => {
      const bucket = listeners.get(type) ?? [];
      bucket.push(handler);
      listeners.set(type, bucket);
    },
    removeEventListener: (type, handler) => {
      const bucket = listeners.get(type) ?? [];
      listeners.set(
        type,
        bucket.filter((entry) => entry !== handler),
      );
    },
    emit: (type) => {
      for (const handler of listeners.get(type) ?? []) {
        handler();
      }
    },
  };
}

describe("remoteParticipantMedia", () => {
  it("detects playable remote audio from live enabled tracks", () => {
    const audioTrack = createTrack({ kind: "audio" });
    const stream = {
      getAudioTracks: () => [audioTrack],
    };
    expect(hasPlayableRemoteAudio(stream)).toBe(true);

    audioTrack.enabled = false;
    expect(hasPlayableRemoteAudio(stream)).toBe(false);
  });

  it("treats WebRTC pre-RTP muted tracks as playable when enabled", () => {
    const audioTrack = createTrack({ kind: "audio", muted: true });
    const stream = {
      getAudioTracks: () => [audioTrack],
    };
    expect(hasPlayableRemoteAudio(stream)).toBe(true);
  });

  it("detects muted remote tracks", () => {
    expect(
      isRemoteTrackMuted(createTrack({ kind: "audio", enabled: false })),
    ).toBe(true);
    expect(
      isRemoteTrackMuted(createTrack({ kind: "audio", muted: true })),
    ).toBe(true);
  });

  it("reads stream media state and reacts to track changes", () => {
    const audioTrack = createTrack({ kind: "audio" });
    const stream = {
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
      getTracks: () => [audioTrack],
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const onChange = jest.fn();
    attachRemoteStreamMediaListeners(stream, onChange);

    expect(readRemoteStreamMediaState(stream)).toEqual({
      isAudioMuted: false,
      isVideoMuted: null,
    });

    audioTrack.enabled = false;
    audioTrack.emit("mute");
    expect(onChange).toHaveBeenLastCalledWith({
      isAudioMuted: true,
      isVideoMuted: null,
    });
  });
});

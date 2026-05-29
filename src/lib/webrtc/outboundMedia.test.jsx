import {
  buildOutboundMediaStream,
  pickOutboundVideoTrack,
  syncOutboundTracks,
} from "./outboundMedia.js";

beforeAll(() => {
  global.MediaStream = class MediaStream {
    constructor(tracks = []) {
      this._tracks = tracks;
    }

    getVideoTracks() {
      return this._tracks.filter((track) => track.kind === "video");
    }

    getAudioTracks() {
      return this._tracks.filter((track) => track.kind === "audio");
    }
  };
});

function mockStream({ video = false, audio = false, videoId = "video" } = {}) {
  const tracks = [];
  if (video) {
    tracks.push({ kind: "video", readyState: "live", id: videoId });
  }
  if (audio) {
    tracks.push({
      kind: "audio",
      readyState: "live",
      id: "audio",
      enabled: true,
    });
  }
  return {
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  };
}

describe("pickOutboundVideoTrack", () => {
  it("prefers screen video over the camera", () => {
    const track = pickOutboundVideoTrack(
      mockStream({ video: true, videoId: "cam" }),
      mockStream({ video: true, videoId: "screen" }),
    );
    expect(track.id).toBe("screen");
  });
});

describe("buildOutboundMediaStream", () => {
  it("returns a screen-only stream when the camera is not ready yet", async () => {
    const outbound = await buildOutboundMediaStream(
      null,
      mockStream({ video: true, videoId: "screen" }),
    );
    expect(outbound?.getVideoTracks()[0]?.id).toBe("screen");
  });

  it("returns null when no media is available", async () => {
    expect(await buildOutboundMediaStream(null, null)).toBeNull();
  });

  it("includes a disabled live audio track so unmute can resume audio", async () => {
    const stream = mockStream({ audio: true });
    stream.getAudioTracks()[0].enabled = false;

    const outbound = await buildOutboundMediaStream(stream, null);

    expect(outbound?.getAudioTracks()[0]).toBe(stream.getAudioTracks()[0]);
  });
});

describe("syncOutboundTracks", () => {
  it("clears an existing video sender when no outbound video is available", async () => {
    const replaceTrack = jest.fn().mockResolvedValue(undefined);
    const call = {
      peerConnection: {
        getSenders: () => [
          {
            track: { kind: "video", id: "screen", readyState: "ended" },
            replaceTrack,
          },
        ],
      },
    };

    await syncOutboundTracks(call, null, null);

    expect(replaceTrack).toHaveBeenCalledWith(null);
  });

  it("reuses a cleared video sender when video becomes available again", async () => {
    const replaceTrack = jest.fn().mockResolvedValue(undefined);
    const sender = {
      track: null,
      _hostPresentKind: "video",
      replaceTrack,
    };
    const call = {
      peerConnection: {
        getSenders: () => [sender],
        addTrack: jest.fn(),
      },
    };
    const stream = mockStream({ video: true, videoId: "camera" });

    await syncOutboundTracks(call, stream, null);

    expect(replaceTrack).toHaveBeenCalledWith(stream.getVideoTracks()[0]);
    expect(call.peerConnection.addTrack).not.toHaveBeenCalled();
  });
});

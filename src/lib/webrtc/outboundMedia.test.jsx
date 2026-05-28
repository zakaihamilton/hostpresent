import {
  buildOutboundMediaStream,
  pickOutboundVideoTrack,
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
});

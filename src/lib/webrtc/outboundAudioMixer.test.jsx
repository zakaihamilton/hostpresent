import {
  needsOutboundAudioMix,
  OutboundAudioMixer,
} from "./outboundAudioMixer.js";

function mockStream({
  video = false,
  audio = false,
  audioId = "audio",
  audioEnabled = true,
} = {}) {
  const tracks = [];
  if (video) {
    tracks.push({ kind: "video", readyState: "live", id: "video" });
  }
  if (audio) {
    tracks.push({
      kind: "audio",
      readyState: "live",
      id: audioId,
      enabled: audioEnabled,
    });
  }
  return {
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  };
}

describe("needsOutboundAudioMix", () => {
  it("returns false when only the microphone is available", () => {
    expect(needsOutboundAudioMix(mockStream({ audio: true }), null)).toBe(
      false,
    );
  });

  it("returns false when only screen audio is available", () => {
    expect(
      needsOutboundAudioMix(null, mockStream({ audio: true, audioId: "tab" })),
    ).toBe(false);
  });

  it("returns true when both microphone and screen audio are available", () => {
    expect(
      needsOutboundAudioMix(
        mockStream({ audio: true, audioId: "mic" }),
        mockStream({ audio: true, audioId: "tab" }),
      ),
    ).toBe(true);
  });

  it("returns false when the microphone is disabled but screen audio is on", () => {
    expect(
      needsOutboundAudioMix(
        mockStream({ audio: true, audioId: "mic", audioEnabled: false }),
        mockStream({ audio: true, audioId: "tab" }),
      ),
    ).toBe(false);
  });
});

describe("OutboundAudioMixer.getMixedAudioTrack", () => {
  it("returns the raw microphone track when only the mic is live", async () => {
    const mixer = new OutboundAudioMixer();
    const track = await mixer.getMixedAudioTrack(
      mockStream({ audio: true, audioId: "mic" }),
      null,
    );
    expect(track.id).toBe("mic");
  });

  it("returns only screen audio when the microphone is disabled", async () => {
    const mixer = new OutboundAudioMixer();
    const track = await mixer.getMixedAudioTrack(
      mockStream({ audio: true, audioId: "mic", audioEnabled: false }),
      mockStream({ audio: true, audioId: "tab" }),
    );
    expect(track.id).toBe("tab");
  });

  it("keeps a muted microphone track attached when it is the only audio", async () => {
    const mixer = new OutboundAudioMixer();
    const track = await mixer.getMixedAudioTrack(
      mockStream({ audio: true, audioId: "mic", audioEnabled: false }),
      null,
    );
    expect(track.id).toBe("mic");
  });
});

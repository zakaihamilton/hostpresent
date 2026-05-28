import { needsOutboundAudioMix } from "./outboundAudioMixer.js";

function mockStream({ video = false, audio = false, audioId = "audio" } = {}) {
  const tracks = [];
  if (video) {
    tracks.push({ kind: "video", readyState: "live", id: "video" });
  }
  if (audio) {
    tracks.push({ kind: "audio", readyState: "live", id: audioId });
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
});

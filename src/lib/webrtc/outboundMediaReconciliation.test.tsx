import { needsMediaRenegotiation } from "./outboundMediaReconciliation";

describe("needsMediaRenegotiation", () => {
  it("requests renegotiation when a requested media kind has no sender", () => {
    const call = { peerConnection: { getSenders: () => [] } };
    expect(
      needsMediaRenegotiation(call, {
        hasVideoTrack: true,
        hasAudioTrack: false,
      }),
    ).toBe(true);
  });

  it("does not request renegotiation when matching senders exist", () => {
    const call = {
      peerConnection: {
        getSenders: () => [
          { track: { kind: "video" } },
          { track: { kind: "audio" } },
        ],
      },
    };
    expect(
      needsMediaRenegotiation(call, {
        hasVideoTrack: true,
        hasAudioTrack: true,
      }),
    ).toBe(false);
  });
});

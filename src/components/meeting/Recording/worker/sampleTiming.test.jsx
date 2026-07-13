import { getSafeSampleDuration, needsAudioSampleTrim } from "./sampleTiming";

describe("getSafeSampleDuration", () => {
  it("keeps normal packet durations", () => {
    expect(getSafeSampleDuration("video", 1 / 30)).toBeCloseTo(1 / 30);
    expect(getSafeSampleDuration("audio", 0.02)).toBe(0.02);
  });

  it("replaces missing durations and caps corrupt tail durations", () => {
    expect(getSafeSampleDuration("video", 0)).toBeCloseTo(1 / 30);
    expect(getSafeSampleDuration("audio", Number.NaN)).toBe(0.02);
    expect(getSafeSampleDuration("video", 1_000)).toBe(0.25);
    expect(getSafeSampleDuration("audio", 1_000)).toBe(0.1);
    expect(needsAudioSampleTrim(0.02)).toBe(false);
    expect(needsAudioSampleTrim(1_000)).toBe(true);
  });
});

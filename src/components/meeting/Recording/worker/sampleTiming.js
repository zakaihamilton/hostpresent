const FALLBACK_DURATION = {
  video: 1 / 30,
  audio: 0.02,
};

const MAX_DURATION = {
  video: 0.25,
  audio: 0.1,
};

export function getSafeSampleDuration(stream, duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return FALLBACK_DURATION[stream];
  }
  return Math.min(duration, MAX_DURATION[stream]);
}

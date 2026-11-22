const SPEAKING_SAMPLE_MS = 140;
const SPEAKING_THRESHOLD = 0.055;

export function attachSpeakingDetector(
  stream: MediaStream | null | undefined,
  onSpeakingChange: (isSpeaking: boolean) => void,
): () => void {
  if (
    typeof window === "undefined" ||
    !stream?.getAudioTracks?.().some((track) => track.readyState === "live") ||
    typeof onSpeakingChange !== "function"
  ) {
    return () => {};
  }

  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return () => {};

  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let intervalId: number | undefined;
  let lastSpeaking = false;

  try {
    context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    intervalId = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const speaking = Math.sqrt(sum / samples.length) >= SPEAKING_THRESHOLD;
      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        onSpeakingChange(speaking);
      }
    }, SPEAKING_SAMPLE_MS);
  } catch {
    return () => {};
  }

  return () => {
    if (intervalId) window.clearInterval(intervalId);
    if (lastSpeaking) onSpeakingChange(false);
    try {
      source?.disconnect();
    } catch {}
    void context?.close?.();
  };
}

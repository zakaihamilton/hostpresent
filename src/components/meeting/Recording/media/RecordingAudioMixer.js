export class RecordingAudioMixer {
  constructor() {
    const AudioContextConstructor =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (AudioContextConstructor) {
      this.context = new AudioContextConstructor();
      this.destination = this.context.createMediaStreamDestination();
    }
    this.sources = new Map();
  }

  updateTracks(tracks) {
    if (!this.context) return;
    for (const [trackId, info] of this.sources.entries()) {
      if (
        !tracks.some(
          (track) => track.id === trackId && track.readyState === "live",
        )
      ) {
        try {
          info.sourceNode.disconnect();
        } catch {}
        this.sources.delete(trackId);
      }
    }
    for (const track of tracks) {
      if (!track || track.readyState !== "live" || this.sources.has(track.id))
        continue;
      try {
        const stream = new MediaStream([track]);
        const sourceNode = this.context.createMediaStreamSource(stream);
        sourceNode.connect(this.destination);
        this.sources.set(track.id, { sourceNode, stream });
      } catch (error) {
        console.warn(
          "Failed to connect audio track to recording mixer:",
          error,
        );
      }
    }
  }

  getAudioTrack() {
    return this.destination?.stream.getAudioTracks()[0] ?? null;
  }

  destroy() {
    for (const info of this.sources.values()) {
      try {
        info.sourceNode.disconnect();
      } catch {}
    }
    this.sources.clear();
    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
  }
}

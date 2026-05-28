function getLiveAudioTrack(stream) {
  return (
    stream
      ?.getAudioTracks()
      .find((track) => track.readyState === "live" && track.enabled) ?? null
  );
}

export function needsOutboundAudioMix(localStream, screenStream) {
  const micTrack = getLiveAudioTrack(localStream);
  const screenTrack = getLiveAudioTrack(screenStream);
  return Boolean(micTrack && screenTrack);
}

export class OutboundAudioMixer {
  #context = null;

  #destination = null;

  #nodes = [];

  #ensureContext() {
    if (!this.#context || this.#context.state === "closed") {
      this.#context = new AudioContext();
      this.#destination = this.#context.createMediaStreamDestination();
    }
    return this.#context;
  }

  #clearGraph() {
    for (const node of this.#nodes) {
      try {
        node.disconnect();
      } catch {
        // ignore disconnect errors during teardown
      }
    }
    this.#nodes = [];
  }

  async getMixedAudioTrack(localStream, screenStream) {
    const micTrack = getLiveAudioTrack(localStream);
    const screenTrack = getLiveAudioTrack(screenStream);

    if (!micTrack && !screenTrack) {
      return null;
    }

    if (!micTrack && screenTrack) {
      this.#clearGraph();
      return screenTrack;
    }

    if (micTrack && !screenTrack) {
      this.#clearGraph();
      return micTrack;
    }

    const context = this.#ensureContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    this.#clearGraph();

    // Clone the mic track so Web Audio can read it while the raw track may
    // still be attached to an RTCRtpSender until replaceTrack completes.
    const micSource = context.createMediaStreamSource(
      new MediaStream([micTrack.clone()]),
    );
    micSource.connect(this.#destination);
    this.#nodes.push(micSource);

    if (screenTrack) {
      const screenSource = context.createMediaStreamSource(
        new MediaStream([screenTrack]),
      );
      screenSource.connect(this.#destination);
      this.#nodes.push(screenSource);
    }

    return this.#destination.stream.getAudioTracks()[0] ?? null;
  }

  destroy() {
    this.#clearGraph();
    if (this.#context && this.#context.state !== "closed") {
      void this.#context.close();
    }
    this.#context = null;
    this.#destination = null;
  }
}

let sharedMixer = null;

export function getOutboundAudioMixer() {
  if (typeof window === "undefined") return null;
  if (!sharedMixer) {
    sharedMixer = new OutboundAudioMixer();
  }
  return sharedMixer;
}

export function destroyOutboundAudioMixer() {
  sharedMixer?.destroy();
  sharedMixer = null;
}

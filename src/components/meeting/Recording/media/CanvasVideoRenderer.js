const RECORDING_WIDTH = 1280;
const RECORDING_HEIGHT = 720;

export class CanvasVideoRenderer {
  constructor() {
    if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = RECORDING_WIDTH;
      this.canvas.height = RECORDING_HEIGHT;
      this.ctx = this.canvas.getContext("2d");
      this.videoElement = document.createElement("video");
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }
    this.activeTrack = null;
    this.animationId = null;
    this.running = false;
    this.render = this.render.bind(this);
  }

  setTrack(track) {
    if (this.activeTrack === track) return;
    this.activeTrack = track;
    if (track && typeof MediaStream !== "undefined") {
      this.videoElement.srcObject = new MediaStream([track]);
      this.videoElement
        .play()
        .catch((error) => console.warn("Canvas video play failed:", error));
    } else if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.render();
  }

  stop() {
    this.running = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    if (this.videoElement) this.videoElement.srcObject = null;
  }

  render() {
    if (!this.running) return;
    if (this.videoElement && this.videoElement.readyState >= 2) {
      const { x, y, width, height } = this.getDrawRect();
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.videoElement, x, y, width, height);
    } else if (this.ctx) {
      this.ctx.fillStyle = "#1e1e24";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.animationId = requestAnimationFrame(this.render);
  }

  getDrawRect() {
    const { videoWidth, videoHeight } = this.videoElement;
    if (!videoWidth || !videoHeight) {
      return {
        x: 0,
        y: 0,
        width: this.canvas.width,
        height: this.canvas.height,
      };
    }
    const scale = Math.min(
      this.canvas.width / videoWidth,
      this.canvas.height / videoHeight,
    );
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    return {
      x: (this.canvas.width - width) / 2,
      y: (this.canvas.height - height) / 2,
      width,
      height,
    };
  }

  getStream() {
    return this.canvas?.captureStream
      ? this.canvas.captureStream(30)
      : new MediaStream();
  }
}

export function createMockStream(name, bgColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(30);

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  stream.addTrack(dest.stream.getAudioTracks()[0]);

  let hue = 0;
  const draw = () => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      50,
      centerX,
      centerY,
      150,
    );
    gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.5)`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, centerX, centerY);

    hue = (hue + 1) % 360;
    requestAnimationFrame(draw);
  };
  draw();

  return stream;
}

export function createMockScreenShareStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);

  let frame = 0;
  const draw = () => {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#27272a";
    ctx.fillRect(0, 0, canvas.width, 60);
    ctx.fillStyle = "#f9fafb";
    ctx.font = "500 24px -apple-system, system-ui, sans-serif";
    ctx.fillText("Mock Screen Share (Iframe Policy Restricted)", 24, 40);

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(100 + (frame % 1000), 200, 400, 250);

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(800, 325, 120 + Math.sin(frame / 30) * 40, 0, Math.PI * 2);
    ctx.fill();

    frame++;
    if (stream.active) {
      requestAnimationFrame(draw);
    }
  };
  draw();

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  stream.addTrack(dest.stream.getAudioTracks()[0]);

  return stream;
}

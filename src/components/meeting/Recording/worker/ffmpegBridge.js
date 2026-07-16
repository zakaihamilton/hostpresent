export function createFfmpegBridge() {
  const startedAt = performance.now();
  performance.mark?.("hostpresent:ffmpeg-load-start");
  const worker = new Worker(
    new URL("/recording/ffmpeg/ffmpeg-runtime.worker.js", self.location.origin),
  );
  let requestId = 0;
  let terminated = false;
  const pending = new Map();

  const rejectPending = (error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.result);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "FFmpeg worker failed.");
    rejectPending(error);
  };

  const call = (type, payload = {}, transfer = []) =>
    new Promise((resolve, reject) => {
      if (terminated) {
        reject(new Error("FFmpeg worker was terminated."));
        return;
      }
      const id = requestId;
      requestId += 1;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload }, transfer);
    });

  return call("load")
    .then(() => {
      performance.mark?.("hostpresent:ffmpeg-load-end");
      performance.measure?.(
        "hostpresent:ffmpeg-load",
        "hostpresent:ffmpeg-load-start",
        "hostpresent:ffmpeg-load-end",
      );
      return {
        writeFile(path, data) {
          const bytes = new Uint8Array(data);
          return call("write", { path, data: bytes.buffer }, [bytes.buffer]);
        },
        exec(args) {
          return call("exec", { args });
        },
        async readFile(path) {
          return new Uint8Array(await call("read", { path }));
        },
        deleteFile(path) {
          return call("delete", { path });
        },
        terminate() {
          if (terminated) return;
          terminated = true;
          worker.terminate();
          rejectPending(new Error("FFmpeg worker was terminated."));
        },
      };
    })
    .catch((error) => {
      performance.mark?.("hostpresent:ffmpeg-load-failed");
      // Keep a small, local timing signal available to the diagnostics dialog.
      // No recording details leave the browser unless the user opts in.
      performance.measure?.("hostpresent:ffmpeg-load-failed", {
        start: startedAt,
        duration: performance.now() - startedAt,
      });
      throw error;
    });
}

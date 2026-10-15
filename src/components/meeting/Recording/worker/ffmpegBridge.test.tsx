import { createFfmpegBridge } from "./ffmpegBridge";

const OriginalWorker = global.Worker;

function installWorker() {
  const instances = [];
  global.Worker = class MockWorker {
    constructor() {
      this.postMessage = jest.fn();
      this.terminate = jest.fn();
      instances.push(this);
    }
  };
  return instances;
}

afterEach(() => {
  global.Worker = OriginalWorker;
});

describe("createFfmpegBridge", () => {
  it("rejects pending work when export cancellation terminates the runtime", async () => {
    const workers = installWorker();
    const bridgePromise = createFfmpegBridge();
    const worker = workers[0];

    worker.onmessage({ data: { id: 0, result: undefined } });
    const bridge = await bridgePromise;
    const running = bridge.exec(["-version"]);

    bridge.terminate();

    await expect(running).rejects.toThrow("FFmpeg worker was terminated.");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects calls made after termination without posting to the worker", async () => {
    const workers = installWorker();
    const bridgePromise = createFfmpegBridge();
    const worker = workers[0];

    worker.onmessage({ data: { id: 0, result: undefined } });
    const bridge = await bridgePromise;
    bridge.terminate();

    await expect(bridge.exec(["-version"])).rejects.toThrow(
      "FFmpeg worker was terminated.",
    );
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });
});

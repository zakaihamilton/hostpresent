import {
  supportsWebCodecsRecording,
  supportsWebCodecsRecordingCodecs,
} from "./webCodecsRecording";

const original = {
  AudioEncoder: global.AudioEncoder,
  MediaStreamTrackProcessor: global.MediaStreamTrackProcessor,
  VideoEncoder: global.VideoEncoder,
  Worker: global.Worker,
  storage: global.navigator.storage,
};

function installCapabilities({ video = true, audio = true } = {}) {
  global.Worker = class Worker {};
  global.MediaStreamTrackProcessor = class MediaStreamTrackProcessor {};
  global.VideoEncoder = {
    isConfigSupported: jest.fn().mockResolvedValue({ supported: video }),
  };
  global.AudioEncoder = {
    isConfigSupported: jest.fn().mockResolvedValue({ supported: audio }),
  };
  Object.defineProperty(global.navigator, "storage", {
    configurable: true,
    value: { getDirectory: jest.fn() },
  });
}

afterEach(() => {
  global.Worker = original.Worker;
  global.MediaStreamTrackProcessor = original.MediaStreamTrackProcessor;
  global.VideoEncoder = original.VideoEncoder;
  global.AudioEncoder = original.AudioEncoder;
  Object.defineProperty(global.navigator, "storage", {
    configurable: true,
    value: original.storage,
  });
});

describe("WebCodecs recording capabilities", () => {
  it("requires worker, processors, encoders, and OPFS", () => {
    installCapabilities();
    expect(supportsWebCodecsRecording()).toBe(true);

    Object.defineProperty(global.navigator, "storage", {
      configurable: true,
      value: {},
    });
    expect(supportsWebCodecsRecording()).toBe(false);
  });

  it("selects WebCodecs only when AVC and AAC configurations are supported", async () => {
    installCapabilities({ video: true, audio: false });

    await expect(
      supportsWebCodecsRecordingCodecs({ width: 1280, height: 720 }),
    ).resolves.toBe(false);

    installCapabilities({ video: true, audio: true });
    await expect(
      supportsWebCodecsRecordingCodecs({ width: 1280, height: 720 }),
    ).resolves.toBe(true);

    expect(global.VideoEncoder.isConfigSupported).toHaveBeenLastCalledWith(
      expect.objectContaining({ codec: "avc1.42E01F" }),
    );
  });

  it("falls back when probing a WebCodecs configuration throws", async () => {
    installCapabilities();
    global.VideoEncoder.isConfigSupported.mockRejectedValueOnce(
      new Error("AVC encoder unavailable"),
    );

    await expect(
      supportsWebCodecsRecordingCodecs({ width: 1280, height: 720 }),
    ).resolves.toBe(false);
  });
});

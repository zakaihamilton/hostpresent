import {
  chooseRecordingDirectory,
  deliverIndexedDbExport,
  downloadIndexedDbRecording,
  downloadRecordingStream,
} from "./recordingExport";

const originalServiceWorker = navigator.serviceWorker;
const OriginalMessageChannel = global.MessageChannel;

afterEach(() => {
  delete window.showDirectoryPicker;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: originalServiceWorker,
  });
  global.MessageChannel = OriginalMessageChannel;
});

describe("chooseRecordingDirectory", () => {
  it("uses browser-download delivery when the directory picker is cancelled", async () => {
    window.showDirectoryPicker = jest.fn().mockRejectedValue({
      name: "AbortError",
    });

    await expect(chooseRecordingDirectory()).resolves.toBeNull();
  });

  it("rethrows directory permission failures", async () => {
    const error = new Error("Permission denied");
    window.showDirectoryPicker = jest.fn().mockRejectedValue(error);

    await expect(chooseRecordingDirectory()).rejects.toBe(error);
  });
});

describe("downloadRecordingStream", () => {
  it("falls back when no active service worker can own the stream", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    await expect(downloadRecordingStream({}, "recording.mp4")).resolves.toBe(
      false,
    );
  });

  it("hands the stream to the service worker before triggering its download URL", async () => {
    let channel;
    global.MessageChannel = class MessageChannel {
      constructor() {
        channel = this;
        this.port1 = { close: jest.fn(), onmessage: null };
        this.port2 = {};
      }
    };
    const postMessage = jest.fn((data) => {
      channel.port1.onmessage({
        data: { type: "recording-download-ready", id: data.id },
      });
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: { postMessage } },
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await expect(downloadRecordingStream({}, "recording.mp4")).resolves.toBe(
      true,
    );

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "recording-download",
        filename: "recording.mp4",
      }),
      expect.any(Array),
    );
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("asks the service worker to read IndexedDB output by descriptor", async () => {
    let channel;
    global.MessageChannel = class MessageChannel {
      constructor() {
        channel = this;
        this.port1 = { close: jest.fn(), onmessage: null };
        this.port2 = {};
      }
    };
    const postMessage = jest.fn((data) => {
      channel.port1.onmessage({
        data: { type: "recording-download-ready", id: data.id },
      });
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: { postMessage } },
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await expect(
      downloadIndexedDbRecording({
        sessionId: "session-1",
        path: "final-video.mp4",
        chunks: 2,
        filename: "recording.mp4",
      }),
    ).resolves.toBe(true);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "recording-indexeddb-download",
        sourceFilename: "final-video.mp4",
      }),
      [expect.anything()],
    );
    click.mockRestore();
  });

  it("asks Chromium hosts to choose a folder when streamed delivery is unavailable", async () => {
    window.showDirectoryPicker = jest.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    await expect(
      deliverIndexedDbExport({
        sessionId: "session-1",
        path: "final-video.mp4",
        chunks: 1,
        filename: "recording.mp4",
      }),
    ).rejects.toThrow("Choose an export folder");
  });
});

import {
  chooseRecordingDirectory,
  deliverIndexedDbExport,
  deliverOpfsExport,
  downloadIndexedDbRecording,
  downloadRecordingStream,
} from "./recordingExport";

const originalServiceWorker = navigator.serviceWorker;
const originalStorage = navigator.storage;
const OriginalMessageChannel = global.MessageChannel;

afterEach(() => {
  delete window.showDirectoryPicker;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: originalServiceWorker,
  });
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: originalStorage,
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

describe("direct folder exports", () => {
  it("writes to a suffixed filename instead of overwriting an existing file", async () => {
    const writable = {
      getWriter: () => ({
        write: jest.fn(),
        close: jest.fn(),
        abort: jest.fn(),
      }),
    };
    const directory = {
      getFileHandle: jest.fn((filename, options) => {
        if (filename === "recording.mp4" && !options?.create) {
          return Promise.resolve({});
        }
        if (filename === "recording (1).mp4" && !options?.create) {
          return Promise.reject({ name: "NotFoundError" });
        }
        return Promise.resolve({ createWritable: () => writable });
      }),
    };
    const sourceFile = {
      stream: () => ({
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1]);
        },
      }),
    };
    const root = {
      getDirectoryHandle: jest.fn().mockResolvedValue({
        getDirectoryHandle: jest.fn().mockResolvedValue({
          getDirectoryHandle: jest.fn().mockResolvedValue({
            getFileHandle: jest.fn().mockResolvedValue({
              getFile: jest.fn().mockResolvedValue(sourceFile),
            }),
          }),
        }),
      }),
    };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { getDirectory: jest.fn().mockResolvedValue(root) },
    });

    await deliverOpfsExport({
      sessionId: "session-1",
      path: "exports/final-video.mp4",
      directory,
      filename: "recording.mp4",
    });

    expect(directory.getFileHandle).toHaveBeenNthCalledWith(1, "recording.mp4");
    expect(directory.getFileHandle).toHaveBeenNthCalledWith(
      2,
      "recording (1).mp4",
    );
    expect(directory.getFileHandle).toHaveBeenNthCalledWith(
      3,
      "recording (1).mp4",
      { create: true },
    );
  });
});

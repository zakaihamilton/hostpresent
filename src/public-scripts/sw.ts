const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = "hostpresent-v6";
const SHELL_URLS = ["/", "/icons/icon.svg"];
const MAX_RUNTIME_CACHE_ENTRIES = 100;
const recordingDownloads = new Map<string, RecordingDownload>();
const RECORDING_DB = "HPRecording";
const RECORDING_STORE = "data";

type RecordingChunk = Blob | Uint8Array | ArrayBuffer;

type IndexedDbDownloadMessage = {
  id: string;
  type: "recording-indexeddb-download";
  filename: string;
  sessionId: string;
  sourceFilename: string;
  chunks: number;
};

type StreamDownloadMessage = {
  id: string;
  type: "recording-download";
  filename: string;
  stream: ReadableStream<Uint8Array>;
};

type ServiceWorkerMessage = IndexedDbDownloadMessage | StreamDownloadMessage;

type RecordingDownload = {
  filename: string;
  stream: ReadableStream<Uint8Array>;
  done: Promise<void>;
};

function isShellRequest(request: Request): boolean {
  return SHELL_URLS.includes(new URL(request.url).pathname);
}

function openRecordingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECORDING_DB);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecordingChunk(
  key: string,
): Promise<RecordingChunk | undefined> {
  const db = await openRecordingDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(RECORDING_STORE, "readonly")
      .objectStore(RECORDING_STORE)
      .get(key) as IDBRequest<RecordingChunk | undefined>;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbDownloadStream({
  sessionId,
  sourceFilename,
  chunks,
}: IndexedDbDownloadMessage): {
  done: Promise<void>;
  stream: ReadableStream<Uint8Array>;
} {
  let index = 0;
  let finish: (() => void) | undefined;
  let fail: ((error: unknown) => void) | undefined;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return {
    done,
    stream: new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (index >= chunks) {
            controller.close();
            finish?.();
            return;
          }
          const key = `export:${sessionId}:${sourceFilename}:${String(index).padStart(9, "0")}`;
          index += 1;
          const value = await readRecordingChunk(key);
          if (!value) {
            throw new Error(`Recording export chunk ${index - 1} is missing.`);
          }
          if (value instanceof Blob) {
            controller.enqueue(new Uint8Array(await value.arrayBuffer()));
          } else if (value instanceof Uint8Array) {
            controller.enqueue(new Uint8Array(value));
          } else {
            controller.enqueue(new Uint8Array(value));
          }
        } catch (error) {
          fail?.(error);
          controller.error(error);
        }
      },
      cancel() {
        finish?.();
      },
    }),
  };
}

serviceWorker.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as ServiceWorkerMessage | null;
  const port = event.ports[0];
  if (!data?.id || !port) {
    return;
  }
  if (data.type === "recording-indexeddb-download") {
    const output = createIndexedDbDownloadStream(data);
    recordingDownloads.set(data.id, {
      filename: data.filename,
      stream: output.stream,
      done: output.done,
    });
    port.postMessage({
      type: "recording-download-ready",
      id: data.id,
    });
    return;
  }
  if (data.type !== "recording-download") return;
  recordingDownloads.set(data.id, {
    filename: data.filename,
    stream: data.stream,
    done: Promise.resolve(),
  });
  port.postMessage({ type: "recording-download-ready", id: data.id });
});

serviceWorker.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  serviceWorker.skipWaiting();
});

serviceWorker.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  serviceWorker.clients.claim();
});

serviceWorker.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/recording-download/")) {
    const id = url.pathname.slice("/recording-download/".length);
    const download = recordingDownloads.get(id);
    if (!download) {
      event.respondWith(new Response("Download has expired.", { status: 404 }));
      return;
    }
    recordingDownloads.delete(id);
    event.waitUntil(download.done.catch(() => {}));
    event.respondWith(
      new Response(download.stream, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(download.filename)}`,
          "Cache-Control": "no-store",
        },
      }),
    );
    return;
  }
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/recording/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return (await caches.match("/")) ?? Response.error();
      }),
    );
    return;
  }

  // Only Next's content-addressed build assets are safe to retain at runtime.
  // In particular, do not duplicate the 31 MB FFmpeg fallback in Cache Storage.
  if (!url.pathname.startsWith("/_next/static/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then(async (response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
          const keys = (await cache.keys()).filter(
            (key) => !isShellRequest(key),
          );
          await Promise.all(
            keys
              .slice(0, Math.max(0, keys.length - MAX_RUNTIME_CACHE_ENTRIES))
              .map((key) => cache.delete(key)),
          );
          return response;
        }),
    ),
  );
});

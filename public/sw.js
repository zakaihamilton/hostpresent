const CACHE_NAME = "hostpresent-v5";
const SHELL_URLS = ["/", "/icons/icon.svg"];
const recordingDownloads = new Map();
const RECORDING_DB = "HPRecording";
const RECORDING_STORE = "data";

function openRecordingDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECORDING_DB);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecordingChunk(key) {
  const db = await openRecordingDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(RECORDING_STORE, "readonly")
      .objectStore(RECORDING_STORE)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbDownloadStream({ sessionId, sourceFilename, chunks }) {
  let index = 0;
  let finish;
  let fail;
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return {
    done,
    stream: new ReadableStream({
      async pull(controller) {
        try {
          if (index >= chunks) {
            controller.close();
            finish();
            return;
          }
          const key = `export:${sessionId}:${sourceFilename}:${String(index).padStart(9, "0")}`;
          index += 1;
          const value = await readRecordingChunk(key);
          if (value instanceof Blob) {
            controller.enqueue(new Uint8Array(await value.arrayBuffer()));
          } else if (value) {
            controller.enqueue(value);
          }
        } catch (error) {
          fail(error);
          controller.error(error);
        }
      },
      cancel() {
        finish();
      },
    }),
  };
}

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data?.id || !event.ports[0]) {
    return;
  }
  if (data.type === "recording-indexeddb-download") {
    const output = createIndexedDbDownloadStream(data);
    recordingDownloads.set(data.id, {
      filename: data.filename,
      stream: output.stream,
      done: output.done,
    });
    event.ports[0].postMessage({
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
  event.ports[0].postMessage({ type: "recording-download-ready", id: data.id });
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
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
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
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
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
          return response;
        }),
    ),
  );
});

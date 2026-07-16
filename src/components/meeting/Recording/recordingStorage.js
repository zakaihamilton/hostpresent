const DB_NAME = "HPRecording";
const STORE_NAME = "data";
const MANIFEST_KEY = "manifest";
const STORAGE_VERSION = 4;
const OPFS_DIRECTORY = "hostpresent-recordings";
let writeQueue = Promise.resolve();

function queueWrite(operation) {
  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
}

export function flushRecordingWrites() {
  return writeQueue;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, STORAGE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeValue(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function migrateManifest(manifest) {
  if (!manifest || manifest.version >= STORAGE_VERSION) return manifest;
  return {
    ...manifest,
    version: STORAGE_VERSION,
    segments: manifest.segments ?? [
      { id: 0, startedAt: manifest.createdAt ?? Date.now() },
    ],
    export: manifest.export ?? { checkpoint: null, destination: "none" },
    updatedAt: Date.now(),
  };
}

async function loadManifest() {
  const stored = await loadValue(MANIFEST_KEY);
  const manifest = migrateManifest(stored);
  if (manifest && manifest !== stored) {
    await storeValue(MANIFEST_KEY, manifest);
  }
  return manifest;
}

function chunkKey(stream, index) {
  return `chunk:${stream}:${String(index).padStart(9, "0")}`;
}

export function recordingExportChunkKey(sessionId, filename, index) {
  return `export:${sessionId}:${filename}:${String(index).padStart(9, "0")}`;
}

function canUseOpfs() {
  return Boolean(navigator.storage?.getDirectory);
}

async function getOpfsSessionDirectory(sessionId, create = true) {
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle(OPFS_DIRECTORY, { create });
  return recordings.getDirectoryHandle(sessionId, { create });
}

async function writeOpfsFragment({ sessionId, stream, index, blob }) {
  const session = await getOpfsSessionDirectory(sessionId);
  const track = await session.getDirectoryHandle(stream, { create: true });
  const handle = await track.getFileHandle(chunkKey(stream, index), {
    create: true,
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function createRecordingSession({ sessionName, tracks }) {
  const manifest = {
    version: STORAGE_VERSION,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    sessionName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "recording",
    storage: canUseOpfs() ? "opfs" : "indexeddb",
    persistedBytes: 0,
    segments: [
      {
        id: 0,
        startedAt: Date.now(),
        videoStartIndex: 0,
        audioStartIndex: 0,
      },
    ],
    export: { checkpoint: null, destination: "none" },
    tracks,
  };
  await queueWrite(() => storeValue(MANIFEST_KEY, manifest));
  return manifest;
}

export async function updateRecordingSession(update) {
  return queueWrite(async () => {
    const current = await loadManifest();
    if (!current) return null;
    const manifest = { ...current, ...update, updatedAt: Date.now() };
    await storeValue(MANIFEST_KEY, manifest);
    return manifest;
  });
}

export async function closeActiveRecordingSegment(reason = "stopped") {
  return queueWrite(async () => {
    const current = await loadManifest();
    if (!current) return null;
    const segments = [...(current.segments ?? [])];
    const lastIndex = segments.length - 1;
    if (lastIndex >= 0 && !segments[lastIndex].endedAt) {
      segments[lastIndex] = {
        ...segments[lastIndex],
        endedAt: Date.now(),
        reason,
        videoEndIndex: current.tracks.video?.chunkCount ?? 0,
        audioEndIndex: current.tracks.audio?.chunkCount ?? 0,
      };
    }
    const manifest = { ...current, segments, updatedAt: Date.now() };
    await storeValue(MANIFEST_KEY, manifest);
    return manifest;
  });
}

export async function beginRecordingSegment({ gapStartedAt } = {}) {
  return queueWrite(async () => {
    const current = await loadManifest();
    if (!current) return null;
    const segments = [...(current.segments ?? [])];
    let previous = segments.at(-1);
    if (previous && !previous.endedAt) {
      previous = {
        ...previous,
        endedAt: current.updatedAt ?? Date.now(),
        reason: "recovered-after-interruption",
        videoEndIndex: current.tracks.video?.chunkCount ?? 0,
        audioEndIndex: current.tracks.audio?.chunkCount ?? 0,
      };
      segments[segments.length - 1] = previous;
    }
    const startedAt = Date.now();
    segments.push({
      id: segments.length,
      startedAt,
      gapStartedAt: gapStartedAt ?? previous?.endedAt ?? startedAt,
      // A resumed recording has no media for the interrupted interval. Keep
      // the exported timeline contiguous instead of turning a stale recovery
      // timestamp into hours of silent audio.
      gapDurationMs: 0,
      resumed: true,
      videoStartIndex: current.tracks.video?.chunkCount ?? 0,
      audioStartIndex: current.tracks.audio?.chunkCount ?? 0,
    });
    const manifest = {
      ...current,
      status: "recording",
      segments,
      updatedAt: Date.now(),
    };
    await storeValue(MANIFEST_KEY, manifest);
    return manifest;
  });
}

export async function saveRecordingFragment({ stream, index, blob }) {
  return queueWrite(async () => {
    const current = await loadManifest();
    if (!current) return null;
    if (current.storage === "opfs") {
      await writeOpfsFragment({ sessionId: current.id, stream, index, blob });
    } else {
      await storeValue(chunkKey(stream, index), blob);
    }
    const track = current.tracks[stream] ?? {
      chunkCount: 0,
      mimeType: blob.type,
    };
    const tracks = {
      ...current.tracks,
      [stream]: {
        ...track,
        chunkCount: Math.max(track.chunkCount, index + 1),
        mimeType: blob.type || track.mimeType,
      },
    };
    const manifest = {
      ...current,
      tracks,
      persistedBytes: current.persistedBytes + blob.size,
      updatedAt: Date.now(),
    };
    await storeValue(MANIFEST_KEY, manifest);
    return manifest;
  });
}

export async function getRecordingStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
}

export function createIndexedDbExportStream({ sessionId, filename, chunks }) {
  let index = 0;
  return new ReadableStream({
    async pull(controller) {
      if (index >= chunks) {
        controller.close();
        return;
      }
      const value = await loadValue(
        recordingExportChunkKey(sessionId, filename, index),
      );
      index += 1;
      if (!value) {
        controller.error(
          new Error(`Recording export chunk ${index - 1} is missing.`),
        );
        return;
      }
      if (value instanceof Blob) {
        for await (const bytes of value.stream()) controller.enqueue(bytes);
        return;
      }
      controller.enqueue(value);
    },
  });
}

export async function getRecordingStoragePreflight(
  reserveBytes = 128 * 1024 * 1024,
) {
  const estimate = await getRecordingStorageEstimate();
  const available = estimate?.quota
    ? estimate.quota - (estimate.usage ?? 0)
    : null;
  return {
    backend: canUseOpfs() ? "opfs" : "indexeddb",
    estimate,
    available,
    // OPFS avoids heap pressure, but it still consumes the browser's quota.
    // Do not begin a session that cannot honor the same safety reserve used by
    // the IndexedDB fallback.
    allowed: available === null ? canUseOpfs() : available >= reserveBytes,
  };
}

export async function loadSavedRecording() {
  const manifest = await loadManifest();
  if (!manifest || manifest.status === "exported") return null;
  return { meta: manifest, chunks: [] };
}

export async function clearSavedRecording({ exceptSessionId } = {}) {
  const manifest = await loadManifest();
  if (manifest?.id && manifest.id === exceptSessionId) return;
  if (manifest?.storage === "opfs") {
    const root = await navigator.storage.getDirectory();
    const recordings = await root.getDirectoryHandle(OPFS_DIRECTORY, {
      create: false,
    });
    await recordings
      .removeEntry(manifest.id, { recursive: true })
      .catch(() => {});
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

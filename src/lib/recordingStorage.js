const DB_NAME = "HPRecording";
const STORE_NAME = "data";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(mode) {
  return openDB().then((db) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { store, done };
  });
}

export async function saveRecordingMeta(meta) {
  const { store, done } = await txStore("readwrite");
  store.put(meta, "meta");
  await done;
}

export async function saveRecordingChunk(index, blob) {
  const { store, done } = await txStore("readwrite");
  store.put(blob, `chunk_${index}`);
  await done;
}

export async function loadSavedRecording() {
  const db = await openDB();
  const metaTx = db.transaction(STORE_NAME, "readonly");
  const meta = await new Promise((resolve, reject) => {
    const req = metaTx.objectStore(STORE_NAME).get("meta");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!meta) return null;

  const chunks = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const chunkTx = db.transaction(STORE_NAME, "readonly");
    const blob = await new Promise((resolve, reject) => {
      const req = chunkTx.objectStore(STORE_NAME).get(`chunk_${i}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (blob) {
      chunks.push(blob);
    }
  }

  return { meta, chunks };
}

export async function clearSavedRecording() {
  const { store, done } = await txStore("readwrite");
  store.clear();
  await done;
}

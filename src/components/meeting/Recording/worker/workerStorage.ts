import { BlobSource, ReadableStreamSource } from "mediabunny";

const DB_NAME = "HPRecording";
const STORE_NAME = "data";
export const MANIFEST_KEY = "manifest";

export interface WorkerExportOutput {
  prepare?: () => Promise<unknown>;
  createWritable: () => unknown;
  createSource: () => ReadableStreamSource | Promise<ReadableStreamSource>;
  readHeader: () => Promise<Uint8Array>;
  getChunks: () => number | undefined;
  cancel?: () => Promise<unknown>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeDatabaseValue(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readDatabaseValue(key: string): Promise<any> {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteDatabaseValue(key: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateExportCheckpoint(
  sessionId: string,
  checkpoint: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const manifest = await readDatabaseValue(MANIFEST_KEY);
  if (!manifest || manifest.id !== sessionId) return;
  await storeDatabaseValue(MANIFEST_KEY, {
    ...manifest,
    export: { ...manifest.export, checkpoint, ...extra },
    updatedAt: Date.now(),
  });
}

export async function removeCancelledExportOutputs(
  sessionId: string,
): Promise<void> {
  if (typeof navigator.storage?.getDirectory !== "function") return;
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle("hostpresent-recordings", {
    create: false,
  });
  const session = await recordings.getDirectoryHandle(sessionId, {
    create: false,
  });
  await session.removeEntry("exports", { recursive: true }).catch(() => {});
}

function fragmentKey(stream: string, index: number): string {
  return `chunk:${stream}:${String(index).padStart(9, "0")}`;
}

function exportChunkKey(
  sessionId: string,
  filename: string,
  index: number,
): string {
  return `export:${sessionId}:${filename}:${String(index).padStart(9, "0")}`;
}

export function createIndexedDbOutput({
  sessionId,
  filename,
  previousChunks = 0,
}: {
  sessionId?: any;
  filename?: any;
  previousChunks?: any;
}): WorkerExportOutput {
  let chunks = 0;
  let position = 0;
  let writeQueue = Promise.resolve();
  const clear = (count: number) =>
    Promise.all(
      Array.from({ length: count }, (_, index) =>
        deleteDatabaseValue(exportChunkKey(sessionId, filename, index)),
      ),
    );

  return {
    async prepare() {
      await clear(previousChunks);
    },
    createWritable() {
      return {
        write(chunk: any) {
          const bytes = (chunk?.type === "write" ? chunk.data : chunk)?.slice();
          const chunkPosition =
            chunk?.type === "write" ? chunk.position : position;
          if (!(bytes instanceof Uint8Array)) {
            return Promise.reject(
              new Error("IndexedDB export received invalid media bytes."),
            );
          }
          if (chunkPosition !== position) {
            return Promise.reject(
              new Error("IndexedDB export requires sequential media writes."),
            );
          }
          const index = chunks;
          chunks += 1;
          position += bytes.byteLength;
          writeQueue = writeQueue.then(() =>
            storeDatabaseValue(
              exportChunkKey(sessionId, filename, index),
              bytes,
            ),
          );
          return writeQueue;
        },
        close() {
          return writeQueue;
        },
        async abort() {
          await writeQueue.catch(() => {});
          await clear(chunks);
        },
      };
    },
    getChunks() {
      return chunks;
    },
    async cancel() {
      await writeQueue.catch(() => {});
      await clear(chunks);
    },
    createSource() {
      let index = 0;
      return new ReadableStreamSource(
        new ReadableStream({
          async pull(controller) {
            if (index >= chunks) {
              controller.close();
              return;
            }
            const value = await readDatabaseValue(
              exportChunkKey(sessionId, filename, index),
            );
            index += 1;
            if (value) controller.enqueue(value);
          },
        }),
        { maxCacheSize: 1_048_576 },
      );
    },
    async readHeader() {
      const value = await readDatabaseValue(
        exportChunkKey(sessionId, filename, 0),
      );
      if (value instanceof Blob) {
        return new Uint8Array(await value.arrayBuffer());
      }
      return value instanceof Uint8Array ? value : new Uint8Array(value ?? []);
    },
  };
}

export function createOpfsOutput(
  handle: FileSystemFileHandle,
): WorkerExportOutput {
  return {
    createWritable() {
      return handle.createWritable();
    },
    async createSource() {
      return new BlobSource(await handle.getFile(), {
        maxCacheSize: 1_048_576,
      }) as unknown as ReadableStreamSource;
    },
    async readHeader() {
      const file = await handle.getFile();
      return new Uint8Array(await file.slice(0, 8).arrayBuffer());
    },
    getChunks() {
      return undefined;
    },
  };
}

export async function readExportFile(
  session: FileSystemDirectoryHandle,
  path: string,
): Promise<File> {
  const [folder, filename] = path.split("/");
  const directory = await session.getDirectoryHandle(folder);
  const handle = await directory.getFileHandle(filename);
  return handle.getFile();
}

async function readPersistedFragment(
  manifest: any,
  stream: string,
  index: number,
): Promise<any> {
  if (manifest.storage !== "opfs") {
    return readDatabaseValue(fragmentKey(stream, index));
  }
  const root = await navigator.storage.getDirectory();
  const recordings = await root.getDirectoryHandle("hostpresent-recordings");
  const session = await recordings.getDirectoryHandle(manifest.id);
  const track = await session.getDirectoryHandle(stream);
  const handle = await track.getFileHandle(fragmentKey(stream, index));
  return handle.getFile();
}

async function* persistedFragmentBytes(
  manifest: any,
  stream: string,
  start: number,
  end: number,
  isCancelled: () => boolean,
) {
  for (let index = start; index < end; index += 1) {
    if (isCancelled()) throw new Error("Recording export was cancelled.");
    const fragment = await readPersistedFragment(manifest, stream, index);
    if (!fragment?.size) continue;
    for await (const bytes of fragment.stream()) yield bytes;
  }
}

export async function readPersistedSegment(
  manifest: any,
  stream: string,
  start: number,
  end: number,
  isCancelled: () => boolean,
): Promise<Blob | null> {
  const fragments = [];
  for (let index = start; index < end; index += 1) {
    if (isCancelled()) throw new Error("Recording export was cancelled.");
    const fragment = await readPersistedFragment(manifest, stream, index);
    if (fragment?.size) fragments.push(fragment);
  }
  return fragments.length ? new Blob(fragments) : null;
}

export function sourceFromPersistedFragments(
  manifest: any,
  stream: string,
  start: number,
  end: number,
  isCancelled: () => boolean,
): ReadableStreamSource {
  const iterator = persistedFragmentBytes(
    manifest,
    stream,
    start,
    end,
    isCancelled,
  );
  return new ReadableStreamSource(
    new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await iterator.return?.();
      },
    }),
    { maxCacheSize: 1_048_576 },
  );
}

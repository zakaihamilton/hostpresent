import { getRecordingStoragePreflight } from "./recordingStorage";

const originalStorage = global.navigator.storage;

function setStorage({ opfs = true, quota, usage }) {
  Object.defineProperty(global.navigator, "storage", {
    configurable: true,
    value: {
      ...(opfs ? { getDirectory: jest.fn() } : {}),
      estimate: jest.fn().mockResolvedValue({ quota, usage }),
    },
  });
}

afterEach(() => {
  Object.defineProperty(global.navigator, "storage", {
    configurable: true,
    value: originalStorage,
  });
});

describe("getRecordingStoragePreflight", () => {
  it("enforces the safety reserve for OPFS storage", async () => {
    setStorage({ opfs: true, quota: 200, usage: 150 });

    await expect(getRecordingStoragePreflight(100)).resolves.toMatchObject({
      backend: "opfs",
      available: 50,
      allowed: false,
    });
  });

  it("allows OPFS recording when the quota reserve is available", async () => {
    setStorage({ opfs: true, quota: 500, usage: 100 });

    await expect(getRecordingStoragePreflight(100)).resolves.toMatchObject({
      backend: "opfs",
      available: 400,
      allowed: true,
    });
  });

  it("requires a known reserve for the IndexedDB fallback", async () => {
    setStorage({ opfs: false, quota: 300, usage: 250 });

    await expect(getRecordingStoragePreflight(100)).resolves.toMatchObject({
      backend: "indexeddb",
      available: 50,
      allowed: false,
    });
  });
});

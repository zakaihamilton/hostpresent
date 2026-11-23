export function setupMediaDevicesMock() {
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      enumerateDevices: jest.fn().mockResolvedValue([]),
      getDisplayMedia: jest.fn().mockResolvedValue({
        getVideoTracks: () => [],
        getAudioTracks: () => [],
        getTracks: () => [],
      }),
      getUserMedia: jest.fn().mockResolvedValue({
        getVideoTracks: () => [
          {
            getSettings: () => ({ deviceId: "" }),
            stop: jest.fn(),
            enabled: true,
          },
        ],
        getAudioTracks: () => [
          {
            getSettings: () => ({ deviceId: "" }),
            stop: jest.fn(),
            enabled: true,
          },
        ],
        getTracks: () => [],
        addTrack: jest.fn(),
        removeTrack: jest.fn(),
      }),
    },
    writable: true,
    configurable: true,
  });
}

export function createTrack(
  {
    kind,
    deviceId = "",
    id = `${kind}-${deviceId || "default"}`,
    enabled = true,
  }: {
    kind: string;
    deviceId?: string;
    id?: string;
    enabled?: boolean;
  } = {} as any,
) {
  return {
    id,
    kind,
    enabled,
    readyState: "live",
    onended: null,
    getSettings: jest.fn(() => ({ deviceId })),
    stop: jest.fn(function stop() {
      (this as any).readyState = "ended";
    }),
  };
}

export function createStream(tracks: any[] = []) {
  const streamTracks = [...tracks];
  return {
    id: `stream-${Math.random().toString(36).slice(2)}`,
    active: true,
    getTracks: jest.fn(() => [...streamTracks]),
    getAudioTracks: jest.fn(() =>
      streamTracks.filter((track) => track.kind === "audio"),
    ),
    getVideoTracks: jest.fn(() =>
      streamTracks.filter((track) => track.kind === "video"),
    ),
    addTrack: jest.fn((track) => {
      streamTracks.push(track);
    }),
    removeTrack: jest.fn((track) => {
      const index = streamTracks.indexOf(track);
      if (index >= 0) streamTracks.splice(index, 1);
    }),
  };
}

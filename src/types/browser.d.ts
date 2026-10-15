interface HostPresentFileSystemWritable extends WritableStream<unknown> {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
}

interface HostPresentFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<HostPresentFileSystemWritable>;
}

interface HostPresentDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<HostPresentDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<HostPresentFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

declare global {
  interface Window {
    __HOSTPRESENT_ENABLE_SERVICE_WORKER__?: boolean;
    showDirectoryPicker?: (options?: {
      mode?: "readwrite" | "read";
    }) => Promise<HostPresentDirectoryHandle>;
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};

export function createMediaStream() {
  return {
    id: "test-stream",
    active: true,
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
    addTrack: () => {},
    removeTrack: () => {},
  };
}

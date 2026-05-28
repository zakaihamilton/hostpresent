import "@testing-library/jest-dom";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return 400;
  },
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return 400;
  },
});

HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};

Element.prototype.scrollIntoView = () => {};

Object.defineProperty(global.navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      id: "test-stream",
      active: true,
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
      addTrack: () => {},
      removeTrack: () => {},
    }),
    getDisplayMedia: jest.fn().mockResolvedValue({
      id: "screen-stream",
      active: true,
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
      addTrack: () => {},
      removeTrack: () => {},
    }),
  },
});

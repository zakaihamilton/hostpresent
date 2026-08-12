import "@testing-library/jest-dom";
import { createMediaStream } from "./helpers";

process.env.ROOM_TOKEN_SECRET = "test-room-token-secret";


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
    getUserMedia: jest.fn().mockImplementation(async () => createMediaStream()),
    getDisplayMedia: jest.fn().mockImplementation(async () => ({
      ...createMediaStream(),
      id: "screen-stream",
    })),
  },
});


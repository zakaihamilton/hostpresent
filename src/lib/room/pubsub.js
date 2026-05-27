const GLOBAL_KEY = "__hostpresentRoomPubSub";

function getBus() {
  let bus = globalThis[GLOBAL_KEY];
  if (!bus || typeof bus !== "object") {
    bus = { subscribers: new Map() };
    globalThis[GLOBAL_KEY] = bus;
  }
  if (!(bus.subscribers instanceof Map)) {
    bus.subscribers = new Map();
  }
  return bus;
}

export function subscribeToRoom(roomId, handler) {
  const bus = getBus();
  if (!bus.subscribers.has(roomId)) {
    bus.subscribers.set(roomId, new Set());
  }
  const roomSubscribers = bus.subscribers.get(roomId);
  roomSubscribers.add(handler);

  return () => {
    roomSubscribers.delete(handler);
    if (roomSubscribers.size === 0) {
      bus.subscribers.delete(roomId);
    }
  };
}

export function publishToRoom(roomId, event) {
  const bus = getBus();
  const roomSubscribers = bus.subscribers.get(roomId);
  if (!roomSubscribers) return;

  for (const handler of roomSubscribers) {
    handler(event);
  }
}

import { act, renderHook, waitFor } from "@testing-library/react";
import { MAX_PARTICIPANT_CONNECTIONS } from "@/lib/room/peerLimits.mjs";
import { loadPeer } from "@/lib/webrtc/peerClient";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";
import { useRoomDataChannel } from "./roomDataChannel";

jest.mock("@/components/webrtc/PeerStreamConnection", () => {
  const servers = [{ urls: "stun:test" }];
  return { useIceServers: () => servers };
});
jest.mock("@/lib/webrtc/peerClient", () => ({
  ...jest.requireActual("@/lib/webrtc/peerClient"),
  loadPeer: jest.fn(),
}));
jest.mock("@/lib/webrtc/signalingConfig", () => ({
  fetchPeerJsConfig: jest.fn(),
}));

let peers;
class FakePeer {
  constructor(id) {
    this.id = id;
    this.handlers = new Map();
    this.destroy = jest.fn();
    peers.push(this);
  }
  on(event, handler) {
    this.handlers.set(event, handler);
  }
  emit(event, value) {
    this.handlers.get(event)?.(value);
  }
}

function connection(id) {
  const handlers = new Map();
  return {
    peer: id,
    open: false,
    send: jest.fn(),
    close: jest.fn(),
    on: (event, handler) => {
      const listeners = handlers.get(event) ?? [];
      handlers.set(event, [...listeners, handler]);
    },
    emit(event) {
      if (event === "open") this.open = true;
      for (const handler of handlers.get(event) ?? []) handler();
    },
  };
}

async function host() {
  const hook = renderHook(() =>
    useRoomDataChannel({
      role: "host",
      token: "room-token",
      peerAuthToken: "peer-token",
      peerId: "hp-room",
      roomId: "room",
    }),
  );
  await waitFor(() => expect(peers).toHaveLength(1));
  return hook;
}

beforeEach(() => {
  peers = [];
  jest.clearAllMocks();
  loadPeer.mockResolvedValue(FakePeer);
  fetchPeerJsConfig.mockResolvedValue({ host: "signaling.test" });
});

it("restarts the peer on every manual reconnect, including while waiting", async () => {
  const { result } = await host();
  const original = peers[0];
  act(() => original.emit("open"));
  act(() => result.current.reconnect());
  await waitFor(() => expect(peers).toHaveLength(2));
  expect(original.destroy).toHaveBeenCalledTimes(1);
  expect(peers[1].id).toBe("hp-room");
  act(() => result.current.reconnect());
  await waitFor(() => expect(peers).toHaveLength(3));
  expect(peers[1].destroy).toHaveBeenCalledTimes(1);
});

it("rejects excess guests while keeping the configured capacity connected", async () => {
  const { result } = await host();
  const admitted = Array.from({ length: MAX_PARTICIPANT_CONNECTIONS }, (_, i) =>
    connection(`pp-${i}`),
  );
  const excess = connection("pp-excess");
  act(() => {
    for (const conn of admitted) {
      peers[0].emit("connection", conn);
      conn.emit("open");
    }
    peers[0].emit("connection", excess);
    excess.emit("open");
  });
  expect(result.current.activeConnectionsCount).toBe(
    MAX_PARTICIPANT_CONNECTIONS,
  );
  expect(JSON.parse(excess.send.mock.calls[0][0]).type).toBe("room_full");
  await waitFor(() => expect(excess.close).toHaveBeenCalledTimes(1));
  for (const conn of admitted) expect(conn.close).not.toHaveBeenCalled();
});

import { createHostPresentPeerIdentity } from "./peerIdentity.mjs";

describe("Host Present Peerovo identity", () => {
  beforeEach(() => {
    process.env.ROOM_TOKEN_SECRET = "test-room-token-secret";
  });

  afterEach(() => {
    delete process.env.ROOM_TOKEN_SECRET;
  });

  it("keeps the existing stable host peer ID", () => {
    expect(
      createHostPresentPeerIdentity({
        roomId: "room-123",
        role: "host",
        sessionToken: "host-token",
      }),
    ).toEqual({ peerId: "hp-room-123" });
  });

  it("derives a private, stable participant ID per room token", () => {
    const first = createHostPresentPeerIdentity({
      roomId: "room-123",
      role: "participant",
      sessionToken: "participant-token",
    });
    const sameSession = createHostPresentPeerIdentity({
      roomId: "room-123",
      role: "participant",
      sessionToken: "participant-token",
    });
    const anotherSession = createHostPresentPeerIdentity({
      roomId: "room-123",
      role: "participant",
      sessionToken: "another-participant-token",
    });

    expect(first.peerId).toMatch(/^pp-[a-f0-9]{32}$/);
    expect(sameSession).toEqual(first);
    expect(anotherSession.peerId).not.toBe(first.peerId);
  });

  it("fails closed without a valid Host Present identity", () => {
    expect(
      createHostPresentPeerIdentity({
        roomId: "invalid/id",
        role: "host",
        sessionToken: "host-token",
      }),
    ).toBeNull();

    delete process.env.ROOM_TOKEN_SECRET;
    expect(
      createHostPresentPeerIdentity({
        roomId: "room-123",
        role: "host",
        sessionToken: "host-token",
      }),
    ).toBeNull();
  });
});

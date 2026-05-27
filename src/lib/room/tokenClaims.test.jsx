import { readRoomTokenRole } from "./tokenClaims";

function signTestToken(payload) {
  const payloadPart = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payloadPart}.fake-signature`;
}

describe("tokenClaims", () => {
  it("reads role from token payload", () => {
    const hostToken = signTestToken({
      roomId: "room-1",
      role: "host",
      exp: Date.now() + 60_000,
    });
    const participantToken = signTestToken({
      roomId: "room-1",
      role: "participant",
      exp: Date.now() + 60_000,
    });

    expect(readRoomTokenRole(hostToken)).toBe("host");
    expect(readRoomTokenRole(participantToken)).toBe("participant");
  });

  it("returns null for invalid tokens", () => {
    expect(readRoomTokenRole("")).toBeNull();
    expect(readRoomTokenRole("not-a-token")).toBeNull();
  });
});

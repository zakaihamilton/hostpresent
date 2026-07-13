import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import { ROOM_ROLE, signRoomToken, verifyRoomToken } from "@/lib/room/tokens";

jest.mock("@/lib/room/joinCode", () => ({
  createJoinCode: jest.fn(() => "ABCDEFGH"),
}));

class TestHeaders {
  constructor(init = {}) {
    this.values = new Map(
      Object.entries(init).map(([key, value]) => [
        key.toLowerCase(),
        String(value),
      ]),
    );
  }

  get(name) {
    return this.values.get(name.toLowerCase()) ?? null;
  }

  set(name, value) {
    this.values.set(name.toLowerCase(), String(value));
  }
}

class TestRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method ?? "GET";
    this.headers = new TestHeaders(init.headers);
  }
}

class TestResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.headers = new TestHeaders(init.headers);
  }

  async json() {
    return JSON.parse(this.body);
  }

  static json(body, init = {}) {
    return new TestResponse(JSON.stringify(body), init);
  }
}

function request(url, init) {
  return new TestRequest(url, init);
}

describe("stateless room API routes", () => {
  beforeAll(() => {
    global.Request = TestRequest;
    global.Response = TestResponse;
    global.Headers = TestHeaders;
  });

  beforeEach(() => {
    process.env.ROOM_TOKEN_SECRET = "test-room-token-secret";
    process.env.INTERNAL_AUTH_SECRET = "test-internal-secret";
    process.env.TURN_SECRET_KEY = "test-turn-secret";
    process.env.TURN_DOMAIN = "turn.example.test";
  });

  afterEach(() => {
    delete process.env.ROOM_TOKEN_SECRET;
  });

  it("creates only a host credential and an 8-character join code", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request("http://localhost/api/rooms", { method: "POST" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.joinCode).toBe("ABCDEFGH");
    expect(body.participantToken).toBeUndefined();
    expect(verifyRoomToken(body.hostToken)).toMatchObject({
      role: ROOM_ROLE.HOST,
      roomId: deriveRoomIdFromJoinCode(body.joinCode),
    });
  });

  it("fails closed when the room signing secret is absent", async () => {
    delete process.env.ROOM_TOKEN_SECRET;
    const { POST } = await import("./route");
    const response = await POST(
      request("http://localhost/api/rooms", { method: "POST" }),
    );
    expect(response.status).toBe(503);
  });

  it("mints a participant credential from a valid code without stored room state", async () => {
    const { GET } = await import("./resolve/route");
    const response = await GET(
      request("http://localhost/api/rooms/resolve?code=ABCD-EFGH"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(verifyRoomToken(body.participantToken)).toMatchObject({
      role: ROOM_ROLE.PARTICIPANT,
      roomId: deriveRoomIdFromJoinCode("ABCDEFGH"),
    });
  });

  it("rejects malformed and secretless participant code resolution", async () => {
    const { GET } = await import("./resolve/route");
    expect(
      (await GET(request("http://localhost/api/rooms/resolve?code=ABCDEF")))
        .status,
    ).toBe(400);
    delete process.env.ROOM_TOKEN_SECRET;
    expect(
      (await GET(request("http://localhost/api/rooms/resolve?code=ABCDEFGH")))
        .status,
    ).toBe(503);
  });

  it("returns static token claims and a scoped ICE credential", async () => {
    const roomId = deriveRoomIdFromJoinCode("ABCDEFGH");
    const token = signRoomToken({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    const { GET } = await import("./state/route");
    const response = await GET(
      request(
        `http://localhost/api/rooms/state?token=${encodeURIComponent(token)}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    expect(body.participantToken).toBeUndefined();
    expect(body.iceRoomToken).toBeTruthy();
  });

  it("accepts only a valid short-lived ICE token", async () => {
    const { GET } = await import("../media/ice-config/route");
    const roomToken = signIceRoomToken({ roomId: "room-1" });
    expect(
      (
        await GET(
          request(
            `http://localhost/api/media/ice-config?roomToken=${encodeURIComponent(roomToken)}`,
          ),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await GET(
          request("http://localhost/api/media/ice-config?roomToken=forged"),
        )
      ).status,
    ).toBe(403);
  });

  it("rejects tokens with extra signature segments", () => {
    const token = signRoomToken({
      roomId: "room-1",
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    expect(verifyRoomToken(`${token}.forged`)).toBeNull();
  });
});

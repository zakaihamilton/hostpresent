import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import {
  ROOM_ROLE,
  ROOM_TOKEN_TTL_MS,
  signRoomToken,
  verifyRoomToken,
} from "@/lib/room/tokens";

jest.mock("@/lib/room/joinCode", () => ({
  createJoinCode: jest.fn(() => "ABCDEFGHJK"),
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
    this.requestBody = init.body ?? "";
    this.body = null;
  }

  async text() {
    return this.requestBody;
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
    process.env.PEEROVO_API_URL = "https://peerovo.example.test";
    process.env.PEEROVO_PROJECT_ID = "hostpresent";
    process.env.PEEROVO_PROJECT_API_KEY =
      "test-peerovo-project-api-key-32bytes";
  });

  afterEach(() => {
    delete process.env.ROOM_TOKEN_SECRET;
    delete process.env.PEEROVO_API_URL;
    delete process.env.PEEROVO_PROJECT_ID;
    delete process.env.PEEROVO_PROJECT_API_KEY;
  });

  it("creates only a host credential and a 10-character join code", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request("http://localhost/api/rooms", { method: "POST" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.joinCode).toBe("ABCDEFGHJK");
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
    const { POST } = await import("./resolve/route");
    const response = await POST(
      request("http://localhost/api/rooms/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "ABCD-EFGH-JK" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.waiting).toBeUndefined();
    expect(verifyRoomToken(body.participantToken)).toMatchObject({
      role: ROOM_ROLE.PARTICIPANT,
      roomId: deriveRoomIdFromJoinCode("ABCDEFGHJK"),
    });
  });

  it("rejects malformed and secretless participant code resolution", async () => {
    const { POST } = await import("./resolve/route");
    const retiredCodeResponse = await POST(
      request("http://localhost/api/rooms/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "ABCDEFGH" }),
      }),
    );
    expect(retiredCodeResponse.status).toBe(410);
    expect(
      (
        await POST(
          request("http://localhost/api/rooms/resolve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: "ABCDEF" }),
          }),
        )
      ).status,
    ).toBe(400);
    delete process.env.ROOM_TOKEN_SECRET;
    expect(
      (
        await POST(
          request("http://localhost/api/rooms/resolve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: "ABCDEFGHJK" }),
          }),
        )
      ).status,
    ).toBe(503);
  });

  it("returns a Peerovo ticket bound to the verified Host Present peer", async () => {
    const roomId = deriveRoomIdFromJoinCode("ABCDEFGH");
    const token = signRoomToken({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    const roomClaims = verifyRoomToken(token);
    const peerovoExpiresAt = Math.floor(roomClaims.exp / 1000) - 20;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        projectId: "hostpresent",
        sessionId: roomId,
        peerId: `hp-${roomId}`,
        peerToken: "peerovo-peer-token",
        expiresAt: peerovoExpiresAt,
      }),
    });
    const { GET } = await import("./state/route");
    const response = await GET(
      request("http://localhost/api/rooms/state", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      roomId,
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
      peerAuthToken: "peerovo-peer-token",
      peerId: `hp-${roomId}`,
      iceConfigUrl: `https://peerovo.example.test/v1/projects/hostpresent/sessions/${roomId}/peers/hp-${roomId}/ice-config`,
    });
    expect(body.participantToken).toBeUndefined();
    expect(body.iceRoomToken).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [peerovoUrl, options] = global.fetch.mock.calls[0];
    expect(peerovoUrl).toBe(
      `https://peerovo.example.test/v1/projects/hostpresent/sessions/${roomId}/peers`,
    );
    expect(options.headers.Authorization).toBe(
      "Bearer test-peerovo-project-api-key-32bytes",
    );
    expect(JSON.parse(options.body)).toMatchObject({
      peerId: `hp-${roomId}`,
      expiresInSeconds: expect.any(Number),
    });
    expect(JSON.parse(options.body).expiresInSeconds).toBeLessThanOrEqual(
      604800,
    );
  });

  it("fails closed when Peerovo cannot issue a peer ticket", async () => {
    const token = signRoomToken({
      roomId: deriveRoomIdFromJoinCode("ABCDEFGH"),
      role: ROOM_ROLE.PARTICIPANT,
      joinCode: "ABCDEFGH",
    });
    global.fetch = jest.fn().mockRejectedValue(new Error("private details"));
    const { GET } = await import("./state/route");
    const response = await GET(
      request("http://localhost/api/rooms/state", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "WebRTC connectivity is unavailable.",
    });
  });

  it("proxies public Peerovo settings without exposing the project key", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signaling: "webrtc-peerjs",
        signalingAuthMode: "project-session-peerovo-v1",
        peerJs: {
          host: "peerovo.example.test",
          port: 443,
          path: "/",
          key: "peerjs",
          secure: true,
          debug: 0,
        },
      }),
    });
    const { GET } = await import("./config/route");
    const response = await GET(request("http://localhost/api/rooms/config"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signalingServerConfigured).toBe(true);
    expect(body.signalingAuthMode).toBe("project-session-peerovo-v1");
    expect(body.peerJs).toMatchObject({
      host: "peerovo.example.test",
      port: 443,
      secure: true,
    });
    expect(JSON.stringify(body)).not.toContain(
      "test-peerovo-project-api-key-32bytes",
    );
  });

  it("rejects tokens with extra signature segments", () => {
    const token = signRoomToken({
      roomId: "room-1",
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    expect(verifyRoomToken(`${token}.forged`)).toBeNull();
  });

  it("issues room tokens that expire after one week", () => {
    const now = Date.now();
    const token = signRoomToken({
      roomId: "room-1",
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEFGH",
    });
    const claims = verifyRoomToken(token);

    expect(claims.exp - claims.iat).toBe(ROOM_TOKEN_TTL_MS);
    expect(claims.exp).toBeGreaterThan(now);
  });
});

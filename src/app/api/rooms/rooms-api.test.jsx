import { signIceRoomToken } from "@/lib/media/iceRoomToken";
import { ROOM_ROLE, signRoomToken } from "@/lib/room/tokens";

const mockCreateRoomRecord = jest.fn();
const mockGetRoomByJoinCode = jest.fn();
const mockGetRoomById = jest.fn();
const mockRestoreRoomFromToken = jest.fn();

jest.mock("@/lib/room/apiSecurity", () => ({
  RATE_LIMITS: {
    createRoom: {},
    resolve: {},
    state: {},
  },
  applySecurityHeaders: (response) => response,
  guardGetRequest: jest.fn().mockResolvedValue(null),
  guardPostRequest: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/room/joinCode", () => ({
  createJoinCode: jest.fn(() => "ABCDEF"),
}));

jest.mock("@/lib/room/store", () => ({
  ROOM_STATUS: {
    OPEN: "open",
  },
  createRoomRecord: (...args) => mockCreateRoomRecord(...args),
  getRoomByJoinCode: (...args) => mockGetRoomByJoinCode(...args),
  getRoomById: (...args) => mockGetRoomById(...args),
  restoreRoomFromToken: (...args) => mockRestoreRoomFromToken(...args),
}));

async function readJson(response) {
  return response.json();
}

function request(url, init) {
  return new Request(url, init);
}

function installWebApiDoubles() {
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
  }

  class TestRequest {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method ?? "GET";
      this.headers =
        init.headers instanceof TestHeaders
          ? init.headers
          : new TestHeaders(init.headers);
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

  global.Request = TestRequest;
  global.Response = TestResponse;
  global.Headers = TestHeaders;
}

beforeAll(() => {
  installWebApiDoubles();
});

describe("room API routes", () => {
  beforeAll(() => {
    installWebApiDoubles();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_AUTH_SECRET = "test-internal-secret";
    process.env.TURN_SECRET_KEY = "test-turn-secret";
    process.env.TURN_DOMAIN = "turn.example.test";
  });

  it("creates a room with host and participant tokens", async () => {
    const { POST } = await import("./route");
    mockCreateRoomRecord.mockImplementation(async (room) => room);

    const response = await POST(
      request("http://localhost/api/rooms", { method: "POST" }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.roomId).toBeTruthy();
    expect(body.joinCode).toBe("ABCDEF");
    expect(body.hostToken).toContain(".");
    expect(body.participantToken).toContain(".");
    expect(mockCreateRoomRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: body.roomId,
        joinCode: "ABCDEF",
        hostToken: body.hostToken,
        participantToken: body.participantToken,
      }),
    );
  });

  it("rejects invalid join code resolution", async () => {
    const { GET } = await import("./resolve/route");

    const response = await GET(
      request("http://localhost/api/rooms/resolve?code=nope"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("[E075] Invalid join code");
    expect(mockGetRoomByJoinCode).not.toHaveBeenCalled();
  });

  it("resolves a valid join code to participant room data", async () => {
    const { GET } = await import("./resolve/route");
    mockGetRoomByJoinCode.mockResolvedValue({
      roomId: "room-1",
      joinCode: "ABCDEF",
      participantToken: "participant-token",
    });

    const response = await GET(
      request("http://localhost/api/rooms/resolve?code=abc-def"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      roomId: "room-1",
      joinCode: "ABCDEF",
      participantToken: "participant-token",
      status: "open",
    });
  });

  it("returns not found for valid but unknown join codes", async () => {
    const { GET } = await import("./resolve/route");
    mockGetRoomByJoinCode.mockResolvedValue(null);

    const response = await GET(
      request("http://localhost/api/rooms/resolve?code=ABCDEF"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("[E076] Room not found");
  });

  it("returns host-only state with participant token", async () => {
    const { GET } = await import("./state/route");
    const hostToken = signRoomToken({
      roomId: "room-1",
      role: ROOM_ROLE.HOST,
      joinCode: "ABCDEF",
    });
    mockGetRoomById.mockResolvedValue({
      roomId: "room-1",
      joinCode: "ABCDEF",
      participantToken: "participant-token",
      openedAt: 1,
      createdAt: 1,
    });

    const response = await GET(
      request(
        `http://localhost/api/rooms/state?token=${encodeURIComponent(hostToken)}`,
      ),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        roomId: "room-1",
        role: ROOM_ROLE.HOST,
        joinCode: "ABCDEF",
        participantToken: "participant-token",
        status: "open",
      }),
    );
    expect(body.iceRoomToken).toBeTruthy();
  });

  it("returns participant state without host-only participant token", async () => {
    const { GET } = await import("./state/route");
    const participantToken = signRoomToken({
      roomId: "room-2",
      role: ROOM_ROLE.PARTICIPANT,
      joinCode: "DEF456",
    });
    mockGetRoomById.mockResolvedValue({
      roomId: "room-2",
      joinCode: "DEF456",
      participantToken,
      openedAt: 1,
      createdAt: 1,
    });

    const response = await GET(
      request(
        `http://localhost/api/rooms/state?token=${encodeURIComponent(participantToken)}`,
      ),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.role).toBe(ROOM_ROLE.PARTICIPANT);
    expect(body.participantToken).toBeUndefined();
  });

  it("rejects invalid state tokens", async () => {
    const { GET } = await import("./state/route");

    const response = await GET(
      request("http://localhost/api/rooms/state?token=not-a-token"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("[E066] Invalid token");
  });
});

describe("media ICE config API route", () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  afterAll(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  beforeEach(() => {
    process.env.INTERNAL_AUTH_SECRET = "test-internal-secret";
    process.env.TURN_SECRET_KEY = "test-turn-secret";
    process.env.TURN_DOMAIN = "turn.example.test";
  });

  it("rejects missing room token", async () => {
    const { GET } = await import("../media/ice-config/route");

    const response = await GET(
      request("http://localhost/api/media/ice-config"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body.error).toBe("Access denied.");
  });

  it("rejects invalid room token", async () => {
    const { GET } = await import("../media/ice-config/route");

    const response = await GET(
      request("http://localhost/api/media/ice-config?roomToken=bad"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body.error).toBe("Access denied.");
  });

  it("returns STUN and TURN servers for a valid room token", async () => {
    const { GET } = await import("../media/ice-config/route");
    const roomToken = signIceRoomToken({ roomId: "room-1" });

    const response = await GET(
      request(
        `http://localhost/api/media/ice-config?roomToken=${encodeURIComponent(roomToken)}`,
      ),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.iceServers).toEqual(
      expect.arrayContaining([
        { urls: "stun:stun.l.google.com:19302" },
        expect.objectContaining({
          urls: "turn:turn.example.test:443?transport=udp",
          username: expect.stringContaining(":room-1"),
          credential: expect.any(String),
        }),
        expect.objectContaining({
          urls: "turns:turn.example.test:443?transport=tcp",
        }),
      ]),
    );
  });
});

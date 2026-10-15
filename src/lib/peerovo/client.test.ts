import {
  fetchPeerovoPublicConfig,
  getPeerovoIceConfigUrl,
  getPeerovoSettings,
  issuePeerovoPeerToken,
} from "./client";

const ORIGINAL_ENV = {
  apiUrl: process.env.PEEROVO_API_URL,
  projectId: process.env.PEEROVO_PROJECT_ID,
  projectApiKey: process.env.PEEROVO_PROJECT_API_KEY,
  nodeEnv: process.env.NODE_ENV,
};

describe("Peerovo client", () => {
  beforeEach(() => {
    process.env.PEEROVO_API_URL = "https://peerovo.example.test";
    process.env.PEEROVO_PROJECT_ID = "hostpresent";
    process.env.PEEROVO_PROJECT_API_KEY = "a".repeat(40);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    for (const [key, value] of [
      ["PEEROVO_API_URL", ORIGINAL_ENV.apiUrl],
      ["PEEROVO_PROJECT_ID", ORIGINAL_ENV.projectId],
      ["PEEROVO_PROJECT_API_KEY", ORIGINAL_ENV.projectApiKey],
      ["NODE_ENV", ORIGINAL_ENV.nodeEnv],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rejects invalid and non-HTTPS production service URLs", () => {
    expect(
      getPeerovoSettings({ ...process.env, PEEROVO_PROJECT_ID: "bad/id" }),
    ).toBeNull();
    expect(
      getPeerovoSettings({
        ...process.env,
        NODE_ENV: "production",
        PEEROVO_API_URL: "http://127.0.0.1:9000",
      }),
    ).toBeNull();
    expect(
      getPeerovoSettings({
        ...process.env,
        PEEROVO_PROJECT_API_KEY: "short",
      }),
    ).toBeNull();
  });

  it("builds an exact project/session/peer ICE URL without credentials", () => {
    expect(
      getPeerovoIceConfigUrl({
        sessionId: "session-123",
        peerId: "hp-session-123",
      }),
    ).toBe(
      "https://peerovo.example.test/v1/projects/hostpresent/sessions/session-123/peers/hp-session-123/ice-config",
    );
  });

  it("fetches public Peerovo settings without sending the project key", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signalingAuthMode: "project-session-peerovo-v1",
        peerJs: {
          host: "peerovo.example.test",
          port: 443,
          path: "/",
          key: "peerjs",
          secure: true,
        },
      }),
    });
    global.fetch = fetchSpy;

    const config = await fetchPeerovoPublicConfig();

    expect(config.peerJs.host).toBe("peerovo.example.test");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://peerovo.example.test/v1/config",
      expect.objectContaining({
        cache: "no-store",
        redirect: "error",
      }),
    );
    expect(fetchSpy.mock.calls[0][1].headers).toBeUndefined();
  });

  it("sends the server-only project key and bounds ticket life to the room token", async () => {
    const now = Date.now();
    const sessionExpiresAt = now + 600_000;
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 201,
      json: async () => ({
        projectId: "hostpresent",
        sessionId: "session-123",
        peerId: "pp-abc123",
        peerToken: "signed-peer-token",
        expiresAt: Math.floor((now + 500_000) / 1000),
      }),
    });
    global.fetch = fetchSpy;

    const ticket = await issuePeerovoPeerToken({
      sessionId: "session-123",
      peerId: "pp-abc123",
      sessionExpiresAt,
    });

    expect(ticket.peerToken).toBe("signed-peer-token");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://peerovo.example.test/v1/projects/hostpresent/sessions/session-123/peers",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${"a".repeat(40)}`,
          "Content-Type": "application/json",
        },
      }),
    );
    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(requestBody.peerId).toBe("pp-abc123");
    expect(requestBody.expiresInSeconds).toBeLessThan(600);
    expect(requestBody.expiresInSeconds).toBeGreaterThan(0);
  });

  it("rejects a Peerovo ticket scoped to another peer", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 201,
      json: async () => ({
        projectId: "hostpresent",
        sessionId: "session-123",
        peerId: "different-peer",
        peerToken: "signed-peer-token",
        expiresAt: Math.floor((Date.now() + 500_000) / 1000),
      }),
    });

    await expect(
      issuePeerovoPeerToken({
        sessionId: "session-123",
        peerId: "pp-abc123",
        sessionExpiresAt: Date.now() + 600_000,
      }),
    ).rejects.toMatchObject({ reason: "invalid_ticket_response" });
  });
});

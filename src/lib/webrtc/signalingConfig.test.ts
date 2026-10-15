import { fetchIceServers, fetchPeerJsConfig } from "./signalingConfig";

describe("Peerovo browser configuration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it("fetches ICE settings from Peerovo with the exact peer token in a header", async () => {
    const fetchSpy = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        iceServers: [
          { urls: "stun:stun.example.test:3478" },
          {
            urls: "turn:turn.example.test:443?transport=udp",
            username: "username",
            credential: "credential",
          },
        ],
      }),
    });
    global.fetch = fetchSpy;

    const iceConfigUrl =
      "https://peerovo.example.test/v1/projects/hostpresent/sessions/session-123/peers/pp-123/ice-config";
    const iceServers = await fetchIceServers("peer-token", iceConfigUrl);

    expect(iceServers).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(iceConfigUrl);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      mode: "cors",
      redirect: "error",
      headers: { Authorization: "Bearer peer-token" },
    });
    expect(fetchSpy.mock.calls[0][0]).not.toContain("peer-token");
  });

  it("rejects a ticket URL with query parameters before sending the token", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        peerAuthToken: "peer-token",
        iceConfigUrl:
          "https://peerovo.example.test/ice-config?token=peer-token",
      }),
    });
    global.fetch = fetchSpy;

    await expect(
      fetchIceServers(
        "peer-token",
        "https://peerovo.example.test/ice-config?token=peer-token",
      ),
    ).rejects.toThrow("Could not load secure streaming configuration.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires the project/session/peer Peerovo authentication mode", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signalingServerConfigured: true,
        signalingAuthMode: "room-token-v1",
        peerJs: { host: "peerovo.example.test", port: 443, secure: true },
      }),
    });

    await expect(fetchPeerJsConfig()).rejects.toThrow(
      "[E084] Authenticated signaling is not configured.",
    );
  });
});

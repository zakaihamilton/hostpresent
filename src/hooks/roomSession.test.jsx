import { act, renderHook, waitFor } from "@testing-library/react";
import { ROOM_SESSION_STATUS, useRoomSession } from "./roomSession";

const removeParticipantRoomByToken = jest.fn();
const removeHostRoomByToken = jest.fn();
const saveRoom = jest.fn();
const setActiveHostToken = jest.fn();

jest.mock("@/lib/settings/participantRoomSettings", () => ({
  removeParticipantRoomByToken: (...args) =>
    removeParticipantRoomByToken(...args),
}));

jest.mock("@/lib/settings/roomSettings", () => ({
  getActiveRoom: jest.fn(),
  getRoomByHostToken: jest.fn(),
  listHostRooms: jest.fn(() => []),
  removeHostRoomByToken: (...args) => removeHostRoomByToken(...args),
  saveRoom: (...args) => saveRoom(...args),
  setActiveHostToken: (...args) => setActiveHostToken(...args),
  touchHostRoom: jest.fn(),
}));

function jsonResponse(body, init = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("useRoomSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("stays idle when disabled or missing a token", () => {
    const { result, rerender } = renderHook((props) => useRoomSession(props), {
      initialProps: { role: "participant", token: null, enabled: true },
    });

    expect(result.current.status).toBe(ROOM_SESSION_STATUS.IDLE);
    expect(result.current.roomState).toBeNull();

    rerender({ role: "participant", token: "token-1", enabled: false });

    expect(result.current.status).toBe(ROOM_SESSION_STATUS.IDLE);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads room state for a valid token", async () => {
    fetch.mockResolvedValue(
      jsonResponse({
        roomId: "room-1",
        role: "participant",
        status: "open",
      }),
    );

    const { result } = renderHook(() =>
      useRoomSession({
        role: "participant",
        token: "participant-token",
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe(ROOM_SESSION_STATUS.OPEN);
    });
    expect(result.current.roomState).toEqual(
      expect.objectContaining({ roomId: "room-1" }),
    );
  });

  it("surfaces network failures as user-facing errors", async () => {
    fetch.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() =>
      useRoomSession({
        role: "participant",
        token: "participant-token",
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe(ROOM_SESSION_STATUS.ERROR);
    });
    expect(result.current.error).toBe(
      "[E023] Could not reach the server. Check your connection.",
    );
  });

  it("removes cached room tokens on 401", async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 401 }));

    const { result } = renderHook(() =>
      useRoomSession({
        role: "host",
        token: "expired-token",
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe(ROOM_SESSION_STATUS.ERROR);
    });
    expect(removeHostRoomByToken).toHaveBeenCalledWith("expired-token");
    expect(removeParticipantRoomByToken).toHaveBeenCalledWith("expired-token");
    expect(result.current.error).toBe(
      "[E021] This room link is no longer valid. Create a new room from the host welcome screen.",
    );
  });

  it("surfaces room missing errors on 404", async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 404 }));

    const { result } = renderHook(() =>
      useRoomSession({
        role: "participant",
        token: "missing-room-token",
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe(ROOM_SESSION_STATUS.ERROR);
    });
    expect(result.current.error).toBe(
      "[E022] Room not found. It may have expired.",
    );
  });

  it("creates and persists a new host room", async () => {
    const created = {
      roomId: "room-new",
      hostToken: "host-token",
      participantToken: "participant-token",
      joinCode: "ABC123",
    };
    fetch.mockResolvedValue(jsonResponse(created));

    const { result } = renderHook(() =>
      useRoomSession({
        role: "host",
        token: null,
        enabled: false,
      }),
    );

    await act(async () => {
      await expect(result.current.createRoom()).resolves.toEqual(created);
    });

    expect(fetch).toHaveBeenCalledWith("/api/rooms", { method: "POST" });
    expect(saveRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-new",
        hostToken: "host-token",
        participantToken: "participant-token",
        joinCode: "ABC123",
      }),
    );
    expect(setActiveHostToken).toHaveBeenCalledWith("host-token");
    expect(result.current.status).toBe(ROOM_SESSION_STATUS.OPEN);
  });
});

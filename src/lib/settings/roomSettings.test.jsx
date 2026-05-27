import {
  clearHostRooms,
  getRoomByJoinCode,
  listHostRooms,
  saveRoom,
  touchHostRoom,
} from "./roomSettings";

describe("roomSettings", () => {
  beforeEach(() => {
    clearHostRooms();
  });

  it("dedupes recent rooms by join code when listing", () => {
    window.localStorage.setItem(
      "hostpresent.rooms",
      JSON.stringify({
        activeHostToken: "token-new",
        rooms: [
          {
            roomId: "room-1",
            hostToken: "token-old",
            participantToken: "participant-old",
            joinCode: "ABCD-EFGH",
            createdAt: 1000,
            lastUsedAt: 2000,
          },
          {
            roomId: "room-1",
            hostToken: "token-new",
            participantToken: "participant-new",
            joinCode: "abcd-efgh",
            createdAt: 3000,
            lastUsedAt: 4000,
          },
        ],
      }),
    );

    expect(listHostRooms()).toHaveLength(1);
    expect(listHostRooms()[0].hostToken).toBe("token-new");
  });

  it("replaces an older entry when saving the same join code with a new token", () => {
    saveRoom({
      roomId: "room-1",
      hostToken: "token-old",
      participantToken: "participant-old",
      joinCode: "ABCD-EFGH",
      createdAt: 1000,
    });

    saveRoom({
      roomId: "room-1",
      hostToken: "token-new",
      participantToken: "participant-new",
      joinCode: "abcd-efgh",
    });

    expect(listHostRooms()).toHaveLength(1);
    expect(listHostRooms()[0].hostToken).toBe("token-new");
    expect(getRoomByJoinCode("ABCD-EFGH")?.hostToken).toBe("token-new");
  });

  it("dedupes stored rooms when touching a host room", () => {
    window.localStorage.setItem(
      "hostpresent.rooms",
      JSON.stringify({
        activeHostToken: "token-old",
        rooms: [
          {
            roomId: "room-1",
            hostToken: "token-old",
            participantToken: "participant-old",
            joinCode: "ABCD-EFGH",
            createdAt: 1000,
            lastUsedAt: 2000,
          },
          {
            roomId: "room-1",
            hostToken: "token-new",
            participantToken: "participant-new",
            joinCode: "ABCD-EFGH",
            createdAt: 3000,
            lastUsedAt: 1000,
          },
        ],
      }),
    );

    touchHostRoom("token-old");

    expect(listHostRooms()).toHaveLength(1);
    expect(listHostRooms()[0].hostToken).toBe("token-old");
  });
});

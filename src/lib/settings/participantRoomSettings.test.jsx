import {
  clearParticipantRooms,
  listParticipantRooms,
  saveParticipantRoom,
} from "./participantRoomSettings";

describe("participantRoomSettings", () => {
  beforeEach(() => {
    clearParticipantRooms();
  });

  it("dedupes recent rooms by join code when listing", () => {
    window.localStorage.setItem(
      "hostpresent.participantRooms",
      JSON.stringify({
        activeParticipantToken: "token-new",
        rooms: [
          {
            roomId: "room-1",
            participantToken: "token-old",
            joinCode: "WXYZ-1234",
            createdAt: 1000,
            lastJoinedAt: 2000,
          },
          {
            roomId: "room-1",
            participantToken: "token-new",
            joinCode: "wxyz-1234",
            createdAt: 3000,
            lastJoinedAt: 4000,
          },
        ],
      }),
    );

    expect(listParticipantRooms()).toHaveLength(1);
    expect(listParticipantRooms()[0].participantToken).toBe("token-new");
  });

  it("replaces an older entry when saving the same join code with a new token", () => {
    saveParticipantRoom({
      roomId: "room-1",
      participantToken: "token-old",
      joinCode: "WXYZ-1234",
    });

    saveParticipantRoom({
      roomId: "room-1",
      participantToken: "token-new",
      joinCode: "wxyz-1234",
    });

    expect(listParticipantRooms()).toHaveLength(1);
    expect(listParticipantRooms()[0].participantToken).toBe("token-new");
  });
});

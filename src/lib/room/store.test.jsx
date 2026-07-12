describe("room store waiting room and kick denylist", () => {
  beforeEach(() => {
    delete globalThis.__hostpresentRoomStore;
    jest.resetModules();
  });

  it("creates rooms in waiting status until opened", async () => {
    const {
      createRoomRecord,
      getRoomByJoinCode,
      openRoom,
      ROOM_STATUS,
    } = await import("./store.js");
    const { deriveRoomIdFromJoinCode } = await import("./roomIdentity.js");

    const joinCode = "ABCDEF";
    const roomId = deriveRoomIdFromJoinCode(joinCode);
    const room = await createRoomRecord({
      roomId,
      joinCode,
      hostToken: "host",
      participantToken: "guest",
    });

    expect(room.status).toBe(ROOM_STATUS.WAITING);
    expect(room.openedAt).toBeNull();

    const fetched = await getRoomByJoinCode(joinCode);
    expect(fetched.status).toBe(ROOM_STATUS.WAITING);
    expect(fetched.roomId).toBe(roomId);

    const opened = await openRoom(roomId, { joinCode });
    expect(opened.status).toBe(ROOM_STATUS.OPEN);
    expect(opened.openedAt).toBeTruthy();
  });

  it("records kicked device ids for the room", async () => {
    const {
      createRoomRecord,
      getRoomByJoinCode,
      isDeviceKickedFromRoom,
      kickDeviceFromRoom,
      openRoom,
    } = await import("./store.js");
    const { deriveRoomIdFromJoinCode } = await import("./roomIdentity.js");

    const joinCode = "GHIJKL";
    const roomId = deriveRoomIdFromJoinCode(joinCode);
    await createRoomRecord({
      roomId,
      joinCode,
      hostToken: "host",
      participantToken: "guest",
    });
    await openRoom(roomId, { joinCode });
    await kickDeviceFromRoom(roomId, "device-1", { joinCode });

    const room = await getRoomByJoinCode(joinCode);
    expect(isDeviceKickedFromRoom(room, "device-1")).toBe(true);
    expect(isDeviceKickedFromRoom(room, "device-2")).toBe(false);
  });
});

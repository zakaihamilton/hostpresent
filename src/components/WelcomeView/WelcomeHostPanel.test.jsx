import { render, screen, waitFor } from "@testing-library/react";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { WelcomeHostPanel } from "./WelcomeHostPanel";

const createdRoom = {
  roomId: "room-1",
  hostToken: "host-token",
  participantToken: "participant-token",
  joinCode: "ABCDEFGH",
};

jest.mock("@/hooks/roomSession", () => ({
  ROOM_SESSION_STATUS: {
    IDLE: "idle",
    LOADING: "loading",
    WAITING: "waiting",
    OPEN: "open",
    ERROR: "error",
  },
  useRoomSession: () => ({
    status: "waiting",
    roomState: { joinCode: "ABCDEFGH" },
    error: "",
    createRoom: jest.fn().mockResolvedValue(createdRoom),
    refreshState: jest.fn(),
  }),
  useRoomSettings: () => ({
    getSavedRoom: () => null,
    persistRoom: jest.fn(),
    getRecentHostRooms: () => [],
    markHostRoomUsed: jest.fn(),
  }),
}));

jest.mock("@/lib/settings/roomSettings", () => ({
  clearHostRooms: jest.fn(),
  formatRoomLabel: () => "Room",
  getRoomByHostToken: () => null,
  getRoomByJoinCode: () => createdRoom,
  listHostRooms: () => [],
}));

describe("WelcomeHostPanel", () => {
  it("shows room id and invite link for saved room", async () => {
    render(
      <WelcomeHostPanel
        joinCode="ABCDEFGH"
        legacyToken={null}
        navigate={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Room ID")).toHaveValue("ABCD-EFGH");
    });

    expect(screen.getByLabelText("Participant invite link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join meeting" })).toBeEnabled();
  });
});

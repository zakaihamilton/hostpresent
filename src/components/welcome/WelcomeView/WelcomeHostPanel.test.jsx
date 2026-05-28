import { render, screen, waitFor, act } from "@testing-library/react";
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
    getSavedRoom: () => createdRoom,
    persistRoom: jest.fn(),
    getRecentHostRooms: () => [],
    markHostRoomUsed: jest.fn(),
  }),
}));

jest.mock("@/lib/settings/roomSettings", () => ({
  clearHostRooms: jest.fn(),
  formatRoomLabel: () => "Room",
  getRoomByHostToken: () => null,
  listHostRooms: () => [],
}));

describe("WelcomeHostPanel", () => {
  it("shows join code boxes and invite link for saved room", async () => {
    render(<WelcomeHostPanel legacyToken={null} navigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Character 1")).toHaveValue("A");
    });

    expect(screen.getByLabelText("Character 8")).toHaveValue("H");
    expect(screen.getByRole("button", { name: /Copy code/ })).toBeInTheDocument();
  });

  it("navigates to the meeting with host token when join meeting is clicked", async () => {
    const navigate = jest.fn();

    render(<WelcomeHostPanel legacyToken={null} navigate={navigate} />);

    await waitFor(() => {
      expect(
         screen.getByRole("button", { name: "Join meeting" }),
      ).toBeEnabled();
    });

    await act(async () => {
      screen.getByRole("button", { name: "Join meeting" }).click();
    });

    expect(navigate).toHaveBeenCalledWith({
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: "host-token",
    });
  });
});

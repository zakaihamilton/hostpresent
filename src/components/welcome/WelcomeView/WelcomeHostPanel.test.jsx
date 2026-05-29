import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    const user = userEvent.setup();
    render(<WelcomeHostPanel legacyToken={null} navigate={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Room Code" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Character 1")).toHaveValue("A");
    });

    expect(screen.getByLabelText("Character 8")).toHaveValue("H");
    expect(
      screen.getByRole("button", { name: "Copy room code" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Invite Link" }));
    expect(
      screen.getByRole("button", { name: "Copy invite link" }),
    ).toBeInTheDocument();
  });

  it("navigates to the meeting with host token when start meeting is clicked", async () => {
    const navigate = jest.fn();

    render(<WelcomeHostPanel legacyToken={null} navigate={navigate} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Start meeting" }),
      ).toBeEnabled();
    });

    await act(async () => {
      screen.getByRole("button", { name: "Start meeting" }).click();
    });

    expect(navigate).toHaveBeenCalledWith({
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: "host-token",
    });
  });
});

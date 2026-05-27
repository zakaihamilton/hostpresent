import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeParticipantPanel } from "./WelcomeParticipantPanel";

jest.mock("@/hooks/useRoomSession", () => ({
  ROOM_SESSION_STATUS: {
    IDLE: "idle",
    LOADING: "loading",
    WAITING: "waiting",
    OPEN: "open",
    ERROR: "error",
  },
  useRoomSession: () => ({
    status: "idle",
    roomState: null,
    error: "",
  }),
}));

jest.mock("@/lib/room/inviteLink", () => ({
  extractJoinCodeFromInput: () => "",
  normalizeRoomIdInput: (value) => value.trim().toUpperCase(),
  resolveJoinCode: jest.fn(),
}));

jest.mock("@/lib/settings/participantRoomSettings", () => ({
  clearParticipantRooms: jest.fn(),
  formatParticipantRoomLabel: () => "Past room",
  getParticipantRoomByToken: () => null,
  listParticipantRooms: () => [],
  saveParticipantRoom: jest.fn(),
  touchParticipantRoom: jest.fn(),
}));

describe("WelcomeParticipantPanel", () => {
  it("shows room id entry form", () => {
    render(
      <WelcomeParticipantPanel
        token={null}
        joinCode={null}
        navigate={() => {}}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    expect(screen.getByLabelText("Room ID")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join with room ID" }),
    ).toBeDisabled();
  });

  it("enables join when room id is entered", async () => {
    const user = userEvent.setup();
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGH",
    });

    render(
      <WelcomeParticipantPanel
        token={null}
        joinCode={null}
        navigate={() => {}}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("Room ID"), "ABCD-EFGH");
    expect(
      screen.getByRole("button", { name: "Join with room ID" }),
    ).toBeEnabled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeParticipantPanel } from "./WelcomeParticipantPanel";

jest.mock("@/hooks/roomSession", () => ({
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
  formatRoomIdInput: (value) =>
    value
      .replace(/[\s-]+/g, "")
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join("-") ?? "",
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

  it("does not auto-join from route join code on the welcome tab", async () => {
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGH",
    });

    render(
      <WelcomeParticipantPanel
        token={null}
        joinCode="ABCDEFGH"
        autoJoinFromRoute={false}
        navigate={() => {}}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    expect(screen.getByLabelText("Room ID")).toHaveValue("ABCD-EFGH");
    expect(screen.queryByText("Joining meeting…")).not.toBeInTheDocument();
    expect(resolveJoinCode).not.toHaveBeenCalled();
  });

  it("auto-joins when opened from an invite link route", async () => {
    const navigate = jest.fn();
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGH",
    });

    render(
      <WelcomeParticipantPanel
        token={null}
        joinCode="ABCDEFGH"
        autoJoinFromRoute
        navigate={navigate}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    await waitFor(() => {
      expect(resolveJoinCode).toHaveBeenCalledWith("ABCDEFGH");
    });
    expect(navigate).toHaveBeenCalledWith({
      view: "meeting",
      role: "participant",
      joinCode: "ABCDEFGH",
    });
  });

  it("uppercases room id while typing", async () => {
    const user = userEvent.setup();

    render(
      <WelcomeParticipantPanel
        token={null}
        joinCode={null}
        navigate={() => {}}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    const input = screen.getByLabelText("Room ID");
    await user.type(input, "abcd-efgh");
    expect(input).toHaveValue("ABCD-EFGH");
  });
});

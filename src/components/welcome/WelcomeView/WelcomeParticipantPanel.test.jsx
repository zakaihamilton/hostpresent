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

const defaultProps = {
  token: null,
  joinCode: null,
  navigate: () => {},
};

describe("WelcomeParticipantPanel", () => {
  it("shows code entry boxes", async () => {
    render(<WelcomeParticipantPanel {...defaultProps} />);

    expect(screen.getByLabelText("Character 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 6")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 10")).toBeInTheDocument();
    expect(
      document.querySelector('label[for="join-code-box-0"]'),
    ).toHaveTextContent("Room code");
    expect(screen.getByRole("button", { name: "Join meeting" })).toBeDisabled();
  });

  it("rejects expired 8-character codes and accepts new 10-character codes", async () => {
    const user = userEvent.setup();
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGHJK",
    });

    render(<WelcomeParticipantPanel {...defaultProps} />);

    for (let i = 0; i < 6; i++) {
      const char = String.fromCharCode(65 + i);
      await user.type(screen.getByLabelText(`Character ${i + 1}`), char);
    }

    expect(screen.getByRole("button", { name: "Join meeting" })).toBeDisabled();

    for (const [index, character] of ["G", "H"].entries()) {
      await user.type(
        screen.getByLabelText(`Character ${index + 7}`),
        character,
      );
    }

    expect(
      screen.getByText(/8-character invite has expired/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join meeting" })).toBeDisabled();

    for (const [index, character] of ["J", "K"].entries()) {
      await user.type(
        screen.getByLabelText(`Character ${index + 9}`),
        character,
      );
    }
    expect(screen.getByRole("button", { name: "Join meeting" })).toBeEnabled();
  });

  it("does not auto-join from route join code on the welcome tab", async () => {
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGHJK",
    });

    render(
      <WelcomeParticipantPanel
        {...defaultProps}
        joinCode="ABCDEFGHJK"
        autoJoinFromRoute={false}
      />,
    );

    expect(screen.getByLabelText("Character 1")).toHaveValue("A");
    expect(screen.getByLabelText("Character 5")).toHaveValue("E");
    expect(screen.queryByText("Joining meeting…")).not.toBeInTheDocument();
    expect(resolveJoinCode).not.toHaveBeenCalled();
  });

  it("auto-joins when opened from an invite link route", async () => {
    const navigate = jest.fn();
    const { resolveJoinCode } = await import("@/lib/room/inviteLink");
    resolveJoinCode.mockResolvedValue({
      roomId: "room-1",
      participantToken: "participant-token",
      joinCode: "ABCDEFGHJK",
    });

    render(
      <WelcomeParticipantPanel
        {...defaultProps}
        joinCode="ABCDEFGHJK"
        autoJoinFromRoute
        navigate={navigate}
      />,
    );

    await waitFor(() => {
      expect(resolveJoinCode).toHaveBeenCalledWith(
        "ABCDEFGHJK",
        expect.objectContaining({ deviceId: expect.any(String) }),
      );
    });
    expect(navigate).toHaveBeenCalledWith({
      view: "meeting",
      role: "participant",
      joinCode: "ABCDEFGHJK",
    });
  });

  it("uppercases join code characters while typing", async () => {
    const user = userEvent.setup();

    render(<WelcomeParticipantPanel {...defaultProps} />);

    const box1 = screen.getByLabelText("Character 1");
    await user.type(box1, "a");
    expect(box1).toHaveValue("A");
  });
});

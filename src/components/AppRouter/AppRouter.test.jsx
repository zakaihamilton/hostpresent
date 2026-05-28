import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { AppRouter } from "./AppRouter";

jest.mock("@/components/WelcomeView", () => ({
  WelcomeView: () => <div data-testid="welcome-view">Welcome</div>,
}));

jest.mock("@/components/MeetingView", () => ({
  MeetingView: ({ role, onBack }) => (
    <div data-testid="meeting-view">
      Meeting {role}
      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

jest.mock("@/hooks/hashRouter", () => ({
  APP_ROLE: { HOST: "host", PARTICIPANT: "participant" },
  APP_VIEW: { WELCOME: "welcome", MEETING: "meeting", JOIN: "join" },
  useHashRouter: jest.fn(),
}));

jest.mock("@/hooks/routeToken", () => ({
  useRouteToken: jest.fn(() => ({ token: null, loading: false, error: "" })),
}));

jest.mock("@/hooks/roomSession", () => ({
  ROOM_SESSION_STATUS: {
    IDLE: "idle",
    LOADING: "loading",
    WAITING: "waiting",
    OPEN: "open",
    ERROR: "error",
  },
  useRoomSession: () => ({ status: "open" }),
}));

describe("AppRouter", () => {
  it("renders welcome view", async () => {
    const { useHashRouter } = await import("@/hooks/hashRouter");
    useHashRouter.mockReturnValue({
      ready: true,
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.HOST,
      token: null,
      joinCode: null,
      navigate: jest.fn(),
      navigateJoinCode: jest.fn(),
      navigateParticipantWelcome: jest.fn(),
    });

    render(<AppRouter />);
    expect(screen.getByTestId("welcome-view")).toBeInTheDocument();
  });

  it("renders meeting view for host", async () => {
    const { useHashRouter } = await import("@/hooks/hashRouter");
    const { useRouteToken } = await import("@/hooks/routeToken");

    useHashRouter.mockReturnValue({
      ready: true,
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: null,
      joinCode: "ABCDEFGH",
      navigate: jest.fn(),
      navigateJoinCode: jest.fn(),
      navigateParticipantWelcome: jest.fn(),
    });
    useRouteToken.mockReturnValue({
      token: "host-token",
      loading: false,
      error: "",
    });

    render(<AppRouter />);
    expect(screen.getByTestId("meeting-view")).toHaveTextContent(
      "Meeting host",
    );
  });

  it("returns participants to the join screen from meeting", async () => {
    const user = userEvent.setup();
    const { useHashRouter } = await import("@/hooks/hashRouter");
    const { useRouteToken } = await import("@/hooks/routeToken");
    const navigateParticipantWelcome = jest.fn();

    useHashRouter.mockReturnValue({
      ready: true,
      view: APP_VIEW.MEETING,
      role: APP_ROLE.PARTICIPANT,
      token: null,
      joinCode: "ABCDEFGH",
      navigate: jest.fn(),
      navigateJoinCode: jest.fn(),
      navigateParticipantWelcome,
    });
    useRouteToken.mockReturnValue({
      token: "participant-token",
      loading: false,
      error: "",
    });

    render(<AppRouter />);
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(navigateParticipantWelcome).toHaveBeenCalledTimes(1);
  });
});

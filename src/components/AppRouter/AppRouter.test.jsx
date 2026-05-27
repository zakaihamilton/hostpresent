import { render, screen } from "@testing-library/react";
import { AppRouter } from "./AppRouter";
import { APP_ROLE, APP_VIEW } from "@/hooks/useHashRouter";

jest.mock("@/components/WelcomeView", () => ({
  WelcomeView: () => <div data-testid="welcome-view">Welcome</div>,
}));

jest.mock("@/components/MeetingView", () => ({
  MeetingView: ({ role }) => (
    <div data-testid="meeting-view">Meeting {role}</div>
  ),
}));

jest.mock("@/hooks/useHashRouter", () => ({
  APP_ROLE: { HOST: "host", PARTICIPANT: "participant" },
  APP_VIEW: { WELCOME: "welcome", MEETING: "meeting", JOIN: "join" },
  useHashRouter: jest.fn(),
}));

jest.mock("@/hooks/useRouteToken", () => ({
  useRouteToken: jest.fn(() => ({ token: null, loading: false })),
}));

jest.mock("@/hooks/useRoomSession", () => ({
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
    const { useHashRouter } = await import("@/hooks/useHashRouter");
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
    const { useHashRouter } = await import("@/hooks/useHashRouter");
    const { useRouteToken } = await import("@/hooks/useRouteToken");

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
    });

    render(<AppRouter />);
    expect(screen.getByTestId("meeting-view")).toHaveTextContent("Meeting host");
  });
});

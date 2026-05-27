import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APP_ROLE } from "@/hooks/hashRouter";
import { WelcomeView } from "./WelcomeView";

jest.mock("./SecurityNotice", () => ({
  SecurityNotice: () => null,
}));

jest.mock("./WelcomeHostPanel", () => ({
  WelcomeHostPanel: () => <div data-testid="host-panel">Host panel</div>,
}));

jest.mock("./WelcomeParticipantPanel", () => ({
  WelcomeParticipantPanel: () => (
    <div data-testid="participant-panel">Participant panel</div>
  ),
}));

describe("WelcomeView", () => {
  it("renders tabs and host panel by default", () => {
    render(
      <WelcomeView
        role={APP_ROLE.HOST}
        token={null}
        joinCode={null}
        navigate={() => {}}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Host Present" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("host-panel")).toBeInTheDocument();
    expect(screen.getByText("Zakai Hamilton")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "GitHub Repository" }),
    ).toHaveAttribute("href", "https://github.com/zakaihamilton/hostpresent");
    expect(
      screen.getByRole("link", { name: "LinkedIn Profile" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/in/zakai-hamilton");
  });

  it("switches to participant tab without carrying join code", async () => {
    const user = userEvent.setup();
    const navigate = jest.fn();

    const { rerender } = render(
      <WelcomeView
        role={APP_ROLE.HOST}
        token={null}
        joinCode="ABCDEFGH"
        navigate={navigate}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Participant" }));
    expect(navigate).toHaveBeenCalledWith({
      view: "welcome",
      role: APP_ROLE.PARTICIPANT,
      token: null,
      joinCode: null,
    });

    rerender(
      <WelcomeView
        role={APP_ROLE.PARTICIPANT}
        token={null}
        joinCode={null}
        navigate={navigate}
        navigateJoinCode={() => {}}
        navigateParticipantWelcome={() => {}}
      />,
    );

    expect(screen.getByTestId("participant-panel")).toBeInTheDocument();
  });
});

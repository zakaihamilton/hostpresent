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
    expect(screen.getByTestId("host-panel")).toBeInTheDocument();
  });

  it("switches to participant tab", async () => {
    const user = userEvent.setup();
    const navigate = jest.fn();

    render(
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
    expect(screen.getByTestId("participant-panel")).toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith({
      view: "welcome",
      role: APP_ROLE.PARTICIPANT,
      joinCode: null,
    });
  });
});

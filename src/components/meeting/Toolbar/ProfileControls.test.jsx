import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { ProfileControls } from "./ProfileControls";

function getProfileButton() {
  return screen.getByRole("button", { name: /Display name:/i });
}

describe("ProfileControls", () => {
  it("shows a custom tooltip with the resolved display name", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls displayName="Alex" onDisplayNameChange={() => {}} />,
    );

    await user.hover(getProfileButton());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Alex");
    expect(tooltip).toHaveTextContent("Click to edit name");
  });

  it("opens a popup to edit the display name", async () => {
    const user = userEvent.setup();

    render(<ProfileControls displayName="" onDisplayNameChange={() => {}} />);

    await user.click(getProfileButton());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("saves the name when the save button is clicked", async () => {
    const user = userEvent.setup();
    const onDisplayNameChange = jest.fn();

    render(
      <ProfileControls
        displayName=""
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    await user.click(getProfileButton());
    await user.type(screen.getByLabelText("Display name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onDisplayNameChange).toHaveBeenCalledWith("Sam");
  });

  it("does not save when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onDisplayNameChange = jest.fn();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    await user.click(getProfileButton());
    await user.type(screen.getByLabelText("Display name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDisplayNameChange).not.toHaveBeenCalled();
  });

  it("includes participation mode controls for participants", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        participantMode={PARTICIPANT_MODE.AVAILABLE}
        onParticipantModeChange={jest.fn()}
      />,
    );

    await user.click(getProfileButton());

    expect(
      screen.getByRole("group", { name: "Participation mode" }),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
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
    expect(tooltip).toHaveTextContent("Click to edit name and device settings");
  });

  it("mentions participation mode in the tooltip when mode controls are available", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        participantMode={PARTICIPANT_MODE.LISTENING}
        onParticipantModeChange={() => {}}
      />,
    );

    await user.hover(getProfileButton());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(
      "Click to edit name, participation mode, and device settings",
    );
    expect(getProfileButton()).toHaveAccessibleName(
      "Display name: Alex. Participation mode: Listening only",
    );
  });

  it("opens a popup to edit the display name", async () => {
    const user = userEvent.setup();

    render(<ProfileControls displayName="" onDisplayNameChange={() => {}} />);

    await user.click(getProfileButton());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toHaveFocus();
    });
  });

  it("restores trigger focus when Escape closes the popup", async () => {
    const user = userEvent.setup();
    render(
      <ProfileControls displayName="Alex" onDisplayNameChange={() => {}} />,
    );

    const trigger = getProfileButton();
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByLabelText("Display name")).toHaveFocus(),
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
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

  it("associates device labels with their selectors", async () => {
    const user = userEvent.setup();
    const device = (deviceId, label) => ({ deviceId, label });

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableMicrophones={[device("mic-1", "Desk mic")]}
        availableSpeakers={[device("speaker-1", "Desk speakers")]}
        availableCameras={[device("camera-1", "Desk camera")]}
      />,
    );

    await user.click(getProfileButton());

    expect(screen.getByLabelText("Microphone")).toHaveValue("mic-1");
    expect(screen.getByLabelText("Audio output")).toHaveValue("speaker-1");
    expect(screen.getByLabelText("Camera")).toHaveValue("camera-1");
  });

  it("shows the listening-only state on the profile button", () => {
    const { container } = render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        participantMode={PARTICIPANT_MODE.LISTENING}
        onParticipantModeChange={() => {}}
      />,
    );

    expect(container.querySelector(".modeBadgeListening")).toHaveTextContent(
      "L",
    );
  });
});

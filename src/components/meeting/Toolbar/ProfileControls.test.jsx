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

  it("associates device labels with custom selectors", async () => {
    const user = userEvent.setup();
    const device = (deviceId, label) => ({ deviceId, label });

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableMicrophones={[device("mic-1", "Desk mic")]}
        selectedMicrophone="mic-1"
        availableSpeakers={[device("speaker-1", "Desk speakers")]}
        selectedSpeaker="speaker-1"
        availableCameras={[device("camera-1", "Desk camera")]}
        selectedCamera="camera-1"
      />,
    );

    await user.click(getProfileButton());

    expect(
      screen.getByRole("combobox", { name: /^Microphone:/ }),
    ).toHaveTextContent("Desk mic");
    expect(
      screen.getByRole("combobox", { name: /^Audio output:/ }),
    ).toHaveTextContent("Desk speakers");
    expect(
      screen.getByRole("combobox", { name: /^Camera:/ }),
    ).toHaveTextContent("Desk camera");
  });

  it("opens the device list and selects an option with the keyboard", async () => {
    const user = userEvent.setup();
    const onMicrophoneChange = jest.fn();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableMicrophones={[
          { deviceId: "mic-1", label: "Desk mic" },
          { deviceId: "mic-2", label: "USB microphone" },
        ]}
        selectedMicrophone="mic-1"
        onMicrophoneChange={onMicrophoneChange}
      />,
    );

    await user.click(getProfileButton());
    const microphone = screen.getByRole("combobox", { name: /^Microphone:/ });
    microphone.focus();
    await user.keyboard("{ArrowDown}");

    const listbox = screen.getByRole("listbox", { name: "Microphone" });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Desk mic" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{ArrowDown}");
    expect(microphone).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "USB microphone" }).id,
    );
    await user.keyboard("{Home}");
    expect(microphone).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Desk mic" }).id,
    );
    await user.keyboard("{End}");
    await user.keyboard("{Enter}");

    expect(onMicrophoneChange).toHaveBeenCalledWith("mic-2");
    expect(screen.queryByRole("listbox", { name: "Microphone" })).toBeNull();
    expect(microphone).toHaveFocus();
  });

  it("selects audio output and camera devices by pointer", async () => {
    const user = userEvent.setup();
    const onSpeakerChange = jest.fn();
    const onCameraChange = jest.fn();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableSpeakers={[
          { deviceId: "speaker-1", label: "Desk speakers" },
          { deviceId: "speaker-2", label: "USB speakers" },
        ]}
        selectedSpeaker="speaker-1"
        onSpeakerChange={onSpeakerChange}
        availableCameras={[
          { deviceId: "camera-1", label: "Built-in camera" },
          { deviceId: "camera-2", label: "External camera" },
        ]}
        selectedCamera="camera-1"
        onCameraChange={onCameraChange}
      />,
    );

    await user.click(getProfileButton());
    await user.click(screen.getByRole("combobox", { name: /^Audio output:/ }));
    await user.click(screen.getByRole("option", { name: "USB speakers" }));
    expect(onSpeakerChange).toHaveBeenCalledWith("speaker-2");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /^Camera:/ }));
    await user.click(screen.getByRole("option", { name: "External camera" }));
    expect(onCameraChange).toHaveBeenCalledWith("camera-2");
  });

  it("closes a device list with Escape and restores trigger focus", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableCameras={[{ deviceId: "camera-1", label: "Desk camera" }]}
        selectedCamera="camera-1"
      />,
    );

    await user.click(getProfileButton());
    const camera = screen.getByRole("combobox", { name: /^Camera:/ });
    await user.click(camera);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox", { name: "Camera" })).toBeNull();
    expect(camera).toHaveFocus();
  });

  it("closes a device list when another part of the profile popup is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableSpeakers={[{ deviceId: "speaker-1", label: "Desk speakers" }]}
        selectedSpeaker="speaker-1"
      />,
    );

    await user.click(getProfileButton());
    await user.click(screen.getByRole("combobox", { name: /^Audio output:/ }));
    await user.click(screen.getByText("Audio & video devices"));

    expect(screen.queryByRole("listbox", { name: "Audio output" })).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("preserves the device empty states", async () => {
    const user = userEvent.setup();

    render(
      <ProfileControls displayName="Alex" onDisplayNameChange={() => {}} />,
    );
    await user.click(getProfileButton());

    expect(screen.getByText("No microphones detected")).toBeInTheDocument();
    expect(screen.getByText("Default system output")).toBeInTheDocument();
    expect(screen.getByText("No cameras detected")).toBeInTheDocument();
  });

  it("toggles voice isolation", async () => {
    const user = userEvent.setup();
    const onVoiceIsolationChange = jest.fn();

    render(
      <ProfileControls
        displayName="Alex"
        onDisplayNameChange={() => {}}
        availableMicrophones={[{ deviceId: "mic-1", label: "Desk mic" }]}
        isVoiceIsolationEnabled
        onVoiceIsolationChange={onVoiceIsolationChange}
      />,
    );

    await user.click(getProfileButton());
    const voiceIsolation = screen.getByRole("checkbox", {
      name: /voice isolation/i,
    });
    expect(voiceIsolation).toBeChecked();

    await user.click(voiceIsolation);
    expect(onVoiceIsolationChange).toHaveBeenCalledWith(false);
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaControls } from "./MediaControls";

function getDeviceMenuChevron() {
  return screen
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-haspopup") === "dialog");
}

const builtInMic = {
  deviceId: "builtin-mic-id",
  groupId: "group-0",
  kind: "audioinput",
  label: "Built-in Microphone",
};

const externalMic = {
  deviceId: "external-mic-id",
  groupId: "group-0",
  kind: "audioinput",
  label: "External Microphone",
};

const frontCamera = {
  deviceId: "front-camera-id",
  groupId: "group-1",
  kind: "videoinput",
  label: "Front Camera",
};

const backCamera = {
  deviceId: "back-camera-id",
  groupId: "group-1",
  kind: "videoinput",
  label: "Back Camera",
};

describe("MediaControls", () => {
  it("toggles audio mute on mic click", async () => {
    const user = userEvent.setup();
    const onToggleAudio = jest.fn();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={onToggleAudio}
        onToggleVideo={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mute microphone" }));
    expect(onToggleAudio).toHaveBeenCalledTimes(1);
  });

  it("toggles video on camera click", async () => {
    const user = userEvent.setup();
    const onToggleVideo = jest.fn();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={onToggleVideo}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Turn camera off" }));
    expect(onToggleVideo).toHaveBeenCalledTimes(1);
  });

  it("opens device menu and shows available microphones and cameras", async () => {
    const user = userEvent.setup();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableMicrophones={[builtInMic, externalMic]}
        selectedMicrophone="builtin-mic-id"
        onMicrophoneChange={() => {}}
        availableCameras={[frontCamera, backCamera]}
        selectedCamera="front-camera-id"
        onCameraChange={() => {}}
      />,
    );

    await user.click(getDeviceMenuChevron());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Device settings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByText("Built-in Microphone")).toBeInTheDocument();
    expect(screen.getByText("External Microphone")).toBeInTheDocument();
    expect(screen.getByText("Front Camera")).toBeInTheDocument();
    expect(screen.getByText("Back Camera")).toBeInTheDocument();
  });

  it("switches camera when a different option is selected", async () => {
    const user = userEvent.setup();
    const onCameraChange = jest.fn();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableCameras={[frontCamera, backCamera]}
        selectedCamera="front-camera-id"
        onCameraChange={onCameraChange}
      />,
    );

    await user.click(getDeviceMenuChevron());
    await user.click(screen.getByRole("radio", { name: /Back Camera/i }));

    expect(onCameraChange).toHaveBeenCalledWith("back-camera-id");
  });

  it("switches microphone when a different option is selected", async () => {
    const user = userEvent.setup();
    const onMicrophoneChange = jest.fn();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableMicrophones={[builtInMic, externalMic]}
        selectedMicrophone="builtin-mic-id"
        onMicrophoneChange={onMicrophoneChange}
        availableCameras={[frontCamera, backCamera]}
        selectedCamera="front-camera-id"
        onCameraChange={() => {}}
      />,
    );

    await user.click(getDeviceMenuChevron());
    await user.click(
      screen.getByRole("radio", { name: /External Microphone/i }),
    );

    expect(onMicrophoneChange).toHaveBeenCalledWith("external-mic-id");
  });

  it("shows no cameras message when list is empty", async () => {
    const user = userEvent.setup();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableCameras={[]}
        selectedCamera=""
        onCameraChange={() => {}}
      />,
    );

    await user.click(getDeviceMenuChevron());
    expect(screen.getByText("No microphones detected")).toBeInTheDocument();
    expect(screen.getByText("No cameras detected")).toBeInTheDocument();
  });
});

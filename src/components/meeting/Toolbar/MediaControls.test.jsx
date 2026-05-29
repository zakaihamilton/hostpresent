import { act, render, screen } from "@testing-library/react";
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

const builtInSpeaker = {
  deviceId: "builtin-speaker-id",
  groupId: "group-2",
  kind: "audiooutput",
  label: "Built-in Speakers",
};

describe("MediaControls", () => {
  let audioContextMock;

  beforeEach(() => {
    audioContextMock = {
      createAnalyser: jest.fn(() => ({
        fftSize: 0,
        getByteTimeDomainData: (samples) => {
          samples.fill(128);
          samples[0] = 180;
        },
      })),
      createMediaStreamSource: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      })),
      close: jest.fn(),
    };
    global.AudioContext = jest.fn(() => audioContextMock);
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: jest.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

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

  it("opens device menu and separates microphone, output, and camera settings", async () => {
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
        availableSpeakers={[builtInSpeaker]}
        selectedSpeaker="builtin-speaker-id"
        onSpeakerChange={() => {}}
        availableCameras={[frontCamera, backCamera]}
        selectedCamera="front-camera-id"
        onCameraChange={() => {}}
      />,
    );

    await user.click(getDeviceMenuChevron());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Device settings")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Microphone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Audio output" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByText("Built-in Microphone")).toBeInTheDocument();
    expect(screen.getByText("External Microphone")).toBeInTheDocument();
    expect(screen.getByText("Built-in Speakers")).toBeInTheDocument();
    expect(screen.getByText("Front Camera")).toBeInTheDocument();
    expect(screen.getByText("Back Camera")).toBeInTheDocument();
  });

  it("switches audio output when a different speaker is selected", async () => {
    const user = userEvent.setup();
    const onSpeakerChange = jest.fn();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableSpeakers={[builtInSpeaker]}
        selectedSpeaker=""
        onSpeakerChange={onSpeakerChange}
      />,
    );

    await user.click(getDeviceMenuChevron());
    await user.click(screen.getByRole("radio", { name: /Built-in Speakers/i }));

    expect(onSpeakerChange).toHaveBeenCalledWith("builtin-speaker-id");
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

  it("tests the selected microphone and reports input", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();

    render(
      <MediaControls
        isAudioMuted={false}
        isVideoMuted={false}
        onToggleAudio={() => {}}
        onToggleVideo={() => {}}
        availableMicrophones={[builtInMic]}
        selectedMicrophone="builtin-mic-id"
        onMicrophoneChange={() => {}}
      />,
    );

    await user.click(getDeviceMenuChevron());
    await user.click(screen.getByRole("button", { name: "Test microphone" }));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "builtin-mic-id" } },
      video: false,
    });

    act(() => {
      jest.advanceTimersByTime(2300);
    });

    expect(screen.getByText("Microphone is working")).toBeInTheDocument();

    jest.useRealTimers();
  });
});

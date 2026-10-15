import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMediaStream } from "@/test/helpers";
import { PrimaryView } from "./PrimaryView";

jest.mock("@/components/meeting/VideoPlayer", () => ({
  VideoPlayer: ({ className }) => (
    <div data-testid="video-player" className={className} />
  ),
}));

describe("PrimaryView", () => {
  it("renders label and video player when stream is present", () => {
    render(
      <PrimaryView
        stream={createMediaStream()}
        label="You (Host)"
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
      />,
    );

    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(screen.getByText("You (Host)")).toBeInTheDocument();
  });

  it("shows recording status when recording", () => {
    render(
      <PrimaryView
        stream={createMediaStream()}
        label="You (Host)"
        isRecording
        isRecordingPaused={false}
        recordingDurationSeconds={15}
      />,
    );

    expect(screen.getByText("REC")).toBeInTheDocument();
    expect(screen.getByText("00:15")).toBeInTheDocument();
  });

  it("mirrors a local camera preview when requested", () => {
    render(
      <PrimaryView
        stream={createMediaStream()}
        label="You (Host)"
        isMirrored
      />,
    );

    expect(screen.getByTestId("video-player")).toHaveClass("mirroredVideo");
  });

  it("keeps a stop-sharing control available to the presenter", async () => {
    const user = userEvent.setup();
    const onStopScreenShare = jest.fn();

    render(
      <PrimaryView
        stream={createMediaStream()}
        label="You are sharing your screen"
        isScreenSharing
        onStopScreenShare={onStopScreenShare}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Stop sharing" }));

    expect(onStopScreenShare).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import { createMediaStream } from "@/test/helpers";
import { PrimaryView } from "./PrimaryView";

jest.mock("@/components/meeting/VideoPlayer", () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
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
});

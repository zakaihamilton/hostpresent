import { render, screen } from "@testing-library/react";
import { VideoTile } from "./VideoTile";
import { createMediaStream } from "@/test/helpers";

jest.mock("@/components/VideoPlayer", () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}));

describe("VideoTile", () => {
  it("renders video when stream is available", () => {
    render(
      <VideoTile stream={createMediaStream()} name="Alex" initial="A" isMuted />,
    );

    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("keeps audio playback mounted when video is off", () => {
    render(
      <VideoTile
        stream={createMediaStream()}
        name="Alex"
        initial="A"
        isVideoOff
        videoOffIcon={<span>Off</span>}
      />,
    );

    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });
});

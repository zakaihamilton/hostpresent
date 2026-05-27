import { render } from "@testing-library/react";
import { VideoPlayer } from "./VideoPlayer";
import { createMediaStream } from "@/test/helpers";

describe("VideoPlayer", () => {
  it("renders a muted autoplay video element", () => {
    const { container } = render(
      <VideoPlayer stream={createMediaStream()} isMuted className="tile" />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveClass("tile");
    expect(video).toHaveProperty("muted", true);
  });
});

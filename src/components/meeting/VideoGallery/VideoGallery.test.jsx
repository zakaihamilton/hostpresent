import { render, screen } from "@testing-library/react";
import { createMediaStream } from "@/test/helpers";
import { VideoGallery } from "./VideoGallery";

jest.mock("@/components/meeting/VideoTile", () => ({
  VideoTile: ({ name }) => <div data-testid="video-tile">{name}</div>,
}));

describe("VideoGallery", () => {
  it("renders participant tiles when visible", () => {
    render(
      <VideoGallery
        visible
        screenStream={null}
        localStream={createMediaStream()}
        participants={[
          {
            id: "p1",
            name: "Alex",
            avatarColor: "#000",
            isAudioMuted: false,
            isVideoMuted: false,
          },
        ]}
        isAudioMuted={false}
      />,
    );

    expect(screen.getByTestId("video-tile")).toHaveTextContent("Alex");
  });

  it("keeps streams mounted when gallery is hidden", () => {
    render(
      <VideoGallery
        visible={false}
        screenStream={null}
        localStream={createMediaStream()}
        participants={[
          {
            id: "p1",
            name: "Alex",
            avatarColor: "#000",
            isAudioMuted: false,
            isVideoMuted: false,
          },
        ]}
        isAudioMuted={false}
      />,
    );

    expect(screen.getByTestId("video-tile")).toHaveTextContent("Alex");
  });
});

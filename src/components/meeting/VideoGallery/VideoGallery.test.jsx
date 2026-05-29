import { render, screen } from "@testing-library/react";
import { createMediaStream } from "@/test/helpers";
import { VideoGallery } from "./VideoGallery";

jest.mock("@/components/meeting/VideoTile", () => ({
  VideoTile: ({ name, isMuted }) => (
    <div data-muted={String(isMuted)} data-testid="video-tile">
      {name}
    </div>
  ),
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

  it("mutes the local self tile so users do not hear their own microphone", () => {
    const selfStream = {
      getAudioTracks: () => [{ readyState: "live", enabled: true }],
      getVideoTracks: () => [],
      getTracks: () => [],
    };

    render(
      <VideoGallery
        visible
        screenStream={null}
        localStream={createMediaStream()}
        participants={[
          {
            id: "self",
            name: "Alex",
            avatarColor: "#000",
            isSelf: true,
            isAudioMuted: false,
            isVideoMuted: false,
            stream: selfStream,
          },
        ]}
        isAudioMuted={false}
      />,
    );

    expect(screen.getByTestId("video-tile")).toHaveAttribute(
      "data-muted",
      "true",
    );
  });
});

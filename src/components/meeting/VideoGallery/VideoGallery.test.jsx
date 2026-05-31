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

    const tiles = screen.getAllByTestId("video-tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[1]).toHaveTextContent("Alex");
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

    const tiles = screen.getAllByTestId("video-tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[1]).toHaveTextContent("Alex");
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

    const tiles = screen.getAllByTestId("video-tile");
    expect(tiles[0]).toHaveAttribute("data-muted", "true");
  });

  it("only shows up to 4 video tiles including host", () => {
    render(
      <VideoGallery
        visible
        screenStream={null}
        localStream={createMediaStream()}
        participants={[
          { id: "p1", name: "Alex", avatarColor: "#000" },
          { id: "p2", name: "Bob", avatarColor: "#000" },
          { id: "p3", name: "Charlie", avatarColor: "#000" },
          { id: "p4", name: "David", avatarColor: "#000" },
          { id: "p5", name: "Eve", avatarColor: "#000" },
        ]}
        isAudioMuted={false}
      />,
    );

    const tiles = screen.getAllByTestId("video-tile");
    // 1 host tile + 3 remote tiles = 4 tiles total
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveTextContent("You");
    expect(tiles[1]).toHaveTextContent("Alex");
    expect(tiles[2]).toHaveTextContent("Bob");
    expect(tiles[3]).toHaveTextContent("Charlie");
    expect(screen.queryByText("David")).not.toBeInTheDocument();
    expect(screen.queryByText("Eve")).not.toBeInTheDocument();
  });
});

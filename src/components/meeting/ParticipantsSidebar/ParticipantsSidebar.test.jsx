import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantsSidebar } from "./ParticipantsSidebar";

describe("ParticipantsSidebar", () => {
  const defaultParticipant = {
    id: "p1",
    name: "Alex",
    avatarColor: "#000",
    isAudioMuted: false,
    isVideoMuted: false,
  };

  function renderSidebar(props = {}) {
    return render(
      <ParticipantsSidebar
        visible
        audioList={[]}
        videoParticipants={[defaultParticipant]}
        isVideoMuted={false}
        isAudioMuted={false}
        isHost
        onMuteParticipantVideo={() => {}}
        onMuteParticipantAudio={() => {}}
        onMuteAllVideo={() => {}}
        onMuteAllAudio={() => {}}
        canMuteAllVideo
        canMuteAllAudio
        {...props}
      />,
    );
  }

  it("renders host and remote participants", () => {
    renderSidebar();

    expect(screen.getByText("Participants")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("calls close handler", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    renderSidebar({
      videoParticipants: [],
      onClose,
      canMuteAllVideo: false,
      canMuteAllAudio: false,
    });

    await user.click(
      screen.getByRole("button", { name: "Close participants" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls bulk mute handlers", async () => {
    const user = userEvent.setup();
    const onMuteAllVideo = jest.fn();
    const onMuteAllAudio = jest.fn();

    renderSidebar({ onMuteAllVideo, onMuteAllAudio });

    await user.click(
      screen.getByRole("button", { name: "Turn off all cameras" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Mute all participants" }),
    );

    expect(onMuteAllVideo).toHaveBeenCalledTimes(1);
    expect(onMuteAllAudio).toHaveBeenCalledTimes(1);
  });

  it("reflects participant media status changes in the roster", () => {
    const { rerender } = renderSidebar();

    expect(
      screen.getByRole("button", { name: "Turn off camera" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mute participant" }),
    ).toBeInTheDocument();

    rerender(
      <ParticipantsSidebar
        visible
        audioList={[]}
        videoParticipants={[
          {
            ...defaultParticipant,
            isAudioMuted: true,
            isVideoMuted: true,
            isScreenSharing: true,
          },
        ]}
        isVideoMuted={false}
        isAudioMuted={false}
        isHost
        onMuteParticipantVideo={() => {}}
        onMuteParticipantAudio={() => {}}
        onMuteAllVideo={() => {}}
        onMuteAllAudio={() => {}}
        canMuteAllVideo
        canMuteAllAudio
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Turn off camera" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Mute participant" }),
    ).toBeNull();
  });
});


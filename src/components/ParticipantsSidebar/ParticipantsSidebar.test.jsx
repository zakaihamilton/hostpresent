import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantsSidebar } from "./ParticipantsSidebar";

describe("ParticipantsSidebar", () => {
  it("renders host and remote participants", () => {
    render(
      <ParticipantsSidebar
        visible
        audioList={[]}
        videoParticipants={[
          {
            id: "p1",
            name: "Alex",
            avatarColor: "#000",
            isAudioMuted: false,
            isVideoMuted: false,
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

    expect(screen.getByText("Participants")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("You (Host)")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("calls bulk mute handlers", async () => {
    const user = userEvent.setup();
    const onMuteAllVideo = jest.fn();
    const onMuteAllAudio = jest.fn();

    render(
      <ParticipantsSidebar
        visible
        audioList={[]}
        videoParticipants={[
          {
            id: "p1",
            name: "Alex",
            avatarColor: "#000",
            isAudioMuted: false,
            isVideoMuted: false,
          },
        ]}
        isVideoMuted={false}
        isAudioMuted={false}
        isHost
        onMuteParticipantVideo={() => {}}
        onMuteParticipantAudio={() => {}}
        onMuteAllVideo={onMuteAllVideo}
        onMuteAllAudio={onMuteAllAudio}
        canMuteAllVideo
        canMuteAllAudio
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Turn off all cameras" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Mute all participants" }),
    );

    expect(onMuteAllVideo).toHaveBeenCalledTimes(1);
    expect(onMuteAllAudio).toHaveBeenCalledTimes(1);
  });
});

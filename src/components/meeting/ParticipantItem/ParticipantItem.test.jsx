import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantItem } from "./ParticipantItem";

describe("ParticipantItem", () => {
  it("renders participant name and initial", () => {
    render(
      <ParticipantItem
        name="Alex"
        initial="A"
        avatarColor="#000"
        isVideoMuted={false}
        isAudioMuted={false}
      />,
    );

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("calls host mute handlers", async () => {
    const user = userEvent.setup();
    const onMuteVideo = jest.fn();
    const onMuteAudio = jest.fn();

    render(
      <ParticipantItem
        name="Alex"
        initial="A"
        avatarColor="#000"
        isVideoMuted={false}
        isAudioMuted={false}
        onMuteVideo={onMuteVideo}
        onMuteAudio={onMuteAudio}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Turn off camera" }));
    await user.click(screen.getByRole("button", { name: "Mute participant" }));

    expect(onMuteVideo).toHaveBeenCalledTimes(1);
    expect(onMuteAudio).toHaveBeenCalledTimes(1);
  });
});

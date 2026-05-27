import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";

describe("Header", () => {
  it("renders logo and meeting duration", () => {
    render(
      <Header
        meetingDurationSeconds={125}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
      />,
    );

    expect(screen.getByText("Host Present")).toBeInTheDocument();
    expect(screen.getByText("02:05")).toBeInTheDocument();
  });

  it("shows recording badge when recording", () => {
    render(
      <Header
        meetingDurationSeconds={0}
        isRecording
        isRecordingPaused={false}
        recordingDurationSeconds={42}
      />,
    );

    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByText("00:42")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        onBack={onBack}
        backLabel="Leave"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("selects room id text when clicked", async () => {
    const user = userEvent.setup();
    const addRange = jest.fn();
    const removeAllRanges = jest.fn();
    const selectNodeContents = jest.fn();

    jest.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
      addRange,
    });
    jest.spyOn(document, "createRange").mockReturnValue({
      selectNodeContents,
    });

    render(
      <Header
        meetingDurationSeconds={0}
        roomId="ABCD-EFGH"
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Room ID ABCD-EFGH. Click to select for copy.",
      }),
    );

    expect(selectNodeContents).toHaveBeenCalled();
    expect(addRange).toHaveBeenCalled();
  });

  it("shows invite link button when onShowInviteLink is provided", async () => {
    const user = userEvent.setup();
    const onShowInviteLink = jest.fn();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        onShowInviteLink={onShowInviteLink}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show invite link" }));
    expect(onShowInviteLink).toHaveBeenCalledTimes(1);
  });
});

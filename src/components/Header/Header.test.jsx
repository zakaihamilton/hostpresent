import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Header } from "./Header";

jest.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: jest.fn(),
}));

describe("Header", () => {
  beforeEach(() => {
    copyTextToClipboard.mockReset();
    copyTextToClipboard.mockResolvedValue(true);
  });

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

  it("copies room id to clipboard when clicked", async () => {
    const user = userEvent.setup();

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
      screen.getByRole("button", { name: "Copy join code ABCD-EFGH" }),
    );

    expect(copyTextToClipboard).toHaveBeenCalledWith("ABCD-EFGH");
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
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

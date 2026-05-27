import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";

describe("Header", () => {
  it("renders logo, clock, and meeting duration", () => {
    render(
      <Header
        timeString="10:30"
        meetingDurationSeconds={125}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
      />,
    );

    expect(screen.getByText("Host Present")).toBeInTheDocument();
    expect(screen.getByText("10:30")).toBeInTheDocument();
    expect(screen.getByText("02:05")).toBeInTheDocument();
  });

  it("shows recording badge when recording", () => {
    render(
      <Header
        timeString="10:30"
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
        timeString="10:30"
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
});

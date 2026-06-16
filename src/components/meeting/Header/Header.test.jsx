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

    expect(screen.getByText("Host Present logo")).toBeInTheDocument();
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

  it("enters edit mode and allows renaming when onSessionTitleChange is provided", async () => {
    const user = userEvent.setup();
    const onSessionTitleChange = jest.fn();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        sessionTitle="Initial Title"
        onSessionTitleChange={onSessionTitleChange}
      />,
    );

    // Initial title rendering as a button
    const titleBtn = screen.getByRole("button", { name: "Initial Title" });
    expect(titleBtn).toBeInTheDocument();

    // Click to enter edit mode
    await user.click(titleBtn);

    // Should render input field with current value
    const input = screen.getByRole("textbox", { name: "Rename meeting" });
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Initial Title");

    // Change input and press Enter
    await user.clear(input);
    await user.type(input, "New Awesome Meeting{Enter}");

    expect(onSessionTitleChange).toHaveBeenCalledWith("New Awesome Meeting");
  });

  it("reverts title to initial when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onSessionTitleChange = jest.fn();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        sessionTitle="Initial Title"
        onSessionTitleChange={onSessionTitleChange}
      />,
    );

    const titleBtn = screen.getByRole("button", { name: "Initial Title" });
    await user.click(titleBtn);

    const input = screen.getByRole("textbox", { name: "Rename meeting" });
    await user.clear(input);
    await user.type(input, "Discarded Changes{Escape}");

    expect(onSessionTitleChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Initial Title" }),
    ).toBeInTheDocument();
  });

  it("shows meeting name in a tooltip when participant clicks the logo", async () => {
    const user = userEvent.setup();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        sessionTitle="Product Sync"
        revealTitleOnLogoClick
      />,
    );

    const logoButton = screen.getByRole("button", {
      name: "Meeting name, Product Sync",
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.click(logoButton);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Product Sync");
  });

  it("shows meeting name inline for participants on wide mobile viewports", () => {
    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        sessionTitle="Product Sync"
        revealTitleOnLogoClick
      />,
    );

    expect(screen.getByText("Product Sync")).toBeInTheDocument();
    expect(screen.getByText("Product Sync")).toHaveClass(
      "logoTextParticipantInline",
    );
  });

  it("allows clearing the title to return to default", async () => {
    const user = userEvent.setup();
    const onSessionTitleChange = jest.fn();

    render(
      <Header
        meetingDurationSeconds={0}
        isRecording={false}
        isRecordingPaused={false}
        recordingDurationSeconds={0}
        sessionTitle="Initial Title"
        onSessionTitleChange={onSessionTitleChange}
      />,
    );

    const titleBtn = screen.getByRole("button", { name: "Initial Title" });
    await user.click(titleBtn);

    const input = screen.getByRole("textbox", { name: "Rename meeting" });
    await user.clear(input);
    await user.type(input, "{Enter}");

    expect(onSessionTitleChange).toHaveBeenCalledWith("");
  });
});

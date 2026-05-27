import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  const handlers = {
    onToggleAudio: jest.fn(),
    onToggleVideo: jest.fn(),
    onToggleScreenShare: jest.fn(),
    onShareScreenAudioChange: jest.fn(),
    onToggleGallery: jest.fn(),
    onToggleSidebar: jest.fn(),
    onStartRecording: jest.fn(),
    onPauseRecording: jest.fn(),
    onResumeRecording: jest.fn(),
    onStopRecording: jest.fn(),
  };

  beforeEach(() => {
    Object.values(handlers).forEach((handler) => handler.mockClear());
  });

  it("calls media and layout toggles", async () => {
    const user = userEvent.setup();

    render(
      <Toolbar
        isAudioMuted={false}
        isVideoMuted={false}
        screenStream={null}
        shareScreenAudio={false}
        isScreenAudioShared={false}
        isGalleryVisible={false}
        isSidebarVisible={false}
        isRecording={false}
        isRecordingPaused={false}
        {...handlers}
      />,
    );

    const footer = screen.getByRole("contentinfo");
    const buttons = within(footer).getAllByRole("button");

    await user.click(screen.getByRole("button", { name: "Share screen" }));
    await user.click(buttons[4]);
    await user.click(buttons[5]);

    expect(handlers.onToggleScreenShare).toHaveBeenCalled();
    expect(handlers.onToggleGallery).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("starts recording from idle state", async () => {
    const user = userEvent.setup();

    render(
      <Toolbar
        isAudioMuted={false}
        isVideoMuted={false}
        screenStream={null}
        shareScreenAudio={false}
        isScreenAudioShared={false}
        isGalleryVisible={false}
        isSidebarVisible={false}
        isRecording={false}
        isRecordingPaused={false}
        {...handlers}
      />,
    );

    const footer = screen.getByRole("contentinfo");
    const buttons = within(footer).getAllByRole("button");
    await user.click(buttons[6]);

    expect(handlers.onStartRecording).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScreenShareControls } from "./ScreenShareControls";

function getMenuButton() {
  return screen
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-haspopup") === "dialog");
}

describe("ScreenShareControls", () => {
  it("toggles screen sharing", async () => {
    const user = userEvent.setup();
    const onToggleScreenShare = jest.fn();

    render(
      <ScreenShareControls
        screenStream={null}
        shareScreenAudio={false}
        isScreenAudioShared={false}
        onToggleScreenShare={onToggleScreenShare}
        onShareScreenAudioChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Share screen" }));
    expect(onToggleScreenShare).toHaveBeenCalledTimes(1);
  });

  it("opens settings menu and changes audio preference", async () => {
    const user = userEvent.setup();
    const onShareScreenAudioChange = jest.fn();

    render(
      <ScreenShareControls
        screenStream={null}
        shareScreenAudio={false}
        isScreenAudioShared={false}
        onToggleScreenShare={() => {}}
        onShareScreenAudioChange={onShareScreenAudioChange}
      />,
    );

    await user.click(getMenuButton());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /With audio/i }));
    expect(onShareScreenAudioChange).toHaveBeenCalledWith(true);
  });

  it("shows stop sharing state while a screen stream is active", async () => {
    const user = userEvent.setup();
    const onToggleScreenShare = jest.fn();

    render(
      <ScreenShareControls
        screenStream={{ id: "screen-stream" }}
        shareScreenAudio
        isScreenAudioShared
        onToggleScreenShare={onToggleScreenShare}
        onShareScreenAudioChange={() => {}}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Stop screen sharing" }),
    );
    expect(onToggleScreenShare).toHaveBeenCalledTimes(1);

    await user.click(getMenuButton());
    expect(screen.getByText(/Currently sharing/i)).toBeInTheDocument();
    expect(screen.getByText("with audio")).toBeInTheDocument();
  });

  it("can switch screen sharing preference back to without audio", async () => {
    const user = userEvent.setup();
    const onShareScreenAudioChange = jest.fn();

    render(
      <ScreenShareControls
        screenStream={null}
        shareScreenAudio
        isScreenAudioShared={false}
        onToggleScreenShare={() => {}}
        onShareScreenAudioChange={onShareScreenAudioChange}
      />,
    );

    await user.click(getMenuButton());
    await user.click(screen.getByRole("radio", { name: /Video only/i }));

    expect(onShareScreenAudioChange).toHaveBeenCalledWith(false);
  });
});

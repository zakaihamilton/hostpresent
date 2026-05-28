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
});

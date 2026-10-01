import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AUDIO_PLAYBACK_BLOCKED_EVENT } from "@/lib/webrtc/audioPlayback";
import { ConnectionBanner } from "./ConnectionBanner";

it("lets a listener enable meeting audio without capturing devices", async () => {
  const capture = navigator.mediaDevices.getUserMedia;
  capture.mockClear();
  const play = jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
  const { container } = render(
    <>
      <ConnectionBanner isHost={false} hostPresent />
      <video>
        <track kind="captions" srcLang="en" src="data:text/vtt,WEBVTT" />
      </video>
    </>,
  );
  container.querySelector("video").srcObject = {};
  act(() => window.dispatchEvent(new Event(AUDIO_PLAYBACK_BLOCKED_EVENT)));
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Enable sound" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Enable sound" }),
    ).not.toBeInTheDocument(),
  );
  expect(play).toHaveBeenCalled();
  expect(capture).not.toHaveBeenCalled();
  play.mockRestore();
});

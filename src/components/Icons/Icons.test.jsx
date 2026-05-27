import { render } from "@testing-library/react";
import { Logo, Mic, MicOff, Video, VideoOff } from "./Icons";

describe("Icons", () => {
  it("renders logo and icon components", () => {
    const { container } = render(
      <>
        <Logo />
        <Mic />
        <MicOff />
        <Video />
        <VideoOff />
      </>,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.querySelector("title")?.textContent).toBe(
      "Host Present logo",
    );
  });
});

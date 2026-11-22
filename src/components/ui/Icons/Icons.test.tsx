import { render } from "@testing-library/react";
import {
  ChevronDown,
  GitHub,
  Logo,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "./Icons";

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

  it("forwards size and className props to SVG elements", () => {
    const { container } = render(
      <>
        <Logo size={36} className="logo-class" />
        <Mic size={24} className="mic-class" />
        <ChevronDown size={14} className="chevron-class" />
        <GitHub size={18} className="github-class" />
      </>,
    );

    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(4);
    expect(svgs[0]).toHaveAttribute("width", "36");
    expect(svgs[0]).toHaveClass("logo-class");
    expect(svgs[1]).toHaveAttribute("width", "24");
    expect(svgs[1]).toHaveClass("mic-class");
    expect(svgs[2]).toHaveAttribute("width", "14");
    expect(svgs[2]).toHaveClass("chevron-class");
    expect(svgs[3]).toHaveAttribute("width", "18");
    expect(svgs[3]).toHaveClass("github-class");
  });
});

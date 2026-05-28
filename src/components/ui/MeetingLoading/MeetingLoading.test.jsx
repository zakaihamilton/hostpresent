import { render, screen } from "@testing-library/react";
import { MeetingLoading } from "./MeetingLoading";

describe("MeetingLoading", () => {
  it("renders the default message", () => {
    render(<MeetingLoading />);

    expect(screen.getByText("Joining meeting…")).toBeInTheDocument();
  });

  it("renders a custom message", () => {
    render(<MeetingLoading message="Reconnecting…" />);

    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
  });

  it("has a status role with aria-live polite", () => {
    render(<MeetingLoading />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("has a hidden spinner", () => {
    render(<MeetingLoading />);

    expect(screen.getByText("Joining meeting…")).toBeInTheDocument();
  });
});

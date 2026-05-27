import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingJoinError } from "./MeetingJoinError";

describe("MeetingJoinError", () => {
  it("renders the default title", () => {
    render(<MeetingJoinError message="Something went wrong" />);

    expect(
      screen.getByRole("heading", { name: "Could not join meeting" }),
    ).toBeInTheDocument();
  });

  it("renders a custom title", () => {
    render(
      <MeetingJoinError title="Connection failed" message="Try again" />,
    );

    expect(
      screen.getByRole("heading", { name: "Connection failed" }),
    ).toBeInTheDocument();
  });

  it("renders the message", () => {
    render(<MeetingJoinError message="Meeting is full" />);

    expect(screen.getByText("Meeting is full")).toBeInTheDocument();
  });

  it("renders the hint when provided", () => {
    render(
      <MeetingJoinError
        message="Not found"
        hint="Check the meeting code and try again"
      />,
    );

    expect(
      screen.getByText("Check the meeting code and try again"),
    ).toBeInTheDocument();
  });

  it("does not render a hint when not provided", () => {
    const { container } = render(
      <MeetingJoinError message="Error" />,
    );

    expect(container.querySelector("p")).not.toBeNull();
  });

  it("shows the back button when onBack is provided", () => {
    render(
      <MeetingJoinError message="Error" onBack={() => {}} />,
    );

    expect(
      screen.getByRole("button", { name: "Back to welcome" }),
    ).toBeInTheDocument();
  });

  it("does not show a back button without onBack", () => {
    render(<MeetingJoinError message="Error" />);

    expect(
      screen.queryByRole("button", { name: "Back to welcome" }),
    ).not.toBeInTheDocument();
  });

  it("calls onBack when the back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    render(<MeetingJoinError message="Error" onBack={onBack} />);

    await user.click(
      screen.getByRole("button", { name: "Back to welcome" }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders with role alert", () => {
    render(<MeetingJoinError message="Error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

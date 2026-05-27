import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantModeToggle } from "./ParticipantModeToggle";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";

describe("ParticipantModeToggle", () => {
  it("renders both mode buttons", () => {
    render(
      <ParticipantModeToggle value={PARTICIPANT_MODE.AVAILABLE} onChange={() => {}} />,
    );

    expect(
      screen.getByRole("button", { name: "Available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Listening only" }),
    ).toBeInTheDocument();
  });

  it("marks the active mode as pressed", () => {
    const { rerender } = render(
      <ParticipantModeToggle value={PARTICIPANT_MODE.AVAILABLE} onChange={() => {}} />,
    );

    expect(
      screen.getByRole("button", { name: "Available" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Listening only" }),
    ).toHaveAttribute("aria-pressed", "false");

    rerender(
      <ParticipantModeToggle value={PARTICIPANT_MODE.LISTENING} onChange={() => {}} />,
    );

    expect(
      screen.getByRole("button", { name: "Available" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Listening only" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with the correct mode on click", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ParticipantModeToggle value={PARTICIPANT_MODE.AVAILABLE} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Listening only" }));
    expect(onChange).toHaveBeenCalledWith(PARTICIPANT_MODE.LISTENING);

    await user.click(screen.getByRole("button", { name: "Available" }));
    expect(onChange).toHaveBeenCalledWith(PARTICIPANT_MODE.AVAILABLE);
  });

  it("has a group role with an accessible label", () => {
    render(
      <ParticipantModeToggle value={PARTICIPANT_MODE.AVAILABLE} onChange={() => {}} />,
    );

    expect(
      screen.getByRole("group", { name: "Participation mode" }),
    ).toBeInTheDocument();
  });
});

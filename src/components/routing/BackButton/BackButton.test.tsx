import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackButton } from "./BackButton";

describe("BackButton", () => {
  it("calls onClick and exposes the label for accessibility", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(<BackButton label="Back to welcome" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Back to welcome" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the tooltip on hover", async () => {
    const user = userEvent.setup();

    render(<BackButton label="Back to join screen" onClick={() => {}} />);

    await user.hover(
      screen.getByRole("button", { name: "Back to join screen" }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Back to join screen",
    );
  });
});

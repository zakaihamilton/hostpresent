import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders children and shows tooltip text on hover", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip text="Helpful hint">
        <button type="button">Action</button>
      </Tooltip>,
    );

    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "Action" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful hint");
  });

  it("hides the tooltip when the trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip text="Helpful hint">
        <button type="button">Action</button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Action" });
    await user.hover(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not show the tooltip while forceHidden is true", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip text="Helpful hint" forceHidden>
        <button type="button">Action</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button", { name: "Action" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

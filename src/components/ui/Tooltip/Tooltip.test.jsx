import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("toggles tooltip on click when trigger is click", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip text="Product Sync" trigger="click">
        <button type="button">Logo</button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Logo" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.click(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Product Sync");

    await user.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on long press for touch devices", () => {
    jest.useFakeTimers();

    render(
      <Tooltip text="Hold to view">
        <button type="button">Action</button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Action" });

    act(() => {
      fireEvent.touchStart(button);
      jest.advanceTimersByTime(450);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Hold to view");

    act(() => {
      fireEvent.touchEnd(button);
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("renders rich tooltip content when provided", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip
        content={
          <>
            <span>Alex</span>
            <span>Click to edit name</span>
          </>
        }
      >
        <button type="button">Profile</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Alex");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to edit name");
  });

  it("hides the tooltip when the page becomes hidden", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip text="Helpful hint">
        <button type="button">Action</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button", { name: "Action" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful hint");

    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    fireEvent(document, new Event("visibilitychange"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });
});

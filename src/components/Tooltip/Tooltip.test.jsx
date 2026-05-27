import { render, screen } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders children and tooltip text", () => {
    render(
      <Tooltip text="Helpful hint">
        <button type="button">Action</button>
      </Tooltip>,
    );

    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByText("Helpful hint")).toBeInTheDocument();
  });
});

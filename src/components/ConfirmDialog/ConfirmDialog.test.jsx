import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Remove participant"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows title, message, and handles actions", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConfirmDialog
        open
        title="Remove participant"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Remove participant")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("renders nothing without a message", () => {
    const { container } = render(<ErrorBanner message="" onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message and dismisses on click", async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    render(<ErrorBanner message="Something failed" onDismiss={onDismiss} />);

    expect(screen.getByText("Something failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

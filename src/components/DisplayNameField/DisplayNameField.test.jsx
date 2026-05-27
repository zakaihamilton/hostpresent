import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisplayNameField } from "./DisplayNameField";

describe("DisplayNameField", () => {
  it("renders with default label and placeholder", () => {
    render(
      <DisplayNameField id="name" value="" onChange={() => {}} />,
    );

    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(
      <DisplayNameField id="name" label="Nickname" value="" onChange={() => {}} />,
    );

    expect(screen.getByLabelText("Nickname")).toBeInTheDocument();
  });

  it("calls onChange with the new value on input", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <DisplayNameField id="name" value="" onChange={onChange} />,
    );

    await user.type(screen.getByLabelText("Your name"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("renders with the provided value", () => {
    render(
      <DisplayNameField id="name" value="Alice" onChange={() => {}} />,
    );

    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("links the label to the input via htmlFor", () => {
    render(
      <DisplayNameField id="my-input" value="" onChange={() => {}} />,
    );

    expect(screen.getByLabelText("Your name")).toHaveAttribute("id", "my-input");
  });
});

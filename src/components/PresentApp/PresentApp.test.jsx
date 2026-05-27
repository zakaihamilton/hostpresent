import { render, screen } from "@testing-library/react";
import PresentApp from "./PresentApp";

jest.mock("@/components/AppRouter", () => ({
  AppRouter: () => <div data-testid="app-router">App router</div>,
}));

describe("PresentApp", () => {
  it("renders the app router", () => {
    render(<PresentApp />);
    expect(screen.getByTestId("app-router")).toBeInTheDocument();
  });
});

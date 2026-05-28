import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyTheme, STORAGE_KEY, THEME } from "@/lib/settings/themeSettings";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    applyTheme(THEME.LIGHT);
  });

  it("toggles between light and dark mode", async () => {
    const user = userEvent.setup();

    render(<ThemeToggle />);

    expect(document.documentElement.dataset.theme).toBe(THEME.LIGHT);

    await user.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe(THEME.DARK);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(THEME.DARK);

    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe(THEME.LIGHT);
  });
});

import {
  applyTheme,
  loadTheme,
  STORAGE_KEY,
  saveTheme,
  THEME,
} from "./themeSettings";

describe("themeSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("loads stored theme preference", () => {
    window.localStorage.setItem(STORAGE_KEY, THEME.DARK);
    expect(loadTheme()).toBe(THEME.DARK);
  });

  it("falls back to system theme when nothing is stored", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    expect(loadTheme()).toBe(THEME.DARK);
  });

  it("applies theme to the document root", () => {
    applyTheme(THEME.DARK);
    expect(document.documentElement.dataset.theme).toBe(THEME.DARK);
    expect(document.documentElement.style.colorScheme).toBe(THEME.DARK);
  });

  it("persists theme preference", () => {
    saveTheme(THEME.LIGHT);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(THEME.LIGHT);
  });
});

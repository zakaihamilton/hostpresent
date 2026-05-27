export const THEME = {
  LIGHT: "light",
  DARK: "dark",
};

export const STORAGE_KEY = "hostpresent.theme";

export function resolveSystemTheme() {
  if (typeof window === "undefined") return THEME.LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? THEME.DARK
    : THEME.LIGHT;
}

export function loadTheme() {
  if (typeof window === "undefined") return THEME.LIGHT;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === THEME.DARK || stored === THEME.LIGHT) {
      return stored;
    }
  } catch {
    // ignore storage failures
  }

  return resolveSystemTheme();
}

export function saveTheme(theme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const resolved =
    theme === THEME.DARK || theme === THEME.LIGHT
      ? theme
      : resolveSystemTheme();

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

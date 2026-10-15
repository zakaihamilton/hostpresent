"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  loadTheme,
  saveTheme,
  THEME,
} from "@/lib/settings/themeSettings";

function readThemeFromDocument() {
  if (typeof document === "undefined") return THEME.LIGHT;
  return document.documentElement.dataset.theme === THEME.DARK
    ? THEME.DARK
    : THEME.LIGHT;
}

export function useTheme() {
  const [theme, setTheme] = useState(readThemeFromDocument);

  useEffect(() => {
    const initial = loadTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const setThemePreference = useCallback((nextTheme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference(theme === THEME.DARK ? THEME.LIGHT : THEME.DARK);
  }, [setThemePreference, theme]);

  return {
    theme,
    isDark: theme === THEME.DARK,
    setTheme: setThemePreference,
    toggleTheme,
  };
}

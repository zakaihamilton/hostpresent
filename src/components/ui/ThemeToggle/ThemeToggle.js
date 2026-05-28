"use client";

import { Moon, Sun } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { useTheme } from "@/hooks/useTheme";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip text={label} placement="left">
      <button
        type="button"
        className={`${styles.button} ${className}`.trim()}
        onClick={toggleTheme}
        aria-label={label}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </Tooltip>
  );
}

try {
  const key = "hostpresent.theme";
  const savedTheme = localStorage.getItem(key);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : prefersDark
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch {
  // Theme preference is best effort; the CSS default remains usable.
}

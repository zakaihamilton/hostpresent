function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computePopupPosition(
  anchor,
  popup,
  { gap, align = "left", padding = 8 },
) {
  const left = clamp(
    align === "right" ? anchor.right - popup.width : anchor.left,
    padding,
    window.innerWidth - popup.width - padding,
  );
  let top = anchor.top - gap - popup.height;
  if (top < padding) top = anchor.bottom + gap;
  return {
    left,
    top: clamp(top, padding, window.innerHeight - popup.height - padding),
  };
}

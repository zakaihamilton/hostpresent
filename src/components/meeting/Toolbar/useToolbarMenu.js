import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export const MENU_GAP = 8;
export const VIEWPORT_PADDING = 8;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeMenuPosition(anchorRect, menuRect) {
  const width = menuRect.width;
  let left = anchorRect.right - width;
  left = clamp(
    left,
    VIEWPORT_PADDING,
    window.innerWidth - width - VIEWPORT_PADDING,
  );

  let top = anchorRect.top - MENU_GAP - menuRect.height;
  if (top < VIEWPORT_PADDING) {
    top = anchorRect.bottom + MENU_GAP;
  }
  top = clamp(
    top,
    VIEWPORT_PADDING,
    window.innerHeight - menuRect.height - VIEWPORT_PADDING,
  );

  return { top, left };
}

export function useToolbarMenuPosition({ menuOpen, menuAnchorRef, menuRef }) {
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [menuPositioned, setMenuPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);

  const updateMenuPosition = useCallback(() => {
    const anchor = menuAnchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    setMenuCoords(computeMenuPosition(anchorRect, menuRect));
  }, [menuAnchorRef, menuRef]);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPositioned(false);
      return;
    }

    updateMenuPosition();
    setMenuPositioned(true);

    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  return {
    menuCoords,
    menuPositioned,
    mounted,
    updateMenuPosition,
  };
}

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "@/components/ui/Icons";
import styles from "./CustomSelect.module.css";

const VIEWPORT_PADDING = 8;
const MENU_GAP = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function getMenuPosition(anchorRect, menuRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(
    anchorRect.width,
    viewportWidth - VIEWPORT_PADDING * 2,
  );
  const left = clamp(
    anchorRect.left,
    VIEWPORT_PADDING,
    viewportWidth - width - VIEWPORT_PADDING,
  );
  const spaceBelow = viewportHeight - anchorRect.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchorRect.top - VIEWPORT_PADDING;
  const openAbove = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
  const preferredTop = openAbove
    ? anchorRect.top - menuRect.height - MENU_GAP
    : anchorRect.bottom + MENU_GAP;
  const top = clamp(
    preferredTop,
    VIEWPORT_PADDING,
    viewportHeight - menuRect.height - VIEWPORT_PADDING,
  );

  return { top, left, width };
}

export function CustomSelect({ id, label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [positioned, setPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const focusOption = useCallback(
    (index) => {
      if (options.length === 0) return;
      const nextIndex = (index + options.length) % options.length;
      setActiveIndex(nextIndex);
    },
    [options.length],
  );

  const openMenu = useCallback(
    (index = selectedIndex >= 0 ? selectedIndex : 0) => {
      if (options.length === 0) return;
      setActiveIndex(clamp(index, 0, options.length - 1));
      setPositioned(false);
      setOpen(true);
    },
    [options.length, selectedIndex],
  );

  useLayoutEffect(() => {
    if (!open || !mounted) return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(
        triggerRect.width,
        window.innerWidth - VIEWPORT_PADDING * 2,
      );
      menu.style.width = `${menuWidth}px`;
      setPosition(getMenuPosition(triggerRect, menu.getBoundingClientRect()));
      setPositioned(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      closeMenu(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (activeIndex >= options.length && options.length > 0) {
      setActiveIndex(options.length - 1);
    }
  }, [activeIndex, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    menuRef.current?.children[activeIndex]?.scrollIntoView?.({
      block: "nearest",
    });
  }, [activeIndex, open]);

  const selectOption = useCallback(
    (option) => {
      onChange?.(option.value);
      closeMenu(true);
    },
    [closeMenu, onChange],
  );

  const handleTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (open) {
        focusOption(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
        return;
      }
      const startIndex =
        selectedIndex >= 0
          ? selectedIndex
          : event.key === "ArrowDown"
            ? 0
            : options.length - 1;
      openMenu(startIndex);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : options.length - 1;
      if (open) {
        setActiveIndex(index);
      } else {
        openMenu(index);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[activeIndex]) {
        selectOption(options[activeIndex]);
      } else {
        openMenu();
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "Tab" && open) {
      closeMenu(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-label={`${label}: ${selectedOption?.label ?? "Select a device"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open ? `${listboxId}-option-${activeIndex}` : undefined
        }
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        disabled={options.length === 0}
      >
        <span className={styles.value}>
          {selectedOption?.label ?? "Select a device"}
        </span>
        <span
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          aria-hidden
        >
          <ChevronDown size={16} />
        </span>
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={label}
              data-custom-select-listbox
              className={styles.listbox}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                visibility: positioned ? "visible" : "hidden",
              }}
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  className={`${styles.option} ${index === activeIndex ? styles.optionActive : ""} ${option.value === value ? styles.optionSelected : ""}`}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.value === value
                    ? <span className={styles.checkmark} aria-hidden>
                        ✓
                      </span>
                    : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

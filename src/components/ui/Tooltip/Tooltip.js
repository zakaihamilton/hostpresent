"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

const GAP = 12;
const VIEWPORT_PADDING = 8;
const LONG_PRESS_MS = 450;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computePosition(anchorRect, tooltipRect, placement) {
  if (placement === "left") {
    const top = clamp(
      anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2,
      VIEWPORT_PADDING,
      window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
    );
    const left = clamp(
      anchorRect.left - GAP - tooltipRect.width,
      VIEWPORT_PADDING,
      window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
    );
    return { top, left };
  }

  if (placement === "right") {
    const top = clamp(
      anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2,
      VIEWPORT_PADDING,
      window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
    );
    const left = clamp(
      anchorRect.right + GAP,
      VIEWPORT_PADDING,
      window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
    );
    return { top, left };
  }

  if (placement === "bottom") {
    const top = clamp(
      anchorRect.bottom + GAP,
      VIEWPORT_PADDING,
      window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
    );
    const left = clamp(
      anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2,
      VIEWPORT_PADDING,
      window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
    );
    return { top, left };
  }

  // Fallback for "top"
  const top = clamp(
    anchorRect.top - GAP - tooltipRect.height,
    VIEWPORT_PADDING,
    window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
  );
  const left = clamp(
    anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2,
    VIEWPORT_PADDING,
    window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
  );
  return { top, left };
}

export function Tooltip({
  children,
  text,
  content = null,
  placement = "top",
  forceHidden = false,
  trigger = "hover",
}) {
  const isClickTrigger = trigger === "click";
  const isHoverTrigger = trigger === "hover";
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);
  const suppressUntilLeaveRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressActiveRef = useRef(false);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const showTooltip = visible && !forceHidden;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    setCoords(computePosition(anchorRect, tooltipRect, placement));
  }, [placement]);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showTooltip) {
      setPositioned(false);
      return;
    }

    updatePosition();
    setPositioned(true);

    const handleReposition = () => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [showTooltip, updatePosition]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (suppressUntilLeaveRef.current) return;
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setPositioned(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    suppressUntilLeaveRef.current = false;
    longPressActiveRef.current = false;
    clearLongPressTimer();
    hide();
  }, [clearLongPressTimer, hide]);

  const handleMouseDown = useCallback(() => {
    suppressUntilLeaveRef.current = true;
    hide();
  }, [hide]);

  useEffect(() => {
    if (!isClickTrigger || !visible) return undefined;

    const handlePointerDown = (event) => {
      if (
        anchorRef.current?.contains(event.target) ||
        tooltipRef.current?.contains(event.target)
      ) {
        return;
      }
      hide();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [hide, isClickTrigger, visible]);

  const handleTouchStart = useCallback(() => {
    if (!isHoverTrigger) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressActiveRef.current = true;
      suppressUntilLeaveRef.current = false;
      show();
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, isHoverTrigger, show]);

  const handleTouchEnd = useCallback(() => {
    if (!isHoverTrigger) return;
    clearLongPressTimer();
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false;
      hide();
    }
  }, [clearLongPressTimer, hide, isHoverTrigger]);

  const handleContextMenu = useCallback(
    (event) => {
      if (!isHoverTrigger) return;
      event.preventDefault();
    },
    [isHoverTrigger],
  );

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  useEffect(() => {
    const hideAndReset = () => {
      suppressUntilLeaveRef.current = false;
      longPressActiveRef.current = false;
      clearLongPressTimer();
      hide();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hideAndReset();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        hideAndReset();
      }
    };

    window.addEventListener("blur", hideAndReset);
    window.addEventListener("pagehide", hideAndReset);
    window.addEventListener("pointercancel", hideAndReset);
    window.addEventListener("touchcancel", hideAndReset);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("blur", hideAndReset);
      window.removeEventListener("pagehide", hideAndReset);
      window.removeEventListener("pointercancel", hideAndReset);
      window.removeEventListener("touchcancel", hideAndReset);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearLongPressTimer, hide]);

  const child = cloneElement(children, {
    ...(children.props["aria-describedby"]
      ? {}
      : { "aria-describedby": showTooltip ? tooltipId : undefined }),
    onClick: (event) => {
      if (isClickTrigger) {
        suppressUntilLeaveRef.current = false;
        setVisible((current) => !current);
      }
      children.props.onClick?.(event);
    },
    onMouseDown: (event) => {
      if (isHoverTrigger) {
        handleMouseDown();
      }
      children.props.onMouseDown?.(event);
    },
    onTouchStart: (event) => {
      handleTouchStart();
      children.props.onTouchStart?.(event);
    },
    onTouchEnd: (event) => {
      handleTouchEnd();
      children.props.onTouchEnd?.(event);
    },
    onTouchCancel: (event) => {
      handleTouchEnd();
      children.props.onTouchCancel?.(event);
    },
    onContextMenu: (event) => {
      handleContextMenu(event);
      children.props.onContextMenu?.(event);
    },
  });

  return (
    <>
      <div
        ref={anchorRef}
        className={styles.wrapper}
        onMouseEnter={isHoverTrigger ? show : undefined}
        onMouseLeave={isHoverTrigger ? handleMouseLeave : undefined}
        onFocus={isHoverTrigger ? show : undefined}
        onBlur={isHoverTrigger ? hide : undefined}
        onContextMenu={isHoverTrigger ? handleContextMenu : undefined}
      >
        {child}
      </div>
      {mounted && showTooltip
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={content ? styles.floatingRich : styles.floating}
              style={{
                top: coords.top,
                left: coords.left,
                visibility: positioned ? "visible" : "hidden",
              }}
            >
              {content ?? text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

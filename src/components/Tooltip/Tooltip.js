"use client";

import {
  cloneElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

const GAP = 12;
const VIEWPORT_PADDING = 8;

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

export function Tooltip({ children, text, placement = "top", forceHidden = false }) {
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);
  const suppressUntilLeaveRef = useRef(false);
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

  const show = () => {
    if (suppressUntilLeaveRef.current) return;
    setVisible(true);
  };
  const hide = () => {
    setVisible(false);
    setPositioned(false);
  };
  const handleMouseLeave = () => {
    suppressUntilLeaveRef.current = false;
    hide();
  };
  const handleMouseDown = () => {
    suppressUntilLeaveRef.current = true;
    hide();
  };

  const child = cloneElement(children, {
    ...(children.props["aria-describedby"]
      ? {}
      : { "aria-describedby": showTooltip ? tooltipId : undefined }),
    onMouseDown: (event) => {
      handleMouseDown();
      children.props.onMouseDown?.(event);
    },
  });

  return (
    <>
      <div
        ref={anchorRef}
        className={styles.wrapper}
        onMouseEnter={show}
        onMouseLeave={handleMouseLeave}
        onFocus={show}
        onBlur={hide}
      >
        {child}
      </div>
      {mounted && showTooltip
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={styles.floating}
              style={{
                top: coords.top,
                left: coords.left,
                visibility: positioned ? "visible" : "hidden",
              }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

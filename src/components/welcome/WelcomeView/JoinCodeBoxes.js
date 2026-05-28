"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import styles from "./JoinCodeBoxes.module.css";

const TOTAL = 8;
const GROUP = 4;

function charAt(code, index) {
  const raw = (code ?? "").replace(/-/g, "");
  return raw[index] ?? "";
}

export function JoinCodeBoxes({ value, onChange, readOnly, autoFocus }) {
  const refs = useRef([]);

  const fire = useCallback(
    (characters) => {
      const joined = characters.join("");
      const formatted = formatJoinCode(joined);
      onChange(formatted);
    },
    [onChange],
  );

  const handleChange = (index, char) => {
    if (readOnly) return;
    const upper = char.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!upper && !char) return;
    const chars = Array.from({ length: TOTAL }, (_, i) => charAt(value, i));
    chars[index] = upper;
    fire(chars);
    if (upper && index < TOTAL - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      const current = charAt(value, index);
      if (!current && index > 0) {
        const chars = Array.from({ length: TOTAL }, (_, i) =>
          i === index - 1 ? "" : charAt(value, i),
        );
        chars[index - 1] = "";
        fire(chars);
        refs.current[index - 1]?.focus();
        e.preventDefault();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < TOTAL - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    if (readOnly) return;
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const chars = text.slice(0, TOTAL).split("");
    const padded = Array.from({ length: TOTAL }, (_, i) => chars[i] ?? "");
    fire(padded);
    const lastIndex = Math.min(text.length, TOTAL) - 1;
    refs.current[Math.max(0, lastIndex)]?.focus();
  };

  useEffect(() => {
    if (autoFocus && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocus]);

  const boxes = Array.from({ length: TOTAL }, (_, index) => {
    const ch = charAt(value, index);
    return (
      <input
        // biome-ignore lint/suspicious/noArrayIndexKey: stable 8-item array, never reordered
        key={index}
        id={index === 0 ? "join-code-box-0" : undefined}
        ref={(el) => {
          refs.current[index] = el;
        }}
        className={styles.box}
        type="text"
        inputMode="text"
        maxLength={1}
        value={ch}
        readOnly={readOnly}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => handleChange(index, e.target.value)}
        onKeyDown={(e) => handleKeyDown(index, e)}
        onPaste={index === 0 ? handlePaste : undefined}
        aria-label={`Character ${index + 1}`}
      />
    );
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.groups}>
        <div className={styles.group}>{boxes.slice(0, GROUP)}</div>
        <span className={styles.separator} aria-hidden>
          -
        </span>
        <div className={styles.group}>{boxes.slice(GROUP)}</div>
      </div>
    </div>
  );
}

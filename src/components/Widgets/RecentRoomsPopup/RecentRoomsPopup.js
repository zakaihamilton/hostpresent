"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./RecentRoomsPopup.module.css";

export function RecentRoomsPopup({
  rooms,
  activeToken,
  tokenKey,
  formatLabel,
  onSelect,
  onClear,
  open,
  onOpenChange,
  emptyMessage = "No past rooms yet.",
  title = "Recent rooms",
}) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
  }, [open]);

  const handleSelect = (room) => {
    onSelect(room);
    onOpenChange(false);
  };

  const handleClear = () => {
    onClear();
    onOpenChange(false);
  };

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close recent rooms"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.panel}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => onOpenChange(false)}
            aria-label="Close recent rooms"
          >
            ×
          </button>
        </div>

        <div className={styles.listWrap}>
          {rooms.length === 0
            ? <p className={styles.empty}>{emptyMessage}</p>
            : <ul className={styles.list}>
                {rooms.map((room) => {
                  const roomToken = room[tokenKey];
                  const isActive = roomToken === activeToken;

                  return (
                    <li key={roomToken}>
                      <button
                        type="button"
                        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                        onClick={() => handleSelect(room)}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className={styles.itemLabel}>
                          {formatLabel(room)}
                        </span>
                        {isActive
                          ? <span className={styles.itemBadge}>Current</span>
                          : null}
                      </button>
                    </li>
                  );
                })}
              </ul>}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            disabled={rooms.length === 0}
          >
            Clear recent rooms
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./VirtualList.module.css";

function findStartIndex(offsets, scrollTop) {
  let low = 0;
  let high = offsets.length - 2;

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (offsets[mid + 1] <= scrollTop) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findEndIndex(offsets, scrollBottom) {
  let low = 0;
  let high = offsets.length - 2;

  while (low < high) {
    const mid = low + Math.floor((high - low + 1) / 2);
    if (offsets[mid] <= scrollBottom) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

export function VirtualList({
  items,
  getItemSize,
  overscan = 4,
  className,
  renderItem,
  itemKey,
  ariaLabel,
}) {
  const viewportRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const { offsets, totalHeight } = useMemo(() => {
    const nextOffsets = [0];
    let total = 0;

    for (let index = 0; index < items.length; index += 1) {
      total += getItemSize(index, items[index]);
      nextOffsets.push(total);
    }

    return { offsets: nextOffsets, totalHeight: total };
  }, [getItemSize, items]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      setViewportHeight(viewport.clientHeight);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setScrollTop(viewport.scrollTop);
  }, []);

  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0 || viewportHeight === 0) {
      return { startIndex: 0, endIndex: -1 };
    }

    const scrollBottom = scrollTop + viewportHeight;
    const start = Math.max(0, findStartIndex(offsets, scrollTop) - overscan);
    const end = Math.min(
      items.length - 1,
      findEndIndex(offsets, scrollBottom) + overscan,
    );

    return { startIndex: start, endIndex: end };
  }, [items.length, offsets, overscan, scrollTop, viewportHeight]);

  const visibleItems = useMemo(() => {
    const rows = [];

    for (let index = startIndex; index <= endIndex; index += 1) {
      rows.push({
        item: items[index],
        index,
        offset: offsets[index],
        size: offsets[index + 1] - offsets[index],
      });
    }

    return rows;
  }, [endIndex, items, offsets, startIndex]);

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${className ?? ""}`}
      onScroll={handleScroll}
    >
      <ul
        className={styles.inner}
        style={{ height: totalHeight }}
        aria-label={ariaLabel}
      >
        {visibleItems.map(({ item, index, offset, size }) => (
          <li
            key={itemKey ? itemKey(item, index) : index}
            className={styles.row}
            style={{ top: offset, height: size }}
          >
            {renderItem(item, index)}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Minimal fixed-row-height windowing: only rows near the viewport are rendered. */
export function useWindow(rows: number | ((width: number) => number), rowHeight: number, overscan = 6) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ width: 900, height: 600 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize({ width: el.clientWidth || 900, height: el.clientHeight || 600 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);

  const rowCount = typeof rows === "function" ? rows(size.width) : rows;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + size.height) / rowHeight) + overscan);
  return { ref, onScroll, start, end, rowCount, totalHeight: rowCount * rowHeight, width: size.width };
}

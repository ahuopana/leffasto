import { useMemo } from "react";
import type { LibraryItem } from "../domain/types";
import { MovieCard } from "./MovieCard";
import { useWindow } from "./useWindow";

export const CARD_W = 160;
export const CARD_H = 300;
const GAP = 16;

const columnsFor = (width: number) => Math.max(1, Math.floor((width - 40 + GAP) / (CARD_W + GAP)));

interface Props {
  indexes: readonly number[];
  items: LibraryItem[];
  titles: readonly (string | number)[];
  selected: number | null;
  onSelect: (tmdbId: number) => void;
}

/** Flat poster grid with row windowing, so thousands of movies only render what is visible. */
export function VirtualGrid({ indexes, items, titles, selected, onSelect }: Props) {
  const win = useWindow((width) => Math.ceil(indexes.length / columnsFor(width)), CARD_H + GAP);
  const cols = columnsFor(win.width);
  const cells = useMemo(() => {
    const out: number[][] = [];
    for (let r = win.start; r < win.end; r++) out.push(indexes.slice(r * cols, r * cols + cols) as number[]);
    return out;
  }, [indexes, cols, win.start, win.end]);

  return (
    <div className="virtual-scroll" ref={win.ref} onScroll={win.onScroll}>
      <div style={{ height: win.totalHeight, position: "relative" }}>
        {cells.map((row, k) => (
          <div
            key={win.start + k}
            className="virtual-grid-row"
            style={{ transform: `translateY(${(win.start + k) * (CARD_H + GAP)}px)`, height: CARD_H }}
          >
            {row.map((i) => (
              <MovieCard
                key={items[i].movie.tmdbId}
                item={items[i]}
                title={String(titles[i])}
                selected={selected === items[i].movie.tmdbId}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

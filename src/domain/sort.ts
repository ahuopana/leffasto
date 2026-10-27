import type { LibraryItem, ListColumn, Settings } from "./types";
import { displayGenres, displayTitle } from "./localize";

export type SortKey = string | number;

/** Precomputed per-item sort keys, so the comparator only compares primitives. */
export type SortKeys = Record<ListColumn, SortKey[]>;

const STATUS_RANK = { none: 0, want: 1, watched: 2 } as const;

export function buildSortKeys(
  items: LibraryItem[],
  settings: Pick<Settings, "contentLanguage" | "titleDisplay">,
  countryName: (code: string) => string,
  defaultLocation = "",
): SortKeys {
  const col = <T extends SortKey>(fn: (i: LibraryItem) => T) => items.map(fn);
  return {
    title: col((i) => displayTitle(i.movie, settings)),
    year: col((i) => i.movie.year ?? 0),
    genres: col((i) => displayGenres(i.movie, settings.contentLanguage).join(", ")),
    directors: col((i) => i.movie.directors.join(", ")),
    countries: col((i) => i.movie.countries.map(countryName).join(", ")),
    runtime: col((i) => i.movie.runtime ?? 0),
    rating: col((i) => i.entry.rating ?? 0),
    status: col((i) => STATUS_RANK[i.entry.status] * 2 + (i.entry.owned ? 1 : 0)),
    format: col((i) => (i.entry.owned ? i.entry.format ?? "~" : "")),
    loan: col((i) => i.entry.loan?.person ?? ""),
    location: col((i) => (i.entry.owned ? i.entry.location ?? (defaultLocation || "~") : "")),
  };
}

/** Stable sort of item indexes by a column; empty/zero values always sink to the bottom. */
export function sortIndexes(
  indexes: readonly number[],
  column: ListColumn,
  dir: "asc" | "desc",
  keys: SortKeys,
  collator: Intl.Collator,
): number[] {
  const k = keys[column];
  const titles = keys.title;
  const sign = dir === "asc" ? 1 : -1;
  const empty = (v: SortKey) => v === "" || v === 0;
  return [...indexes].sort((a, b) => {
    const x = k[a], y = k[b];
    const ex = empty(x), ey = empty(y);
    if (ex !== ey && column !== "status") return ex ? 1 : -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
    return c * sign || collator.compare(String(titles[a]), String(titles[b])) || a - b;
  });
}

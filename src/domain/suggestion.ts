import { daysBetween } from "./loans";
import type { LibraryItem, Settings } from "./types";

export type PickReason = "want" | "owned";

export interface Pick {
  item: LibraryItem;
  reason: PickReason;
}

/** One day's suggestion; `skips` are movies the user rejected that day ("Not today"). */
export interface SuggestionDay {
  date: string;
  tmdbId: number;
  skips: number[];
}

type Cfg = Pick_<Settings, "suggestOwnedUnwatched" | "avoidRepeatDays">;
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };

const lentOut = (i: LibraryItem) => i.entry.loan?.direction === "lentTo";

/** Want-to-watch movies (not lent out); owned-unwatched ones too when enabled or when nothing else is left. */
export function candidates(items: LibraryItem[], cfg: Pick_<Settings, "suggestOwnedUnwatched">): Pick[] {
  const want = items.filter((i) => i.entry.status === "want" && !lentOut(i)).map((item) => ({ item, reason: "want" as const }));
  if (want.length && !cfg.suggestOwnedUnwatched) return want;
  const owned = items
    .filter((i) => i.entry.owned && i.entry.status === "none" && !lentOut(i))
    .map((item) => ({ item, reason: "owned" as const }));
  return [...want, ...owned];
}

/** FNV-1a, so the same date always maps to the same number. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function choose(pool: Pick[], date: string, history: SuggestionDay[], skips: number[], cfg: Cfg): Pick | null {
  const recent = new Set(
    history
      .filter((d) => d.date !== date && daysBetween(d.date, date) >= 0 && daysBetween(d.date, date) < cfg.avoidRepeatDays)
      .map((d) => d.tmdbId),
  );
  const notSkipped = pool.filter((p) => !skips.includes(p.item.movie.tmdbId));
  const fresh = notSkipped.filter((p) => !recent.has(p.item.movie.tmdbId));
  const from = fresh.length ? fresh : notSkipped; // small pool: allow repeats rather than nothing
  if (!from.length) return null;
  const sorted = [...from].sort((a, b) => a.item.movie.tmdbId - b.item.movie.tmdbId); // stable regardless of library order
  return sorted[hash(`${date}:${skips.length}`) % sorted.length];
}

export interface PickResult {
  pick: Pick | null;
  history: SuggestionDay[];
}

const MAX_HISTORY = 400;

function upsert(history: SuggestionDay[], day: SuggestionDay): SuggestionDay[] {
  return [...history.filter((d) => d.date !== day.date), day].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_HISTORY);
}

/** Today's suggestion: stable across restarts; recorded in the history the first time it is chosen. */
export function todaysPick(items: LibraryItem[], history: SuggestionDay[], date: string, cfg: Cfg): PickResult {
  const pool = candidates(items, cfg);
  const existing = history.find((d) => d.date === date);
  const kept = existing && pool.find((p) => p.item.movie.tmdbId === existing.tmdbId);
  if (kept) return { pick: kept, history };
  const pick = choose(pool, date, history, existing?.skips ?? [], cfg);
  if (!pick) return { pick: null, history };
  return { pick, history: upsert(history, { date, tmdbId: pick.item.movie.tmdbId, skips: existing?.skips ?? [] }) };
}

/** "Not today": remember the rejected movie and choose another one. */
export function skipPick(items: LibraryItem[], history: SuggestionDay[], date: string, cfg: Cfg): PickResult {
  const existing = history.find((d) => d.date === date);
  const skips = existing ? [...new Set([...existing.skips, existing.tmdbId])] : [];
  const pick = choose(candidates(items, cfg), date, history, skips, cfg);
  if (!pick) return { pick: null, history: existing ? upsert(history, { ...existing, skips }) : history };
  return { pick, history: upsert(history, { date, tmdbId: pick.item.movie.tmdbId, skips }) };
}

import { describe, expect, it } from "vitest";
import { candidates, hash, skipPick, todaysPick } from "../src/domain/suggestion";
import type { SuggestionDay } from "../src/domain/suggestion";
import type { LibraryItem, Movie } from "../src/domain/types";
import { newEntry } from "../src/storage/library";

const movie = (id: number): Movie => ({ tmdbId: id, originalTitle: `M${id}`, titles: {}, overviews: {}, genres: {}, directors: [], cast: [], countries: [] });
const make = (n: number, patch: (id: number) => Partial<LibraryItem["entry"]>): LibraryItem[] =>
  Array.from({ length: n }, (_, k) => ({ movie: movie(k + 1), entry: { ...newEntry(k + 1), ...patch(k + 1) } }));
const cfg = { suggestOwnedUnwatched: false, avoidRepeatDays: 30 };
const wants = (n: number) => make(n, () => ({ status: "want" }));

describe("candidates", () => {
  it("is the want-to-watch list; lent-out movies are excluded", () => {
    const items = make(4, (id) => ({ status: id <= 3 ? "want" : "none", owned: true, loan: id === 2 ? { direction: "lentTo", person: "A", since: "2026-01-01" } : undefined }));
    expect(candidates(items, cfg).map((p) => p.item.movie.tmdbId)).toEqual([1, 3]);
  });
  it("adds owned-unwatched movies when enabled or when nothing is wanted", () => {
    const items = make(3, (id) => ({ status: id === 1 ? "want" : "none", owned: id !== 3 }));
    expect(candidates(items, cfg).map((p) => p.item.movie.tmdbId)).toEqual([1]);
    expect(candidates(items, { suggestOwnedUnwatched: true }).map((p) => [p.item.movie.tmdbId, p.reason])).toEqual([[1, "want"], [2, "owned"]]);
    const none = make(2, () => ({ status: "none", owned: true }));
    expect(candidates(none, cfg)).toHaveLength(2);
  });
  it("is empty when nothing qualifies", () => {
    expect(candidates(make(3, () => ({ status: "watched" })), cfg)).toEqual([]);
  });
});

describe("todaysPick", () => {
  const items = wants(20);
  it("is deterministic for a date, independent of library order, and recorded in history", () => {
    const a = todaysPick(items, [], "2026-03-05", cfg);
    const b = todaysPick([...items].reverse(), [], "2026-03-05", cfg);
    expect(a.pick!.item.movie.tmdbId).toBe(b.pick!.item.movie.tmdbId);
    expect(a.history).toEqual([{ date: "2026-03-05", tmdbId: a.pick!.item.movie.tmdbId, skips: [] }]);
  });
  it("keeps the recorded pick for the day (stable across restarts)", () => {
    const first = todaysPick(items, [], "2026-03-05", cfg);
    const again = todaysPick(items, first.history, "2026-03-05", cfg);
    expect(again.pick!.item.movie.tmdbId).toBe(first.pick!.item.movie.tmdbId);
    expect(again.history).toBe(first.history);
  });
  it("picks something else when the recorded movie is no longer a candidate", () => {
    const first = todaysPick(items, [], "2026-03-05", cfg);
    const rest = items.filter((i) => i.movie.tmdbId !== first.pick!.item.movie.tmdbId);
    expect(todaysPick(rest, first.history, "2026-03-05", cfg).pick!.item.movie.tmdbId).not.toBe(first.pick!.item.movie.tmdbId);
  });
  it("does not repeat a suggestion within the avoid window", () => {
    let history: SuggestionDay[] = [];
    const seen: number[] = [];
    for (let d = 1; d <= 20; d++) {
      const r = todaysPick(items, history, `2026-03-${String(d).padStart(2, "0")}`, cfg);
      history = r.history;
      seen.push(r.pick!.item.movie.tmdbId);
    }
    expect(new Set(seen).size).toBe(20); // 20 days, 20 movies, window 30 -> all distinct
  });
  it("allows repeats when the pool is smaller than the window", () => {
    const small = wants(2);
    let history: SuggestionDay[] = [];
    for (let d = 1; d <= 5; d++) {
      const r = todaysPick(small, history, `2026-03-0${d}`, cfg);
      expect(r.pick).not.toBeNull();
      history = r.history;
    }
  });
  it("returns null for an empty pool", () => {
    expect(todaysPick([], [], "2026-03-05", cfg).pick).toBeNull();
  });
});

describe("skipPick", () => {
  const items = wants(5);
  it("rejects the current movie and never offers it again that day", () => {
    let r = todaysPick(items, [], "2026-03-05", cfg);
    const shown = [r.pick!.item.movie.tmdbId];
    for (let k = 0; k < 4; k++) {
      r = skipPick(items, r.history, "2026-03-05", cfg);
      shown.push(r.pick!.item.movie.tmdbId);
    }
    expect(new Set(shown).size).toBe(5);
    expect(skipPick(items, r.history, "2026-03-05", cfg).pick).toBeNull(); // all skipped
    // the next day starts fresh
    expect(todaysPick(items, r.history, "2026-03-06", cfg).pick).not.toBeNull();
  });
});

describe("hash", () => {
  it("is stable", () => { expect(hash("2026-03-05:0")).toBe(hash("2026-03-05:0")); expect(hash("a")).not.toBe(hash("b")); });
});

import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/domain/facets";
import { countBy, leaderboard, overview, ratingDistribution, releaseHistogram, viewingsByMonth, viewingsByYear } from "../src/domain/stats";
import type { LibraryItem, Movie, UserEntry } from "../src/domain/types";
import { generateLibrary } from "../src/services/synthetic";
import { LibraryStore, newEntry } from "../src/storage/library";

const mv = (id: number, p: Partial<Movie> = {}): Movie => ({
  tmdbId: id, originalTitle: `M${id}`, titles: {}, overviews: {}, genres: { fi: [], en: [] }, directors: [], cast: [], countries: [], ...p,
});
const it_ = (id: number, movie: Partial<Movie>, entry: Partial<UserEntry> = {}): LibraryItem => ({ movie: mv(id, movie), entry: { ...newEntry(id), ...entry } });
const watched = (dates: string[], rating?: number): Partial<UserEntry> => ({ status: "watched", watchedDates: dates, rating });
const collator = new Intl.Collator("en");

const items: LibraryItem[] = [
  it_(1, { year: 1982, runtime: 100, directors: ["Ridley Scott"], genres: { fi: [], en: ["Sci-Fi", "Drama"] }, countries: ["US"] }, { owned: true, ...watched(["2026-01-10", "2026-03-02"], 9) }),
  it_(2, { year: 1986, runtime: 80, directors: ["Aki Kaurismäki"], genres: { fi: [], en: ["Drama"] }, countries: ["FI"] }, { ...watched(["2025-12-31"], 10) }),
  it_(3, { year: 1989, runtime: 70, directors: ["Aki Kaurismäki"], countries: ["FI"] }, { ...watched([], 8) }),
  it_(4, { year: 2001, runtime: 120, directors: ["Jean-Pierre Jeunet"], countries: ["FR"] }, { status: "want" }),
  it_(5, { directors: ["Ridley Scott"] }, { owned: true, loan: { direction: "lentTo", person: "A", since: "2026-01-01" } }),
  it_(6, { year: 2003, directors: ["One Hit"] }, { ...watched(["2024-06-01"], 10) }),
];

describe("overview", () => {
  it("counts states, viewings runtime and average rating", () => {
    expect(overview(items)).toEqual({
      movies: 6, owned: 2, watched: 4, want: 1, onLoan: 1,
      minutesWatched: 100 * 2 + 80 + 70 + 0, // rewatch counted; undated watch counts once; movie 6 has no runtime
      rated: 4, avgRating: (9 + 10 + 8 + 10) / 4,
    });
  });
  it("handles an empty library", () => {
    expect(overview([])).toMatchObject({ movies: 0, minutesWatched: 0, rated: 0 });
    expect(overview([]).avgRating).toBeUndefined();
  });
});

describe("releaseHistogram", () => {
  it("buckets by decade with gaps filled, splits watched/unwatched, counts unknown year", () => {
    const h = releaseHistogram(items, "decade");
    expect(h.unknown).toBe(1);
    expect(h.buckets.map((b) => b.key)).toEqual([1980, 1990, 2000]);
    expect(h.buckets[0]).toEqual({ key: 1980, watched: 3, unwatched: 0 });
    expect(h.buckets[1]).toEqual({ key: 1990, watched: 0, unwatched: 0 });
    expect(h.buckets[2]).toEqual({ key: 2000, watched: 1, unwatched: 1 });
  });
  it("buckets by year", () => {
    expect(releaseHistogram(items, "year").buckets).toHaveLength(2003 - 1982 + 1);
    expect(releaseHistogram([], "year")).toEqual({ buckets: [], unknown: 0 });
  });
});

describe("viewings", () => {
  it("covers a window of months across a year boundary, counts rewatches, reports outside and undated", () => {
    const v = viewingsByMonth(items, "2026-03", 4);
    expect(v.buckets).toEqual([
      { key: "2025-12", count: 1 }, { key: "2026-01", count: 1 }, { key: "2026-02", count: 0 }, { key: "2026-03", count: 1 },
    ]);
    expect(v.outside).toBe(1); // 2024-06-01
    expect(v.undated).toBe(1); // movie 3
  });
  it("groups by year with gaps filled", () => {
    expect(viewingsByYear(items).buckets).toEqual([
      { key: "2024", count: 1 }, { key: "2025", count: 1 }, { key: "2026", count: 2 },
    ]);
  });
});

describe("ratingDistribution", () => {
  it("counts per half star with mean and median", () => {
    const d = ratingDistribution(items);
    expect(d.counts).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 2]);
    expect(d.rated).toBe(4);
    expect(d.mean).toBe(9.25);
    expect(d.median).toBe(9.5);
    expect(ratingDistribution([]).mean).toBeUndefined();
  });
});

describe("leaderboard", () => {
  const index = buildIndex(items, { contentLanguage: "en" }, "2026-03-10");
  const all = items.map((_, i) => i);
  const opts = { collator };

  it("ranks directors by average rating; minimum rated movies filters one-hit wonders", () => {
    const rows = leaderboard(index, all, "director", { ...opts, metric: "avg", minRated: 2 });
    expect(rows.map((r) => [r.value, r.avg, r.rated])).toEqual([["Aki Kaurismäki", 9, 2]]);
    const loose = leaderboard(index, all, "director", { ...opts, metric: "avg", minRated: 1 });
    expect(loose.map((r) => r.value)).toEqual(["One Hit", "Aki Kaurismäki", "Ridley Scott"]);
  });
  it("breaks ties by rated count, then movies, then name", () => {
    // One Hit: avg 10, 1 rated. Kaurismäki avg 9. Ridley Scott avg 9 over 1 rated (movie 5 unrated).
    const rows = leaderboard(index, all, "director", { ...opts, metric: "avg", minRated: 1 });
    expect(rows.map((r) => r.value)).toEqual(["One Hit", "Aki Kaurismäki", "Ridley Scott"]);
  });
  it("ranks by number of movies and by watched; multi-valued facets count a movie under each value", () => {
    expect(leaderboard(index, all, "director", { ...opts, metric: "movies", minRated: 1 })[0].movies).toBe(2);
    const genres = leaderboard(index, all, "genre", { ...opts, metric: "movies", minRated: 1 });
    expect(genres.find((g) => g.value === "Drama")!.movies).toBe(2);
    expect(genres.find((g) => g.value === "Sci-Fi")!.movies).toBe(1);
    expect(leaderboard(index, all, "director", { ...opts, metric: "watched", minRated: 1 })[0].value).toBe("Aki Kaurismäki");
  });
  it("excludes the Unknown value and respects the subset of indexes", () => {
    const genres = leaderboard(index, all, "genre", { ...opts, metric: "movies", minRated: 1 });
    expect(genres.some((g) => g.value === "__unknown__")).toBe(false);
    expect(leaderboard(index, [0], "director", { ...opts, metric: "movies", minRated: 1 }).map((r) => r.value)).toEqual(["Ridley Scott"]);
    expect(leaderboard(index, [], "director", { ...opts, metric: "avg", minRated: 1 })).toEqual([]);
  });
  it("countBy counts values over a subset", () => {
    expect(countBy(index, all, "country").get("FI")).toBe(2);
    expect(countBy(index, [3], "country").get("FR")).toBe(1);
  });
});

describe("setWatchedDates", () => {
  it("replaces, sorts, dedupes and drops invalid dates", () => {
    const storage = new Map<string, string>();
    const store = new LibraryStore({ getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) } as unknown as Storage);
    store.add(mv(1));
    store.markWatched(1, new Date("2026-03-05T12:00:00Z"));
    store.setWatchedDates(1, ["2026-02-01", "2020-01-01", "2026-02-01", "nope"]);
    expect(store.list()[0].entry.watchedDates).toEqual(["2020-01-01", "2026-02-01"]);
    expect(store.list()[0].entry.status).toBe("watched");
  });
});

describe("performance", () => {
  const big = generateLibrary(5000);
  const index = buildIndex(big, { contentLanguage: "fi" }, "2026-03-10");
  const all = big.map((_, i) => i);
  it("computes every statistic for 5,000 movies quickly", () => {
    const t = performance.now();
    overview(big); releaseHistogram(big, "year"); viewingsByMonth(big, "2026-03"); viewingsByYear(big); ratingDistribution(big);
    for (const f of ["director", "actor", "genre", "country", "decade", "language"] as const) {
      leaderboard(index, all, f, { collator, metric: "avg", minRated: 2 });
    }
    expect(performance.now() - t).toBeLessThan(500);
  });
});

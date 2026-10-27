import { UNKNOWN } from "./facets";
import type { FacetIndex } from "./facets";
import type { FacetId, LibraryItem } from "./types";

export interface Overview {
  movies: number;
  owned: number;
  watched: number;
  want: number;
  onLoan: number;
  /** Runtime of watched movies, each viewing counted. */
  minutesWatched: number;
  rated: number;
  /** Average rating on the 1-10 scale. */
  avgRating?: number;
}

export function overview(items: readonly LibraryItem[]): Overview {
  const o: Overview = { movies: items.length, owned: 0, watched: 0, want: 0, onLoan: 0, minutesWatched: 0, rated: 0 };
  let sum = 0;
  for (const { movie, entry } of items) {
    if (entry.owned) o.owned++;
    if (entry.status === "want") o.want++;
    if (entry.loan) o.onLoan++;
    if (entry.status === "watched") {
      o.watched++;
      o.minutesWatched += (movie.runtime ?? 0) * Math.max(1, entry.watchedDates.length);
    }
    if (entry.rating !== undefined) { o.rated++; sum += entry.rating; }
  }
  if (o.rated) o.avgRating = sum / o.rated;
  return o;
}

export interface ReleaseBucket {
  /** Decade start (1980) or year. */
  key: number;
  watched: number;
  unwatched: number;
}

export interface ReleaseHistogram {
  buckets: ReleaseBucket[];
  /** Movies without a release year. */
  unknown: number;
}

/** Movies per release decade or year, contiguous from the first to the last bucket (gaps are zeros). */
export function releaseHistogram(items: readonly LibraryItem[], unit: "decade" | "year"): ReleaseHistogram {
  const counts = new Map<number, ReleaseBucket>();
  let unknown = 0;
  for (const { movie, entry } of items) {
    if (!movie.year) { unknown++; continue; }
    const key = unit === "decade" ? Math.floor(movie.year / 10) * 10 : movie.year;
    const b = counts.get(key) ?? { key, watched: 0, unwatched: 0 };
    if (entry.status === "watched") b.watched++;
    else b.unwatched++;
    counts.set(key, b);
  }
  if (!counts.size) return { buckets: [], unknown };
  const keys = [...counts.keys()];
  const step = unit === "decade" ? 10 : 1;
  const buckets: ReleaseBucket[] = [];
  for (let k = Math.min(...keys); k <= Math.max(...keys); k += step) buckets.push(counts.get(k) ?? { key: k, watched: 0, unwatched: 0 });
  return { buckets, unknown };
}

export interface Viewings {
  /** "YYYY-MM" or "YYYY" keys, contiguous, oldest first. */
  buckets: { key: string; count: number }[];
  /** Viewings outside the shown range. */
  outside: number;
  /** Watched movies with no recorded date. */
  undated: number;
}

const monthKey = (d: string) => d.slice(0, 7);

function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Viewings (each watched date counts, so rewatches too) for the `months` months ending at `endMonth` ("YYYY-MM"). */
export function viewingsByMonth(items: readonly LibraryItem[], endMonth: string, months = 24): Viewings {
  const start = addMonths(endMonth, -(months - 1));
  const buckets = Array.from({ length: months }, (_, i) => ({ key: addMonths(start, i), count: 0 }));
  const at = new Map(buckets.map((b) => [b.key, b]));
  let outside = 0, undated = 0;
  for (const { entry } of items) {
    if (entry.status === "watched" && !entry.watchedDates.length) undated++;
    for (const d of entry.watchedDates) {
      const b = at.get(monthKey(d));
      if (b) b.count++;
      else outside++;
    }
  }
  return { buckets, outside, undated };
}

export function viewingsByYear(items: readonly LibraryItem[]): Viewings {
  const counts = new Map<number, number>();
  let undated = 0;
  for (const { entry } of items) {
    if (entry.status === "watched" && !entry.watchedDates.length) undated++;
    for (const d of entry.watchedDates) counts.set(Number(d.slice(0, 4)), (counts.get(Number(d.slice(0, 4))) ?? 0) + 1);
  }
  if (!counts.size) return { buckets: [], outside: 0, undated };
  const years = [...counts.keys()];
  const buckets = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) buckets.push({ key: String(y), count: counts.get(y) ?? 0 });
  return { buckets, outside: 0, undated };
}

export interface RatingDistribution {
  /** counts[i] = movies rated (i + 1) / 2 stars, i = 0..9. */
  counts: number[];
  rated: number;
  /** Mean and median on the 1-10 scale. */
  mean?: number;
  median?: number;
}

export function ratingDistribution(items: readonly LibraryItem[]): RatingDistribution {
  const counts = Array<number>(10).fill(0);
  const ratings: number[] = [];
  for (const { entry } of items) {
    if (entry.rating === undefined) continue;
    counts[Math.min(10, Math.max(1, Math.round(entry.rating))) - 1]++;
    ratings.push(entry.rating);
  }
  if (!ratings.length) return { counts, rated: 0 };
  ratings.sort((a, b) => a - b);
  const mid = ratings.length >> 1;
  return {
    counts,
    rated: ratings.length,
    mean: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    median: ratings.length % 2 ? ratings[mid] : (ratings[mid - 1] + ratings[mid]) / 2,
  };
}

export type LeaderMetric = "avg" | "movies" | "watched";

export interface LeaderRow {
  value: string;
  movies: number;
  watched: number;
  rated: number;
  /** Average rating on the 1-10 scale (undefined when nothing is rated). */
  avg?: number;
}

/**
 * Ranks the values of a facet (directors, actors, genres, countries, ...) over the given item indexes.
 * "avg" ranks by average rating and only includes values with at least `minRated` rated movies,
 * so a single 5-star film cannot top the list. Ties: more rated, more movies, then name.
 */
export function leaderboard(
  index: FacetIndex,
  indexes: readonly number[],
  facet: FacetId,
  opts: { metric: LeaderMetric; minRated: number; collator: Intl.Collator; label?: (value: string) => string },
): LeaderRow[] {
  const acc = new Map<string, { movies: number; watched: number; rated: number; sum: number }>();
  for (const i of indexes) {
    const { entry } = index.items[i];
    for (const v of index.values[facet][i]) {
      if (v === UNKNOWN) continue;
      const r = acc.get(v) ?? { movies: 0, watched: 0, rated: 0, sum: 0 };
      r.movies++;
      if (entry.status === "watched") r.watched++;
      if (entry.rating !== undefined) { r.rated++; r.sum += entry.rating; }
      acc.set(v, r);
    }
  }
  const label = opts.label ?? ((v: string) => v);
  const rows: LeaderRow[] = [...acc].map(([value, r]) => ({
    value, movies: r.movies, watched: r.watched, rated: r.rated, avg: r.rated ? r.sum / r.rated : undefined,
  }));
  const eligible = opts.metric === "avg" ? rows.filter((r) => r.avg !== undefined && r.rated >= Math.max(1, opts.minRated)) : rows;
  const by = (r: LeaderRow) => (opts.metric === "avg" ? r.avg ?? 0 : opts.metric === "watched" ? r.watched : r.movies);
  return eligible.sort(
    (a, b) => by(b) - by(a) || b.rated - a.rated || b.movies - a.movies || opts.collator.compare(label(a.value), label(b.value)),
  );
}

/** Movies per value of a facet (Unknown excluded), in no particular order. */
export function countBy(index: FacetIndex, indexes: readonly number[], facet: FacetId): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of indexes) for (const v of index.values[facet][i]) if (v !== UNKNOWN) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

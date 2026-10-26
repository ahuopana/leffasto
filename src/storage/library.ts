import { defaultSettings } from "../domain/types";
import type { LibraryItem, Movie, Settings, UserEntry } from "../domain/types";

const LIBRARY_KEY = "leffasto.library.v2";
const LEGACY_LIBRARY_KEY = "leffasto.library.v1";
const SETTINGS_KEY = "leffasto.settings.v1";

export function newEntry(tmdbId: number, now = new Date()): UserEntry {
  return { tmdbId, owned: false, status: "none", watchedDates: [], notes: "", addedAt: now.toISOString() };
}

const today = (now: Date) => now.toISOString().slice(0, 10);

/** A rating only makes sense for a watched movie. */
function normalizeEntry(entry: UserEntry, now = new Date()): UserEntry {
  if (entry.rating !== undefined && entry.status !== "watched") {
    const dates = entry.watchedDates.length ? entry.watchedDates : [today(now)];
    return { ...entry, status: "watched", watchedDates: dates };
  }
  return entry;
}

export interface StoreOptions {
  /** Delay before writing to storage; 0 writes synchronously (tests). */
  debounceMs?: number;
}

/**
 * Local-first persistence on top of any Storage (localStorage in the app, a fake in tests).
 * The library is kept in memory; writes are debounced so rapid edits stay fast on big libraries.
 */
export class LibraryStore {
  private items: LibraryItem[] | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private storage: Storage, private options: StoreOptions = {}) {}

  list(): LibraryItem[] {
    if (!this.items) this.items = this.load();
    return this.items;
  }

  private load(): LibraryItem[] {
    try {
      const raw = this.storage.getItem(LIBRARY_KEY) ?? this.storage.getItem(LEGACY_LIBRARY_KEY);
      const parsed = raw ? (JSON.parse(raw) as LibraryItem[]) : [];
      return parsed.map((i) => ({ ...i, entry: normalizeEntry(i.entry) }));
    } catch {
      return [];
    }
  }

  private commit(items: LibraryItem[]): LibraryItem[] {
    this.items = items;
    if (!this.options.debounceMs) this.flush();
    else if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), this.options.debounceMs);
    return items;
  }

  /** Writes pending changes now (also call on window unload). */
  flush() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.items) this.storage.setItem(LIBRARY_KEY, JSON.stringify(this.items));
  }

  /** Adds the movie, or refreshes its metadata while keeping the user's entry. */
  add(movie: Movie): LibraryItem[] {
    const items = this.list();
    const i = items.findIndex((x) => x.movie.tmdbId === movie.tmdbId);
    if (i >= 0) return this.commit(items.map((x, k) => (k === i ? { ...x, movie } : x)));
    return this.commit([...items, { movie, entry: newEntry(movie.tmdbId) }]);
  }

  private patch(tmdbId: number, fn: (e: UserEntry) => UserEntry): LibraryItem[] {
    const items = this.list();
    if (!items.some((i) => i.movie.tmdbId === tmdbId)) return items;
    return this.commit(items.map((i) => (i.movie.tmdbId === tmdbId ? { ...i, entry: normalizeEntry(fn(i.entry)) } : i)));
  }

  update(tmdbId: number, patch: Partial<Omit<UserEntry, "tmdbId" | "addedAt">>): LibraryItem[] {
    return this.patch(tmdbId, (e) => {
      const next = { ...e, ...patch };
      // Leaving "watched" drops the rating; otherwise normalizeEntry would silently re-watch it.
      if (patch.status !== undefined && patch.status !== "watched" && patch.rating === undefined) delete next.rating;
      return next;
    });
  }

  /** Sets a rating; an unwatched movie becomes watched today. */
  setRating(tmdbId: number, rating: number | undefined, now = new Date()): LibraryItem[] {
    return this.patch(tmdbId, (e) => {
      if (rating === undefined) {
        const { rating: _drop, ...rest } = e;
        return rest;
      }
      return {
        ...e,
        rating,
        status: "watched",
        watchedDates: e.status === "watched" || e.watchedDates.length ? e.watchedDates : [today(now)],
      };
    });
  }

  /** Marks as watched today, which also clears the want-to-watch state. */
  markWatched(tmdbId: number, now = new Date()): LibraryItem[] {
    return this.patch(tmdbId, (e) => ({ ...e, status: "watched", watchedDates: [...e.watchedDates, today(now)] }));
  }

  /** Back to "not watched"; clears the rating (and keeps the watch history). */
  markUnwatched(tmdbId: number): LibraryItem[] {
    return this.update(tmdbId, { status: "none" });
  }

  remove(tmdbId: number): LibraryItem[] {
    return this.commit(this.list().filter((i) => i.movie.tmdbId !== tmdbId));
  }

  getSettings(): Settings {
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      return { ...defaultSettings, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...defaultSettings };
    }
  }

  saveSettings(settings: Settings) {
    this.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

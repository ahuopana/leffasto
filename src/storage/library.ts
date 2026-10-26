import { defaultSettings } from "../domain/types";
import type { LibraryItem, Movie, Settings, UserEntry } from "../domain/types";

const LIBRARY_KEY = "leffasto.library.v1";
const SETTINGS_KEY = "leffasto.settings.v1";

export function newEntry(tmdbId: number, now = new Date()): UserEntry {
  return { tmdbId, owned: false, status: "none", watchedDates: [], notes: "", addedAt: now.toISOString() };
}

/** Local-first persistence on top of any Storage (localStorage in the app, a fake in tests). */
export class LibraryStore {
  constructor(private storage: Storage) {}

  list(): LibraryItem[] {
    try {
      const raw = this.storage.getItem(LIBRARY_KEY);
      return raw ? (JSON.parse(raw) as LibraryItem[]) : [];
    } catch {
      return [];
    }
  }

  private save(items: LibraryItem[]) {
    this.storage.setItem(LIBRARY_KEY, JSON.stringify(items));
  }

  /** Adds the movie, or refreshes its metadata while keeping the user's entry. */
  add(movie: Movie): LibraryItem[] {
    const items = this.list();
    const existing = items.find((i) => i.movie.tmdbId === movie.tmdbId);
    if (existing) existing.movie = movie;
    else items.push({ movie, entry: newEntry(movie.tmdbId) });
    this.save(items);
    return items;
  }

  update(tmdbId: number, patch: Partial<Omit<UserEntry, "tmdbId" | "addedAt">>): LibraryItem[] {
    const items = this.list();
    const item = items.find((i) => i.movie.tmdbId === tmdbId);
    if (!item) return items;
    item.entry = { ...item.entry, ...patch };
    this.save(items);
    return items;
  }

  /** Marks as watched today, which also clears the want-to-watch state. */
  markWatched(tmdbId: number, now = new Date()): LibraryItem[] {
    const item = this.list().find((i) => i.movie.tmdbId === tmdbId);
    if (!item) return this.list();
    return this.update(tmdbId, {
      status: "watched",
      watchedDates: [...item.entry.watchedDates, now.toISOString().slice(0, 10)],
    });
  }

  remove(tmdbId: number): LibraryItem[] {
    const items = this.list().filter((i) => i.movie.tmdbId !== tmdbId);
    this.save(items);
    return items;
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

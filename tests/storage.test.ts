import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_MOVIES } from "../src/services/demo";
import { LibraryStore } from "../src/storage/library";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe("LibraryStore", () => {
  let storage: MemoryStorage;
  let store: LibraryStore;
  beforeEach(() => { storage = new MemoryStorage(); store = new LibraryStore(storage); });

  it("persists across instances", () => {
    store.add(DEMO_MOVIES[0]);
    expect(new LibraryStore(storage).list()).toHaveLength(1);
  });
  it("re-adding keeps the user's entry", () => {
    store.add(DEMO_MOVIES[0]);
    store.update(1, { rating: 8, owned: true });
    store.add({ ...DEMO_MOVIES[0], runtime: 1 });
    const [item] = store.list();
    expect(item.entry.rating).toBe(8);
    expect(item.movie.runtime).toBe(1);
  });
  it("markWatched sets status and records the date", () => {
    store.add(DEMO_MOVIES[0]);
    store.update(1, { status: "want" });
    store.markWatched(1, new Date("2026-03-15T12:00:00Z"));
    const { entry } = store.list()[0];
    expect(entry.status).toBe("watched");
    expect(entry.watchedDates).toEqual(["2026-03-15"]);
  });
  it("rating an unwatched movie marks it watched", () => {
    store.add(DEMO_MOVIES[0]);
    store.setRating(1, 7, new Date("2026-03-15T12:00:00Z"));
    const { entry } = store.list()[0];
    expect(entry).toMatchObject({ rating: 7, status: "watched", watchedDates: ["2026-03-15"] });
  });
  it("update cannot create a rating on an unwatched movie", () => {
    store.add(DEMO_MOVIES[0]);
    store.update(1, { rating: 6 });
    expect(store.list()[0].entry.status).toBe("watched");
  });
  it("un-watching clears the rating but keeps history", () => {
    store.add(DEMO_MOVIES[0]);
    store.setRating(1, 9, new Date("2026-03-15T12:00:00Z"));
    store.markUnwatched(1);
    const { entry } = store.list()[0];
    expect(entry.rating).toBeUndefined();
    expect(entry.status).toBe("none");
    expect(entry.watchedDates).toEqual(["2026-03-15"]);
  });
  it("clearing a rating keeps the movie watched", () => {
    store.add(DEMO_MOVIES[0]);
    store.setRating(1, 9);
    store.setRating(1, undefined);
    expect(store.list()[0].entry).toMatchObject({ status: "watched" });
    expect(store.list()[0].entry.rating).toBeUndefined();
  });
  it("migrates v1 data with a rating but no watched status", () => {
    const legacy = [{ movie: DEMO_MOVIES[0], entry: { tmdbId: 1, owned: false, status: "want", rating: 8, watchedDates: [], notes: "", addedAt: "2026-01-01T00:00:00Z" } }];
    storage.setItem("leffasto.library.v1", JSON.stringify(legacy));
    const { entry } = new LibraryStore(storage).list()[0];
    expect(entry.status).toBe("watched");
    expect(entry.rating).toBe(8);
    expect(entry.watchedDates).toHaveLength(1);
  });
  it("debounces writes and flush() writes immediately", () => {
    const deb = new LibraryStore(storage, { debounceMs: 10_000 });
    deb.add(DEMO_MOVIES[0]);
    expect(storage.getItem("leffasto.library.v2")).toBeNull();
    deb.flush();
    expect(JSON.parse(storage.getItem("leffasto.library.v2")!)).toHaveLength(1);
  });
  it("removes and survives corrupt data", () => {
    store.add(DEMO_MOVIES[0]);
    store.remove(1);
    expect(store.list()).toEqual([]);
    storage.setItem("leffasto.library.v2", "{not json");
    expect(new LibraryStore(storage).list()).toEqual([]);
  });
  it("settings default and persist", () => {
    expect(store.getSettings().contentLanguage).toBe("fi");
    store.saveSettings({ ...store.getSettings(), tmdbApiKey: "abc" });
    expect(new LibraryStore(storage).getSettings().tmdbApiKey).toBe("abc");
  });
});

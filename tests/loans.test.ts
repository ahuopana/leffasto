import { beforeEach, describe, expect, it } from "vitest";
import { dateKey, daysBetween, isOverdue, overdueDays } from "../src/domain/loans";
import { buildIndex, facetValues, visibleFacets } from "../src/domain/facets";
import { applyFilters, emptyFilter, selectValues } from "../src/domain/filter";
import { DEMO_MOVIES } from "../src/services/demo";
import { LibraryStore } from "../src/storage/library";

class MemoryStorage implements Storage {
  private d = new Map<string, string>();
  get length() { return this.d.size; }
  clear() { this.d.clear(); }
  getItem(k: string) { return this.d.get(k) ?? null; }
  key(i: number) { return [...this.d.keys()][i] ?? null; }
  removeItem(k: string) { this.d.delete(k); }
  setItem(k: string, v: string) { this.d.set(k, v); }
}

describe("date helpers", () => {
  it("uses the local calendar date", () => {
    expect(dateKey(new Date(2026, 2, 5, 23, 59))).toBe("2026-03-05");
  });
  it("counts whole days, also across month and DST boundaries", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // EU DST change
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
    expect(daysBetween("2026-03-05", "2026-03-01")).toBe(-4);
  });
  it("overdue only after the due date", () => {
    expect(overdueDays({ due: "2026-03-10" }, "2026-03-10")).toBe(0);
    expect(overdueDays({ due: "2026-03-10" }, "2026-03-13")).toBe(3);
    expect(isOverdue({}, "2026-03-13")).toBe(false);
  });
});

describe("loans in the store", () => {
  let store: LibraryStore;
  const now = new Date(2026, 2, 5, 12);
  beforeEach(() => { store = new LibraryStore(new MemoryStorage()); DEMO_MOVIES.slice(0, 3).forEach((m) => store.add(m)); });
  const entry = (id: number) => store.list().find((i) => i.movie.tmdbId === id)!.entry;

  it("lending requires an owned movie", () => {
    store.lend(1, "Maija", {}, now);
    expect(entry(1).loan).toBeUndefined();
    store.update(1, { owned: true });
    store.lend(1, "Maija", { due: "2026-03-20" }, now);
    expect(entry(1).loan).toEqual({ direction: "lentTo", person: "Maija", since: "2026-03-05", due: "2026-03-20", note: undefined });
  });
  it("borrowing works for movies you don't own", () => {
    store.borrow(2, "Jussi", { note: "DVD" }, now);
    expect(entry(2).loan).toMatchObject({ direction: "borrowedFrom", person: "Jussi", note: "DVD" });
  });
  it("only one active loan per movie; blank names are ignored", () => {
    store.update(1, { owned: true });
    store.lend(1, "Maija", {}, now);
    store.borrow(1, "Jussi", {}, now);
    expect(entry(1).loan!.person).toBe("Maija");
    store.borrow(2, "   ", {}, now);
    expect(entry(2).loan).toBeUndefined();
  });
  it("returning moves the loan to history", () => {
    store.update(1, { owned: true });
    store.lend(1, "Maija", {}, now);
    store.returnLoan(1, new Date(2026, 2, 12));
    expect(entry(1).loan).toBeUndefined();
    expect(entry(1).loanHistory).toEqual([{ direction: "lentTo", person: "Maija", since: "2026-03-05", returned: "2026-03-12" }]);
    store.lend(1, "Pekka", {}, now); // can be lent again
    expect(entry(1).loan!.person).toBe("Pekka");
  });
  it("people lists everyone, most recent first", () => {
    store.update(1, { owned: true });
    store.lend(1, "Maija", {}, new Date(2026, 0, 1));
    store.returnLoan(1, new Date(2026, 0, 5));
    store.borrow(2, "Jussi", {}, new Date(2026, 2, 1));
    expect(store.people()).toEqual(["Jussi", "Maija"]);
  });
  it("loans persist and keep their data after reload", () => {
    const storage = new MemoryStorage();
    const a = new LibraryStore(storage);
    a.add(DEMO_MOVIES[0]); a.update(1, { owned: true }); a.lend(1, "Maija", {}, now);
    expect(new LibraryStore(storage).list()[0].entry.loan?.person).toBe("Maija");
  });
});

describe("loan facets and the Loaned preset", () => {
  const store = new LibraryStore(new MemoryStorage());
  DEMO_MOVIES.slice(0, 4).forEach((m) => store.add(m));
  store.update(1, { owned: true });
  store.lend(1, "Maija", { due: "2026-03-01" }, new Date(2026, 1, 1));
  store.borrow(2, "Jussi", { due: "2026-04-01" }, new Date(2026, 1, 1));
  const items = store.list();
  const today = "2026-03-10";

  it("status values reflect active loans and overdue", () => {
    expect(facetValues("status", items[0], { contentLanguage: "fi", today })).toEqual(["owned", "unwatched", "lent", "overdue"]);
    expect(facetValues("status", items[1], { contentLanguage: "fi", today })).toEqual(["unwatched", "borrowed"]);
    expect(facetValues("person", items[0], { contentLanguage: "fi" })).toEqual(["Maija"]);
  });
  it("Loaned preset shows lent and borrowed movies", () => {
    const index = buildIndex(items, { contentLanguage: "fi" }, today);
    const ids = applyFilters(index, selectValues(emptyFilter, "status", ["lent", "borrowed"])).map((i) => items[i].movie.tmdbId);
    expect(ids).toEqual([1, 2]);
    expect(applyFilters(index, selectValues(emptyFilter, "status", ["overdue"])).map((i) => items[i].movie.tmdbId)).toEqual([1]);
  });
  it("person facet only shows when loans exist", () => {
    expect(visibleFacets(buildIndex(items, { contentLanguage: "fi" }, today))).toContain("person");
    expect(visibleFacets(buildIndex(items.map((i) => ({ ...i, entry: { ...i.entry, loan: undefined } })), { contentLanguage: "fi" }, today))).not.toContain("person");
  });
});

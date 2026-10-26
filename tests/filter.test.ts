import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/domain/facets";
import { applyFilters, emptyFilter, isActive, isChecked, selectAll, selectNone, selectOnly, toggleValue } from "../src/domain/filter";
import type { LibraryItem, Movie } from "../src/domain/types";
import { newEntry } from "../src/storage/library";

const movie = (id: number, genres: string[], year = 2000): Movie => ({
  tmdbId: id, originalTitle: `M${id}`, year, titles: {}, overviews: {}, genres: { fi: genres, en: genres }, directors: [], cast: [], countries: [],
});
const items: LibraryItem[] = [
  { movie: movie(1, ["Drama"], 1985), entry: newEntry(1) },
  { movie: movie(2, ["Drama", "Comedy"], 1995), entry: newEntry(2) },
  { movie: movie(3, ["Comedy"], 2005), entry: newEntry(3) },
  { movie: movie(4, [], 2015), entry: newEntry(4) },
];
const index = buildIndex(items, { contentLanguage: "fi" });
const ids = (f: ReturnType<typeof applyFilters>) => f.map((i) => items[i].movie.tmdbId);
const GENRES = ["Drama", "Comedy", "__unknown__"];

describe("filters", () => {
  it("default has no restriction", () => {
    expect(ids(applyFilters(index, emptyFilter))).toEqual([1, 2, 3, 4]);
    expect(isActive(emptyFilter)).toBe(false);
  });
  it("unchecking from all removes every movie that has that value", () => {
    const f = toggleValue(emptyFilter, "genre", "Drama", GENRES);
    expect(ids(applyFilters(index, f))).toEqual([3, 4]); // Drama+Comedy is removed too
    expect(isChecked(f.facets.genre, "Drama")).toBe(false);
    expect(isChecked(f.facets.genre, "Comedy")).toBe(true);
  });
  it("re-checking the last unchecked value restores 'all'", () => {
    let f = toggleValue(emptyFilter, "genre", "Drama", GENRES);
    f = toggleValue(f, "genre", "Drama", GENRES);
    expect(f.facets.genre).toBeUndefined();
  });
  it("None then check adds movies that have that value", () => {
    let f = selectNone(emptyFilter, "genre");
    expect(ids(applyFilters(index, f))).toEqual([]);
    f = toggleValue(f, "genre", "Comedy", GENRES);
    expect(ids(applyFilters(index, f))).toEqual([2, 3]);
    f = toggleValue(f, "genre", "Drama", GENRES);
    expect(ids(applyFilters(index, f))).toEqual([1, 2, 3]);
  });
  it("checking everything in include mode returns to no restriction", () => {
    let f = selectNone(emptyFilter, "genre");
    for (const g of GENRES) f = toggleValue(f, "genre", g, GENRES);
    expect(f.facets.genre).toBeUndefined();
  });
  it("unchecking everything from all behaves like None", () => {
    let f = emptyFilter;
    for (const g of GENRES) f = toggleValue(f, "genre", g, GENRES);
    expect(f.facets.genre).toMatchObject({ mode: "include" });
    expect(ids(applyFilters(index, f))).toEqual([]);
  });
  it("Unknown values can be toggled", () => {
    const f = toggleValue(emptyFilter, "genre", "__unknown__", GENRES);
    expect(ids(applyFilters(index, f))).toEqual([1, 2, 3]);
  });
  it("facets combine with AND and text query applies on top", () => {
    let f = toggleValue(emptyFilter, "genre", "Drama", GENRES); // 3, 4
    f = toggleValue(f, "decade", "2010s", ["1980s", "1990s", "2000s", "2010s"]); // removes 4
    expect(ids(applyFilters(index, f))).toEqual([3]);
    expect(ids(applyFilters(index, { ...f, query: "m4" }))).toEqual([]);
  });
  it("selectAll resets one facet; selectOnly is a preset", () => {
    const f = selectOnly(emptyFilter, "decade", "1980s");
    expect(ids(applyFilters(index, f))).toEqual([1]);
    expect(applyFilters(index, selectAll(f, "decade"))).toHaveLength(4);
  });
});

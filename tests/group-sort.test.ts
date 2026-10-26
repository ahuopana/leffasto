import { describe, expect, it } from "vitest";
import { buildIndex, orderedValues } from "../src/domain/facets";
import { groupItems, OTHER } from "../src/domain/group";
import { buildSortKeys, sortIndexes } from "../src/domain/sort";
import { DEMO_MOVIES } from "../src/services/demo";
import { newEntry } from "../src/storage/library";
import type { LibraryItem } from "../src/domain/types";

const items: LibraryItem[] = DEMO_MOVIES.map((movie) => ({ movie, entry: newEntry(movie.tmdbId) }));
const index = buildIndex(items, { contentLanguage: "fi" });
const all = items.map((_, i) => i);
const collator = new Intl.Collator("fi");
const order = (facet: Parameters<typeof orderedValues>[0]) => (c: Map<string, number>) => orderedValues(facet, c, collator, (v) => v);

describe("groupItems", () => {
  it("puts a movie under every genre it has", () => {
    const groups = groupItems(index, all, "genre", order("genre"));
    const drama = groups.find((g) => g.key === "Draama")!;
    const comedy = groups.find((g) => g.key === "Komedia")!;
    expect(drama.indexes.length).toBeGreaterThan(1);
    expect(groups.flatMap((g) => g.indexes).length).toBeGreaterThan(all.length);
    expect(comedy.indexes.some((i) => drama.indexes.includes(i))).toBe(true); // Toivon tuolla puolen is in both
  });
  it("folds small groups into Other when minSize is set", () => {
    const groups = groupItems(index, all, "director", order("director"), 2);
    expect(groups.map((g) => g.key)).toEqual(["Aki Kaurismäki", OTHER]);
    expect(groups[1].indexes).toHaveLength(4);
  });
  it("only includes the given (filtered) items", () => {
    const groups = groupItems(index, [0], "decade", order("decade"));
    expect(groups).toEqual([{ key: "1950s", indexes: [0] }]);
  });
});

describe("sorting", () => {
  const keys = buildSortKeys(items, { contentLanguage: "fi", titleDisplay: "localized" }, (c) => c);
  const titleOf = (idx: number[]) => idx.map((i) => items[i].movie.originalTitle);
  it("sorts by year ascending and descending, ties by title", () => {
    expect(sortIndexes(all, "year", "asc", keys, collator).map((i) => items[i].movie.year)).toEqual([1955, 1982, 1986, 2001, 2003, 2017]);
    expect(sortIndexes(all, "year", "desc", keys, collator)[0]).toBe(2);
  });
  it("sorts titles with Finnish collation (ä after z)", () => {
    const mk = (t: string): LibraryItem => ({ movie: { ...DEMO_MOVIES[0], titles: { fi: t } }, entry: newEntry(1) });
    const its = ["Äiti", "Zorro", "Abba", "Öljy"].map(mk);
    const k = buildSortKeys(its, { contentLanguage: "fi", titleDisplay: "localized" }, (c) => c);
    const sorted = sortIndexes([0, 1, 2, 3], "title", "asc", k, collator).map((i) => its[i].movie.titles.fi);
    expect(sorted).toEqual(["Abba", "Zorro", "Äiti", "Öljy"]);
  });
  it("sinks empty values to the bottom in both directions", () => {
    // ratings are all unset (0) here; give one movie a rating
    const its = items.map((x, i) => (i === 3 ? { ...x, entry: { ...x.entry, status: "watched" as const, rating: 6 } } : x));
    const k = buildSortKeys(its, { contentLanguage: "fi", titleDisplay: "localized" }, (c) => c);
    expect(sortIndexes(all, "rating", "asc", k, collator)[0]).toBe(3);
    expect(sortIndexes(all, "rating", "desc", k, collator)[0]).toBe(3);
    expect(titleOf([3])).toEqual(["Blade Runner"]);
  });
});

import { describe, expect, it } from "vitest";
import { filterItems } from "../src/domain/filters";
import { displayGenres, displayOverview, displayTitle, matchesQuery, normalize } from "../src/domain/localize";
import type { LibraryItem, Movie } from "../src/domain/types";
import { newEntry } from "../src/storage/library";
import { DEMO_MOVIES } from "../src/services/demo";

const movie = (over: Partial<Movie> = {}): Movie => ({
  tmdbId: 99, originalTitle: "Orig", titles: {}, overviews: {}, genres: {}, directors: [], cast: [], countries: [], ...over,
});

describe("localization fallback", () => {
  it("prefers content language, then the other, then original", () => {
    const m = movie({ titles: { fi: "Suomi", en: "English" } });
    expect(displayTitle(m, { contentLanguage: "fi", titleDisplay: "localized" })).toBe("Suomi");
    expect(displayTitle(m, { contentLanguage: "en", titleDisplay: "localized" })).toBe("English");
    expect(displayTitle(movie({ titles: { en: "English" } }), { contentLanguage: "fi", titleDisplay: "localized" })).toBe("English");
    expect(displayTitle(movie(), { contentLanguage: "fi", titleDisplay: "localized" })).toBe("Orig");
    expect(displayTitle(m, { contentLanguage: "fi", titleDisplay: "original" })).toBe("Orig");
  });
  it("skips empty Finnish overview and genres", () => {
    const m = movie({ overviews: { fi: "", en: "Eng" }, genres: { fi: [], en: ["Drama"] } });
    expect(displayOverview(m, "fi")).toBe("Eng");
    expect(displayGenres(m, "fi")).toEqual(["Drama"]);
  });
});

describe("search", () => {
  it("is case and diacritic insensitive across all titles", () => {
    expect(normalize("ÄÖÅ")).toBe("aoa");
    const m = DEMO_MOVIES.find((x) => x.originalTitle === "Varjoja paratiisissa")!;
    expect(matchesQuery(m, "SHADOWS")).toBe(true);
    expect(matchesQuery(m, "kaurismaki")).toBe(true);
    expect(matchesQuery(m, "nonexistent")).toBe(false);
  });
});

describe("filterItems", () => {
  const items: LibraryItem[] = [1, 2, 3].map((id) => ({ movie: movie({ tmdbId: id, originalTitle: `M${id}` }), entry: newEntry(id) }));
  items[0].entry.owned = true;
  items[1].entry.status = "want";
  items[2].entry.status = "watched";
  it("filters by view", () => {
    expect(filterItems(items, "owned", "").map((i) => i.movie.tmdbId)).toEqual([1]);
    expect(filterItems(items, "want", "").map((i) => i.movie.tmdbId)).toEqual([2]);
    expect(filterItems(items, "watched", "").map((i) => i.movie.tmdbId)).toEqual([3]);
    expect(filterItems(items, "all", "m2").map((i) => i.movie.tmdbId)).toEqual([2]);
  });
});

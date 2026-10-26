import { describe, expect, it } from "vitest";
import { buildIndex, facetValues, orderedValues, ratingBand, runtimeBand, UNKNOWN } from "../src/domain/facets";
import { DEMO_MOVIES } from "../src/services/demo";
import { newEntry } from "../src/storage/library";
import type { LibraryItem } from "../src/domain/types";

const item = (id: number, entry: Partial<LibraryItem["entry"]> = {}, movie = DEMO_MOVIES[id - 1]): LibraryItem => ({
  movie, entry: { ...newEntry(id), ...entry },
});
const ctx = { contentLanguage: "fi" as const };

describe("facet values", () => {
  it("are multi-valued and follow content language", () => {
    expect(facetValues("genre", item(1), ctx)).toEqual(["Sota", "Draama"]);
    expect(facetValues("genre", item(1), { contentLanguage: "en" })).toEqual(["War", "Drama"]);
  });
  it("derives decade, language, runtime and director", () => {
    expect(facetValues("decade", item(2), ctx)).toEqual(["1980s"]);
    expect(facetValues("language", item(2), ctx)).toEqual(["fi"]);
    expect(facetValues("runtime", item(2), ctx)).toEqual(["lt90"]);
    expect(facetValues("director", item(2), ctx)).toEqual(["Aki Kaurismäki"]);
  });
  it("uses an Unknown value when a facet is empty", () => {
    expect(facetValues("format", item(1), ctx)).toEqual([UNKNOWN]);
    expect(facetValues("format", item(1, { owned: true, format: "bluray" }), ctx)).toEqual(["bluray"]);
  });
  it("status combines owned with watch state", () => {
    expect(facetValues("status", item(1, { owned: true, status: "watched" }), ctx)).toEqual(["owned", "watched"]);
    expect(facetValues("status", item(1), ctx)).toEqual(["unwatched"]);
  });
  it("bands ratings and runtimes", () => {
    expect([undefined, 10, 8, 9, 6, 5, 2].map(ratingBand)).toEqual(["r0", "r5", "r4", "r4", "r3", "r2", "r2"]);
    expect([60, 90, 119, 120, 149, 150].map(runtimeBand)).toEqual(["lt90", "90-120", "90-120", "120-150", "120-150", "gt150"]);
  });
});

describe("index", () => {
  it("counts values and orders them", () => {
    const idx = buildIndex(DEMO_MOVIES.map((_, i) => item(i + 1)), { contentLanguage: "fi" });
    expect(idx.counts.director.get("Aki Kaurismäki")).toBe(2);
    const collator = new Intl.Collator("fi");
    const dirs = orderedValues("director", idx.counts.director, collator, (v) => v);
    expect(dirs[0]).toBe("Aki Kaurismäki");
    expect(orderedValues("decade", idx.counts.decade, collator, (v) => v)).toEqual(["1950s", "1980s", "2000s", "2010s"]);
  });
});

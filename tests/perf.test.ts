import { describe, expect, it } from "vitest";
import { buildIndex, orderedValues } from "../src/domain/facets";
import { applyFilters, emptyFilter, toggleValue } from "../src/domain/filter";
import { groupItems } from "../src/domain/group";
import { buildSortKeys, sortIndexes } from "../src/domain/sort";
import { generateLibrary } from "../src/services/synthetic";

const N = 5000;
const items = generateLibrary(N);
const time = <T,>(fn: () => T): [T, number] => { const t = performance.now(); const r = fn(); return [r, performance.now() - t]; };
// Generous budgets (CI machines vary); real numbers are far lower.
const BUDGET_MS = 300;

describe(`${N} movies`, () => {
  const collator = new Intl.Collator("fi");
  const [index, tIndex] = time(() => buildIndex(items, { contentLanguage: "fi" }));
  it("builds the facet index quickly", () => expect(tIndex).toBeLessThan(BUDGET_MS * 2));
  it("filters quickly", () => {
    const genres = [...index.counts.genre.keys()];
    let f = toggleValue(emptyFilter, "genre", genres[0], genres);
    f = toggleValue(f, "country", "US", [...index.counts.country.keys()]);
    const [res, ms] = time(() => applyFilters(index, f));
    expect(res.length).toBeLessThan(N);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
  it("sorts every column quickly", () => {
    const keys = buildSortKeys(items, { contentLanguage: "fi", titleDisplay: "localized" }, (c) => c);
    const all = items.map((_, i) => i);
    for (const col of ["title", "year", "genres", "directors", "countries", "runtime", "rating", "status", "format"] as const) {
      const [, ms] = time(() => sortIndexes(all, col, "asc", keys, collator));
      expect(ms, col).toBeLessThan(BUDGET_MS);
    }
  });
  it("groups quickly", () => {
    const all = items.map((_, i) => i);
    const [groups, ms] = time(() => groupItems(index, all, "actor", (c) => orderedValues("actor", c, collator, (v) => v), 2));
    expect(groups.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

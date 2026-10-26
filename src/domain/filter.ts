import { matchesQuery } from "./localize";
import type { FacetIndex } from "./facets";
import { FACET_IDS } from "./facets";
import type { FacetId } from "./types";

/**
 * Per-facet checkbox selection. Absent = everything checked (no restriction).
 * "exclude": checked = all except `values` (a movie is hidden if it has ANY listed value).
 * "include": checked = only `values` (a movie is shown if it has ANY listed value).
 * The mode follows the user's last action: unchecking from "all" excludes, checking from "none" includes.
 */
export interface FacetSelection {
  mode: "exclude" | "include";
  values: ReadonlySet<string>;
}

export interface FilterState {
  query: string;
  facets: Partial<Record<FacetId, FacetSelection>>;
}

export const emptyFilter: FilterState = { query: "", facets: {} };

export function isChecked(sel: FacetSelection | undefined, value: string): boolean {
  if (!sel) return true;
  return sel.mode === "include" ? sel.values.has(value) : !sel.values.has(value);
}

export function facetPasses(sel: FacetSelection | undefined, itemValues: readonly string[]): boolean {
  if (!sel) return true;
  return sel.mode === "include"
    ? itemValues.some((v) => sel.values.has(v))
    : !itemValues.some((v) => sel.values.has(v));
}

function withFacet(state: FilterState, facet: FacetId, sel: FacetSelection | undefined): FilterState {
  const facets = { ...state.facets };
  if (sel) facets[facet] = sel;
  else delete facets[facet];
  return { ...state, facets };
}

export const selectAll = (state: FilterState, facet: FacetId) => withFacet(state, facet, undefined);
export const selectNone = (state: FilterState, facet: FacetId) =>
  withFacet(state, facet, { mode: "include", values: new Set() });

/** Presets such as the sidebar's "Owned": show only movies with this value. */
export const selectOnly = (state: FilterState, facet: FacetId, value: string) =>
  withFacet(state, facet, { mode: "include", values: new Set([value]) });

export function toggleValue(state: FilterState, facet: FacetId, value: string, allValues: readonly string[]): FilterState {
  const sel = state.facets[facet];
  const values = new Set(sel?.values ?? []);
  if (values.has(value)) values.delete(value);
  else values.add(value);
  const mode = sel?.mode ?? "exclude";
  if (mode === "exclude") {
    if (values.size === 0) return withFacet(state, facet, undefined);
    if (allValues.every((v) => values.has(v))) return withFacet(state, facet, { mode: "include", values: new Set() });
  } else if (allValues.length > 0 && allValues.every((v) => values.has(v))) {
    return withFacet(state, facet, undefined);
  }
  return withFacet(state, facet, { mode, values });
}

export function isActive(state: FilterState): boolean {
  return state.query.trim() !== "" || Object.keys(state.facets).length > 0;
}

/** Item indexes (into index.items) that pass the text query and every facet; facets combine with AND. */
export function applyFilters(index: FacetIndex, state: FilterState): number[] {
  const active = FACET_IDS.filter((f) => state.facets[f]);
  const out: number[] = [];
  for (let i = 0; i < index.items.length; i++) {
    if (state.query && !matchesQuery(index.items[i].movie, state.query)) continue;
    let ok = true;
    for (const f of active) {
      if (!facetPasses(state.facets[f], index.values[f][i])) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

import { UNKNOWN } from "./facets";
import type { FacetIndex } from "./facets";
import type { FacetId } from "./types";

export const OTHER = "__other__";

export interface Group {
  key: string;
  /** Item indexes (into index.items). A movie can be in several groups. */
  indexes: number[];
}

/**
 * Groups the given items by a facet. Groups smaller than `minSize` are folded into "Other"
 * (a movie goes there only if none of its values formed a real group).
 * Order: `order` (natural order or size) first, then Other, then Unknown.
 */
export function groupItems(
  index: FacetIndex,
  indexes: readonly number[],
  facet: FacetId,
  order: (keys: Map<string, number>) => string[],
  minSize = 1,
): Group[] {
  const buckets = new Map<string, number[]>();
  for (const i of indexes) for (const v of index.values[facet][i]) {
    const b = buckets.get(v);
    if (b) b.push(i);
    else buckets.set(v, [i]);
  }
  const sizes = new Map([...buckets].map(([k, v]) => [k, v.length]));
  const small = new Set([...buckets].filter(([k, v]) => k !== UNKNOWN && v.length < minSize).map(([k]) => k));
  const other = new Set<number>();
  for (const k of small) for (const i of buckets.get(k)!) {
    if (index.values[facet][i].every((v) => small.has(v) || v === UNKNOWN)) other.add(i);
  }
  const groups: Group[] = order(new Map([...sizes].filter(([k]) => !small.has(k) && k !== UNKNOWN)))
    .map((key) => ({ key, indexes: buckets.get(key)! }));
  if (other.size) groups.push({ key: OTHER, indexes: [...other] });
  if (buckets.has(UNKNOWN)) groups.push({ key: UNKNOWN, indexes: buckets.get(UNKNOWN)! });
  return groups;
}

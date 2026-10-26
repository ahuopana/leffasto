import type { FacetId, Lang, LibraryItem, OwnedFormat, Settings } from "./types";
import { displayGenres } from "./localize";
import type { MessageKey, TFunction } from "../i18n";

/** Stands in for "no value" so such movies can be toggled in filters and grouped. */
export const UNKNOWN = "__unknown__";

export const FACET_IDS: FacetId[] = [
  "genre", "decade", "director", "country", "actor", "language", "rating", "status", "format", "runtime",
];

export const FACET_LABELS: Record<FacetId, MessageKey> = {
  genre: "facet.genre", decade: "facet.decade", director: "facet.director", country: "facet.country",
  actor: "facet.actor", language: "facet.language", rating: "facet.rating", status: "facet.status",
  format: "facet.format", runtime: "facet.runtime",
};

/** Facets whose values have a fixed, meaningful order (others are ordered by size). */
const NATURAL_ORDER: Partial<Record<FacetId, string[]>> = {
  rating: ["r5", "r4", "r3", "r2", "r0"],
  status: ["owned", "want", "watched", "unwatched"],
  format: ["dvd", "bluray", "uhd", "digital"],
  runtime: ["lt90", "90-120", "120-150", "gt150"],
};

/** Facets with very many values where single-movie groups are noise. */
export const PEOPLE_FACETS: FacetId[] = ["director", "actor"];

export interface FacetContext {
  contentLanguage: Lang;
}

export function ratingBand(rating: number | undefined): string {
  if (rating === undefined) return "r0";
  const stars = rating / 2;
  if (stars >= 5) return "r5";
  if (stars >= 4) return "r4";
  if (stars >= 3) return "r3";
  return "r2";
}

export function runtimeBand(minutes: number | undefined): string | undefined {
  if (!minutes) return undefined;
  if (minutes < 90) return "lt90";
  if (minutes < 120) return "90-120";
  if (minutes < 150) return "120-150";
  return "gt150";
}

export function facetValues(facet: FacetId, { movie, entry }: LibraryItem, ctx: FacetContext): string[] {
  let values: (string | undefined)[];
  switch (facet) {
    case "genre": values = displayGenres(movie, ctx.contentLanguage); break;
    case "decade": values = [movie.year ? `${Math.floor(movie.year / 10) * 10}s` : undefined]; break;
    case "director": values = movie.directors; break;
    case "country": values = movie.countries; break;
    case "actor": values = movie.cast; break;
    case "language": values = [movie.originalLanguage]; break;
    case "rating": return [ratingBand(entry.rating)];
    case "status":
      values = [
        entry.owned ? "owned" : undefined,
        entry.status === "want" ? "want" : undefined,
        entry.status === "watched" ? "watched" : "unwatched",
      ];
      break;
    case "format": values = [entry.owned ? (entry.format as OwnedFormat | undefined) : undefined]; break;
    case "runtime": values = [runtimeBand(movie.runtime)]; break;
  }
  const out = values.filter((v): v is string => !!v);
  return out.length ? out : [UNKNOWN];
}

export function valueLabel(facet: FacetId, value: string, lang: Lang, t: TFunction): string {
  if (value === UNKNOWN) return t("facet.unknown");
  try {
    if (facet === "country") return new Intl.DisplayNames(lang, { type: "region" }).of(value) ?? value;
    if (facet === "language") return new Intl.DisplayNames(lang, { type: "language" }).of(value) ?? value;
  } catch {
    return value;
  }
  switch (facet) {
    case "rating": return t(`value.rating.${value}` as MessageKey);
    case "status": return t(`value.status.${value}` as MessageKey);
    case "format": return t(`format.${value}` as MessageKey);
    case "runtime": return t(`value.runtime.${value}` as MessageKey);
    default: return value;
  }
}

export interface FacetIndex {
  items: LibraryItem[];
  /** values[facet][itemIndex] */
  values: Record<FacetId, string[][]>;
  /** counts[facet].get(value) = number of movies with that value */
  counts: Record<FacetId, Map<string, number>>;
}

export function buildIndex(items: LibraryItem[], settings: Pick<Settings, "contentLanguage">): FacetIndex {
  const ctx: FacetContext = { contentLanguage: settings.contentLanguage };
  const values = {} as FacetIndex["values"];
  const counts = {} as FacetIndex["counts"];
  for (const facet of FACET_IDS) {
    const perItem = items.map((item) => facetValues(facet, item, ctx));
    const c = new Map<string, number>();
    for (const vs of perItem) for (const v of vs) c.set(v, (c.get(v) ?? 0) + 1);
    values[facet] = perItem;
    counts[facet] = c;
  }
  return { items, values, counts };
}

/** All values of a facet in display order: natural order where defined, else by size then name. */
export function orderedValues(facet: FacetId, counts: Map<string, number>, collator: Intl.Collator, label: (v: string) => string): string[] {
  const natural = NATURAL_ORDER[facet];
  const all = [...counts.keys()];
  if (natural) return natural.filter((v) => counts.has(v));
  if (facet === "decade") return all.filter((v) => v !== UNKNOWN).sort().concat(counts.has(UNKNOWN) ? [UNKNOWN] : []);
  return all.sort((a, b) => {
    if (a === UNKNOWN || b === UNKNOWN) return a === UNKNOWN ? 1 : -1;
    return (counts.get(b)! - counts.get(a)!) || collator.compare(label(a), label(b));
  });
}

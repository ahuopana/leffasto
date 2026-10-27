import type { BarcodeCache } from "../domain/barcode";
import { cleanProductTitle, extractTitleCandidates, rankMatches } from "../domain/titles";
import type { OcrLine } from "../domain/titles";
import type { BarcodeLookup } from "./barcode-lookup";
import { RateLimitError } from "./barcode-lookup";
import type { MetadataProvider, SearchResult } from "./tmdb";

export interface Candidate {
  result: SearchResult;
  score: number;
}

export type ScanStatus =
  | "looking" // resolving in the background
  | "matched" // one confident match, will be added
  | "choose" // several plausible matches, user picks
  | "manual" // nothing found: user types a title
  | "error";

export interface ScanItem {
  id: string;
  source: "barcode" | "cover";
  /** Barcode digits or the photo's file name. */
  label: string;
  status: ScanStatus;
  /** What the lookup/OCR gave us before matching, for display. */
  readAs?: string;
  candidates: Candidate[];
  /** Chosen movie (tmdbId); undefined = skip this item. */
  chosen?: number;
  message?: "rateLimit" | "notFound" | "noText" | "failed";
}

export interface ResolveDeps {
  provider: MetadataProvider;
  cache: BarcodeCache;
  lookup: BarcodeLookup;
}

/** Above this score a single match is added without asking. */
export const AUTO_ACCEPT = 0.9;
const MAX_CANDIDATES = 5;

/** Turns ranked candidates into a status: confident single match, or a list to choose from. */
export function decide(candidates: Candidate[]): Pick<ScanItem, "status" | "candidates" | "chosen"> {
  const top = candidates.slice(0, MAX_CANDIDATES);
  if (!top.length) return { status: "manual", candidates: [] };
  const [best, second] = top;
  const confident = best.score >= AUTO_ACCEPT && (!second || best.score - second.score >= 0.08);
  return confident
    ? { status: "matched", candidates: top, chosen: best.result.tmdbId }
    : { status: "choose", candidates: top, chosen: undefined };
}

async function searchRanked(queries: string[], provider: MetadataProvider): Promise<Candidate[]> {
  const found: SearchResult[] = [];
  for (const q of queries) {
    const bare = cleanProductTitle(q);
    if (bare.length < 2) continue;
    found.push(...(await provider.search(bare)));
  }
  return rankMatches(queries, found).map(({ result, score }) => ({ result, score }));
}

/** Barcode -> movie: remembered barcode first, then a product-title lookup, then TMDB search and ranking. */
export async function resolveBarcode(code: string, { provider, cache, lookup }: ResolveDeps): Promise<Partial<ScanItem>> {
  const known = cache.get(code);
  if (known !== undefined) {
    const m = await provider.details(known);
    const result: SearchResult = { tmdbId: m.tmdbId, title: m.titles.fi ?? m.originalTitle, originalTitle: m.originalTitle, year: m.year, posterPath: m.posterPath };
    return { status: "matched", readAs: result.title, candidates: [{ result, score: 1 }], chosen: m.tmdbId };
  }
  let product: string | null;
  try {
    product = await lookup.lookup(code);
  } catch (e) {
    return { status: "manual", candidates: [], message: e instanceof RateLimitError ? "rateLimit" : "failed" };
  }
  if (!product) return { status: "manual", candidates: [], message: "notFound" };
  try {
    return { readAs: product, ...decide(await searchRanked([product], provider)) };
  } catch {
    return { status: "error", readAs: product, candidates: [], message: "failed" };
  }
}

/** Cover photo -> movie: OCR lines -> likely titles -> TMDB search and ranking. */
export async function resolveCover(lines: OcrLine[], { provider }: Pick<ResolveDeps, "provider">): Promise<Partial<ScanItem>> {
  const queries = extractTitleCandidates(lines, 3).slice(0, 4);
  if (!queries.length) return { status: "manual", candidates: [], message: "noText" };
  try {
    return { readAs: queries[0], ...decide(await searchRanked(queries, provider)) };
  } catch {
    return { status: "error", readAs: queries[0], candidates: [], message: "failed" };
  }
}

/** The user typed a title for an item that could not be matched. */
export async function resolveManual(title: string, { provider }: Pick<ResolveDeps, "provider">): Promise<Partial<ScanItem>> {
  try {
    const decided = decide(await searchRanked([title], provider));
    // A typed title is the user's own words: never auto-accept, let them pick.
    return { readAs: title, ...decided, status: decided.candidates.length ? "choose" : "manual", chosen: undefined };
  } catch {
    return { status: "error", candidates: [], message: "failed" };
  }
}

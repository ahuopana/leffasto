import { similarity } from "../domain/titles";
import type { Movie } from "../domain/types";
import { elonetIdFromNumber, elonetNumericId, elonetOnlyKey, elonetToMovie, isElonetOnly } from "./elonet";
import type { ElonetHit, ElonetRecord, ElonetSource } from "./elonet";
import type { MetadataProvider, SearchResult } from "./tmdb";

export interface CombinedOptions {
  /** Use Elonet's Finnish title and synopsis for films found in both sources. */
  preferElonetText: boolean;
  /** Called when one source fails but the other still answered (for diagnostics / UI hints). */
  onSourceError?: (source: "tmdb" | "elonet", error: unknown) => void;
}

const MATCH_THRESHOLD = 0.88;

const yearsClose = (a?: number, b?: number) => a === undefined || b === undefined || Math.abs(a - b) <= 1;

/** Title similarity between an Elonet hit and a TMDB result, using every title either side knows. */
export function hitMatchScore(hit: Pick<ElonetHit, "title" | "englishTitle" | "year">, r: Pick<SearchResult, "title" | "originalTitle" | "year">): number {
  if (!yearsClose(hit.year, r.year)) return 0;
  const ours = [hit.title, hit.englishTitle].filter((t): t is string => !!t);
  const theirs = [r.title, r.originalTitle];
  return Math.max(...ours.flatMap((a) => theirs.map((b) => similarity(a, b))));
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Directors agree when they share a name; unknown on either side is not a conflict. */
export function directorsAgree(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  const set = new Set(a.map(norm));
  return b.some((n) => set.has(norm(n)));
}

/** Merge a TMDB movie with its Elonet record: Elonet for Finnish text and credits, TMDB for the rest. */
export function mergeMovie(tmdb: Movie, elo: ElonetRecord, opts: Pick<CombinedOptions, "preferElonetText">): Movie {
  const prefer = opts.preferElonetText;
  return {
    ...tmdb,
    elonetId: elo.elonetId,
    elonetUrl: elo.url,
    year: tmdb.year ?? elo.year,
    originalLanguage: tmdb.originalLanguage ?? elo.language,
    titles: {
      fi: prefer ? elo.title : tmdb.titles.fi ?? elo.title,
      en: tmdb.titles.en ?? elo.englishTitle,
    },
    overviews: {
      fi: prefer ? elo.summary ?? tmdb.overviews.fi : tmdb.overviews.fi || elo.summary,
      en: tmdb.overviews.en,
    },
    // TMDB's genres are cleaner; Elonet's (e.g. "fiktio") only fill a gap.
    genres: { fi: tmdb.genres.fi?.length ? tmdb.genres.fi : elo.genres, en: tmdb.genres.en },
    directors: elo.directors.length ? elo.directors : tmdb.directors,
    cast: elo.cast.length ? elo.cast.map((c) => c.name) : tmdb.cast,
    countries: tmdb.countries.length ? tmdb.countries : ["FI"],
    posterPath: tmdb.posterPath ?? elo.imageUrl,
  };
}

/** TMDB plus Elonet behind the single MetadataProvider interface. One source failing never blocks the other. */
export class CombinedProvider implements MetadataProvider {
  /** tmdbId -> elonetId for results seen in this session, so details() can skip a second lookup. */
  private links = new Map<number, string>();

  constructor(private tmdb: MetadataProvider, private elonet: ElonetSource | null, private opts: CombinedOptions) {}

  async search(query: string): Promise<SearchResult[]> {
    const [t, e] = await Promise.allSettled([this.tmdb.search(query), this.elonet ? this.elonet.search(query) : Promise.resolve([])]);
    if (t.status === "rejected") this.opts.onSourceError?.("tmdb", t.reason);
    if (e.status === "rejected") this.opts.onSourceError?.("elonet", e.reason);
    if (t.status === "rejected" && e.status === "rejected") throw t.reason;

    const tmdbResults = (t.status === "fulfilled" ? t.value : []).map((r): SearchResult => ({ ...r, source: "tmdb" }));
    const hits = e.status === "fulfilled" ? e.value : [];
    const used = new Set<number>();
    const out: SearchResult[] = [];

    for (const hit of hits) {
      let best: { r: SearchResult; score: number } | undefined;
      for (const r of tmdbResults) {
        if (used.has(r.tmdbId)) continue;
        const score = hitMatchScore(hit, r);
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { r, score };
      }
      if (best) {
        used.add(best.r.tmdbId);
        this.links.set(best.r.tmdbId, hit.elonetId);
        out.push({ ...best.r, source: "both", elonetId: hit.elonetId, title: this.opts.preferElonetText ? hit.title : best.r.title });
      } else {
        const key = elonetOnlyKey(hit.elonetId);
        this.links.set(key, hit.elonetId);
        out.push({ tmdbId: key, source: "elonet", elonetId: hit.elonetId, title: hit.title, originalTitle: hit.title, year: hit.year });
      }
    }
    // Linked pairs first (best evidence), then the rest in their original relevance order.
    const rest = tmdbResults.filter((r) => !used.has(r.tmdbId));
    const linked = out.filter((r) => r.source === "both");
    const relevance = (r: SearchResult) => similarity(query, r.title);
    const elonetOnly = out.filter((r) => r.source === "elonet").sort((a, b) => relevance(b) - relevance(a) || (a.year ?? 0) - (b.year ?? 0));
    return [...linked, ...rest, ...elonetOnly];
  }

  async details(tmdbId: number): Promise<Movie> {
    if (isElonetOnly(tmdbId)) {
      const rec = await this.requireElonet().record(elonetIdFromNumber(-tmdbId));
      if (!rec) throw new Error("Elonet record not found");
      return elonetToMovie(rec);
    }
    const movie = await this.tmdb.details(tmdbId);
    if (!this.elonet) return movie;
    try {
      const rec = await this.findElonetRecord(movie);
      return rec ? mergeMovie(movie, rec, this.opts) : movie;
    } catch (e) {
      this.opts.onSourceError?.("elonet", e); // Elonet down: still return the TMDB data
      return movie;
    }
  }

  private requireElonet(): ElonetSource {
    if (!this.elonet) throw new Error("Elonet is turned off");
    return this.elonet;
  }

  /** Known link from search, or (for Finnish films only) a title search in Elonet. */
  private async findElonetRecord(movie: Movie): Promise<ElonetRecord | null> {
    const elonet = this.requireElonet();
    const known = this.links.get(movie.tmdbId);
    if (known) {
      const rec = await elonet.record(known);
      return rec && directorsAgree(rec.directors, movie.directors) ? rec : null;
    }
    const finnish = movie.countries.includes("FI") || movie.originalLanguage === "fi";
    if (!finnish) return null;
    const names = [...new Set([movie.titles.fi, movie.originalTitle].filter((n): n is string => !!n))];
    for (const name of names) {
      const hits = await elonet.search(name);
      const match = hits
        .map((h) => ({ h, score: hitMatchScore(h, { title: movie.titles.fi ?? movie.originalTitle, originalTitle: movie.originalTitle, year: movie.year }) }))
        .filter((m) => m.score >= MATCH_THRESHOLD && m.h.kind !== "other")
        .sort((a, b) => b.score - a.score)[0];
      if (match) {
        const rec = await elonet.record(match.h.elonetId);
        if (rec && directorsAgree(rec.directors, movie.directors)) return rec;
      }
    }
    return null;
  }
}

export { elonetNumericId };

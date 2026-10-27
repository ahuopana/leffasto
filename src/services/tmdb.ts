import type { Movie } from "../domain/types";

const API = "https://api.themoviedb.org/3";
export const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

type FetchFn = typeof fetch;

export type ResultSource = "tmdb" | "elonet" | "both";

export interface SearchResult {
  /** TMDB id; Elonet-only films get a negative id (-numeric Elonet id), see elonetNumericId(). */
  tmdbId: number;
  source?: ResultSource;
  elonetId?: string;
  title: string;
  originalTitle: string;
  year?: number;
  posterPath?: string;
}

export interface MetadataProvider {
  search(query: string): Promise<SearchResult[]>;
  details(tmdbId: number): Promise<Movie>;
}

interface TmdbDetails {
  id: number;
  title: string;
  original_title: string;
  original_language?: string;
  overview: string;
  release_date?: string;
  runtime?: number | null;
  poster_path?: string | null;
  genres?: { id: number; name: string }[];
  production_countries?: { iso_3166_1: string }[];
  external_ids?: { imdb_id?: string | null };
  credits?: {
    cast?: { name: string }[];
    crew?: { name: string; job: string }[];
  };
}

const yearOf = (date?: string) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined);

export class TmdbClient implements MetadataProvider {
  constructor(
    private apiKey: string,
    private fetchFn: FetchFn = (...args) => fetch(...args),
  ) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(API + path);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchFn(url.toString());
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return (await res.json()) as T;
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await this.get<{ results: TmdbDetails[] }>("/search/movie", {
      query,
      language: "fi-FI",
      include_adult: "false",
    });
    return data.results.map((r) => ({
      tmdbId: r.id,
      title: r.title,
      originalTitle: r.original_title,
      year: yearOf(r.release_date),
      posterPath: r.poster_path ?? undefined,
    }));
  }

  async details(tmdbId: number): Promise<Movie> {
    const extra = { append_to_response: "credits,external_ids" };
    const [fi, en] = await Promise.all([
      this.get<TmdbDetails>(`/movie/${tmdbId}`, { language: "fi-FI", ...extra }),
      this.get<TmdbDetails>(`/movie/${tmdbId}`, { language: "en-US", ...extra }),
    ]);
    return mergeDetails(fi, en);
  }
}

export function mergeDetails(fi: TmdbDetails, en: TmdbDetails): Movie {
  const names = (d: TmdbDetails) => (d.genres ?? []).map((g) => g.name);
  return {
    tmdbId: en.id,
    imdbId: en.external_ids?.imdb_id ?? undefined,
    year: yearOf(en.release_date ?? fi.release_date),
    runtime: en.runtime ?? fi.runtime ?? undefined,
    originalTitle: en.original_title,
    originalLanguage: en.original_language,
    titles: { fi: fi.title || undefined, en: en.title || undefined },
    overviews: { fi: fi.overview || undefined, en: en.overview || undefined },
    genres: { fi: names(fi), en: names(en) },
    directors: (en.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name),
    cast: (en.credits?.cast ?? []).slice(0, 8).map((c) => c.name),
    countries: (en.production_countries ?? []).map((c) => c.iso_3166_1),
    posterPath: en.poster_path ?? fi.poster_path ?? undefined,
  };
}

import type { Movie } from "../domain/types";
import { httpFetch } from "./http";

/**
 * Elonet = the Finnish National Filmography (KAVI), served through the open Finna API.
 * Only Finnish films live in the "Kansallisfilmografia" building; foreign films are not found here.
 * Elonet data is free for individuals, culture and education; commercial use is prohibited.
 */
const API = "https://api.finna.fi/v1";
const IMAGE_HOST = "https://elonet.finna.fi";
const BUILDING = '1/KAVI/skf/';
export const ELONET_ID_PREFIX = "kavi.elonet_elokuva_";

export type ElonetKind = "feature" | "short" | "other";

export interface ElonetHit {
  elonetId: string;
  title: string;
  year?: number;
  englishTitle?: string;
  kind: ElonetKind;
}

export interface ElonetCast {
  name: string;
  role?: string;
}

export interface ElonetRecord extends ElonetHit {
  genres: string[];
  summary?: string;
  directors: string[];
  cast: ElonetCast[];
  /** ISO 639-1 code of the film's language when Elonet states one. */
  language?: string;
  url: string;
  imageUrl?: string;
}

export const elonetNumericId = (elonetId: string): number => Number(elonetId.slice(ELONET_ID_PREFIX.length));
export const elonetIdFromNumber = (n: number): string => `${ELONET_ID_PREFIX}${n}`;
/** Movies only known to Elonet are keyed by a negative number so `tmdbId` stays the single numeric key. */
export const elonetOnlyKey = (elonetId: string): number => -elonetNumericId(elonetId);
export const isElonetOnly = (tmdbId: number): boolean => tmdbId < 0;

const LANG: Record<string, string> = { fin: "fi", swe: "sv", eng: "en", fra: "fr", deu: "de", rus: "ru", est: "et", nor: "no", dan: "da" };

type Raw = Record<string, unknown>;
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** "The Unknown Soldier (englanninkielinen nimi)" -> English title; other labels (Swedish, working title) are ignored. */
export function englishTitleFrom(alternativeTitles: unknown): string | undefined {
  for (const raw of arr<string>(alternativeTitles)) {
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
    if (m && /englanninkielinen/i.test(m[2]) && !/yhdysvalloissa|britanniassa|australiassa/i.test(m[2])) return m[1].trim();
  }
  // Fall back to a regional English title (e.g. "... Yhdysvalloissa") if that is all there is.
  for (const raw of arr<string>(alternativeTitles)) {
    const m = /^(.*?)\s*\(([^)]*englanninkielinen[^)]*)\)\s*$/i.exec(raw);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** Elonet summaries contain light HTML (<i>, <br>, entities): reduce to plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function kindOf(formats: unknown): ElonetKind {
  const values = arr<Raw>(formats).map((f) => String(f.value ?? ""));
  if (values.some((v) => v.includes("/Feature/"))) return "feature";
  if (values.some((v) => v.includes("/Short/"))) return "short";
  return "other";
}

const yearOf = (v: unknown) => (typeof v === "string" && /^\d{4}$/.test(v) ? Number(v) : undefined);

/** Parses one Finna record (search hit or full record); null when it is not an Elonet film. */
export function parseElonetRecord(raw: Raw): ElonetRecord | null {
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id?.startsWith(ELONET_ID_PREFIX) || !title) return null;

  const authors = arr<Raw>(raw.nonPresenterAuthors);
  const directors = [...new Set(authors.filter((a) => a.role === "drt" || a.tehtava === "ohjaus").map((a) => str(a.name)).filter((n): n is string => !!n))];
  const presenters = arr<Raw>((raw.presenters as Raw | undefined)?.credited && ((raw.presenters as Raw).credited as Raw).presenters);
  const cast: ElonetCast[] = [];
  for (const p of presenters) {
    const name = str(p.name);
    if (name) cast.push({ name, role: str(p.roleName) });
  }
  const summary = str(raw.summary && arr<string>(raw.summary)[0]);
  const image = str(arr<string>(raw.images)[0]);
  const language = LANG[arr<string>(raw.languages)[0] ?? ""];

  return {
    elonetId: id,
    title,
    year: yearOf(raw.year),
    englishTitle: englishTitleFrom(raw.alternativeTitles),
    kind: kindOf(raw.formats),
    genres: arr<string>(raw.genres).filter((g) => typeof g === "string").map((g) => g.charAt(0).toUpperCase() + g.slice(1)),
    summary: summary ? plainText(summary) : undefined,
    directors,
    cast: cast.slice(0, 8),
    language,
    url: `https://elonet.finna.fi/Record/${id}`,
    imageUrl: image ? `${IMAGE_HOST}${image.replace("size=large", "size=medium")}` : undefined,
  };
}

/** Elonet-only movie (no TMDB match). Genres such as "fiktio" are kept but TMDB's are preferred when merged. */
export function elonetToMovie(rec: ElonetRecord): Movie {
  return {
    tmdbId: elonetOnlyKey(rec.elonetId),
    year: rec.year,
    originalTitle: rec.title,
    originalLanguage: rec.language,
    titles: { fi: rec.title, en: rec.englishTitle },
    overviews: { fi: rec.summary },
    genres: { fi: rec.genres },
    directors: rec.directors,
    cast: rec.cast.map((c) => c.name),
    countries: ["FI"],
    posterPath: rec.imageUrl,
    elonetId: rec.elonetId,
    elonetUrl: rec.url,
  };
}

const FULL_FIELDS = ["id", "title", "year", "alternativeTitles", "formats", "genres", "summary", "nonPresenterAuthors", "presenters", "languages", "images"];
const HIT_FIELDS = ["id", "title", "year", "alternativeTitles", "formats"];

export interface ElonetSource {
  search(query: string): Promise<ElonetHit[]>;
  record(elonetId: string): Promise<ElonetRecord | null>;
}

type FetchFn = (url: string) => Promise<Response>;

export class ElonetClient implements ElonetSource {
  private cache = new Map<string, { at: number; value: unknown }>();
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private fetchFn: FetchFn = (url) => httpFetch(url),
    private opts: { timeoutMs?: number; maxConcurrent?: number; cacheMs?: number } = {},
  ) {}

  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    const max = this.opts.maxConcurrent ?? 2;
    if (this.active >= max) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private async get(path: string, params: [string, string][]): Promise<Raw> {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of params) url.searchParams.append(k, v);
    const key = url.toString();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < (this.opts.cacheMs ?? 5 * 60_000)) return hit.value as Raw;
    const value = await this.limited(async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.opts.timeoutMs ?? 8000);
      try {
        const res = await Promise.race([
          this.fetchFn(key),
          new Promise<never>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new Error("Elonet timeout")))),
        ]);
        if (!res.ok) throw new Error(`Elonet ${res.status}`);
        return (await res.json()) as Raw;
      } finally {
        clearTimeout(timer);
      }
    });
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  async search(query: string): Promise<ElonetHit[]> {
    const data = await this.get("/search", [
      ["lookfor", query], ["type", "Title"], ["filter[]", `building:"${BUILDING}"`], ["limit", "10"],
      ...HIT_FIELDS.map((f): [string, string] => ["field[]", f]),
    ]);
    return arr<Raw>(data.records).map(parseElonetRecord).filter((r): r is ElonetRecord => !!r)
      .map(({ elonetId, title, year, englishTitle, kind }) => ({ elonetId, title, year, englishTitle, kind }));
  }

  async record(elonetId: string): Promise<ElonetRecord | null> {
    const data = await this.get("/record", [["id", elonetId], ...FULL_FIELDS.map((f): [string, string] => ["field[]", f])]);
    const first = arr<Raw>(data.records)[0];
    return first ? parseElonetRecord(first) : null;
  }
}

import { normalize } from "./localize";
import type { SearchResultLike } from "./titles-types";

/** Words that appear on disc covers and shop listings but are not part of the movie title. */
const NOISE = [
  "blu-ray", "bluray", "blu ray", "dvd", "4k", "uhd", "ultra hd", "hd", "region 2", "region 1", "region free", "pal", "ntsc",
  "import", "steelbook", "widescreen", "special edition", "collector's edition", "collectors edition", "limited edition",
  "director's cut", "directors cut", "remastered", "restored", "2-disc", "2 disc", "3-disc", "disc set", "digital copy",
  "suomijulkaisu", "suomitekstit", "suomalainen", "finnish", "nordic", "scandinavian", "pegi", "k-16", "k-12", "k-18", "s", "ohjaus",
];

/**
 * Turns a shop/product title such as "Blade Runner [Blu-ray] (1982) Region B" into the bare title.
 * Brackets and parentheses are dropped (a trailing year is kept out of the title), noise words are removed.
 */
export function cleanProductTitle(raw: string): string {
  let s = raw
    .replace(/[\[(][^\])]*[\])]/g, " ") // [Blu-ray] (1982) (DVD)
    .replace(/\s[-–|:]\s.*$/, (rest) => (NOISE.some((n) => normalize(rest).includes(n)) ? "" : rest)); // " - Special Edition"
  s = s.replace(/(^|[^\p{L}\d])region\s*(free|[a-c0-9])(?=$|[^\p{L}\d])/giu, " ");
  s = s.replace(/(^|[^\p{L}\d])\d[- ]?dis[ck]s?( set)?(?=$|[^\p{L}\d])/giu, " ");
  for (const n of [...NOISE].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(`(^|[^\\p{L}\\d])${n.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}(?=$|[^\\p{L}\\d])`, "giu"), " ");
  }
  return s.replace(/\s{2,}/g, " ").replace(/^[\s\-–:,.|]+|[\s\-–:,.|]+$/g, "").trim();
}

/** Pulls a release year out of free text (shop titles often contain it). */
export function findYear(text: string): number | undefined {
  const m = text.match(/\b(19[0-9]{2}|20[0-4][0-9])\b/);
  return m ? Number(m[1]) : undefined;
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 0..1 similarity of two titles: edit distance on normalized text, softened for subtitle/containment cases. */
export function similarity(a: string, b: string): number {
  const x = normalize(a).replace(/[^\p{L}\d]+/gu, " ").trim();
  const y = normalize(b).replace(/[^\p{L}\d]+/gu, " ").trim();
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ratio = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // "Blade Runner" vs "Blade Runner The Final Cut": contained whole words score high but below an exact match.
  const contained = short.length >= 4 && ` ${long} `.includes(` ${short} `) ? 0.6 + 0.35 * (short.length / long.length) : 0;
  return Math.max(ratio, contained);
}

export interface Scored<T> {
  result: T;
  score: number;
}

/**
 * Ranks search results against what we read from the barcode/cover. A matching year in the query
 * adds a small bonus; the best of title and original title counts.
 */
export function rankMatches<T extends SearchResultLike>(queries: string[], results: T[]): Scored<T>[] {
  const year = queries.map(findYear).find((y) => y !== undefined);
  const best = new Map<number, Scored<T>>();
  for (const result of results) {
    let score = 0;
    for (const q of queries) {
      const bare = cleanProductTitle(q);
      score = Math.max(score, similarity(bare, result.title), similarity(bare, result.originalTitle));
    }
    if (year !== undefined && result.year === year) score = Math.min(1, score + 0.05);
    const prev = best.get(result.tmdbId);
    if (!prev || prev.score < score) best.set(result.tmdbId, { result, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

export interface OcrLine {
  text: string;
  /** 0..100 */
  confidence: number;
  /** Text height in pixels; bigger text is more likely the title. */
  height: number;
  /** Vertical position (top y), used to join a title wrapped over two lines. */
  top: number;
}

const COVER_NOISE = /^(blu-?ray|dvd|4k|uhd|hd|pegi|k-?\d+|suomi|suomen|ohjaus|ohjaaja|pääosissa|käsikirjoitus|tuottaja|musiikki|www\.|copyright|©|all rights|region|pal|stereo|dolby|dts|digital|surround|englanti|tekstitys|subtitles?|special features?|bonus|extras?)\b/i;

/**
 * Picks likely movie titles from OCR output of a cover: large, confident lines made mostly of letters,
 * excluding format/credit boilerplate. A title wrapped over two similarly sized adjacent lines is also offered joined.
 */
export function extractTitleCandidates(lines: OcrLine[], max = 5): string[] {
  const clean = lines
    .map((l) => ({ ...l, text: l.text.replace(/[|_~`^]+/g, " ").replace(/\s+/g, " ").trim() }))
    .filter((l) => {
      const letters = (l.text.match(/\p{L}/gu) ?? []).length;
      return l.text.length >= 2 && l.text.length <= 60 && letters / l.text.length >= 0.6 && l.confidence >= 35 && !COVER_NOISE.test(l.text);
    });
  const scored = clean.map((l) => ({ l, weight: l.height * (0.5 + l.confidence / 200) }));
  scored.sort((a, b) => b.weight - a.weight);
  const out: string[] = [];
  const add = (s: string) => { if (s && !out.some((o) => normalize(o) === normalize(s))) out.push(s); };
  for (const { l } of scored.slice(0, max)) {
    add(l.text);
    // Join with the line directly below when it is about the same size.
    const next = clean.filter((n) => n !== l && n.top > l.top && n.top - l.top < l.height * 2.2 && Math.abs(n.height - l.height) / l.height < 0.35)
      .sort((a, b) => a.top - b.top)[0];
    if (next) add(`${l.text} ${next.text}`);
  }
  return out.slice(0, max * 2);
}

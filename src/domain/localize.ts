import type { Lang, Localized, Movie, Settings } from "./types";

/** Preferred language first, then the other one; empty values are skipped. */
export function pick<T>(
  value: Localized<T>,
  lang: Lang,
  isEmpty: (v: T) => boolean = (v) => !v,
): T | undefined {
  const order: Lang[] = lang === "fi" ? ["fi", "en"] : ["en", "fi"];
  for (const l of order) {
    const v = value[l];
    if (v !== undefined && !isEmpty(v)) return v;
  }
  return undefined;
}

export function displayTitle(movie: Movie, settings: Pick<Settings, "contentLanguage" | "titleDisplay">): string {
  if (settings.titleDisplay === "original") return movie.originalTitle;
  return pick(movie.titles, settings.contentLanguage) ?? movie.originalTitle;
}

export function displayOverview(movie: Movie, lang: Lang): string | undefined {
  return pick(movie.overviews, lang);
}

export function displayGenres(movie: Movie, lang: Lang): string[] {
  return pick(movie.genres, lang, (g) => g.length === 0) ?? [];
}

/** Lowercase and strip diacritics so "Äiti", "aiti" and "AITI" match. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery(movie: Movie, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = [movie.originalTitle, movie.titles.fi, movie.titles.en, ...movie.directors]
    .filter((s): s is string => !!s)
    .map(normalize);
  return haystack.some((h) => h.includes(q));
}

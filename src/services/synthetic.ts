import { dateKey } from "../domain/loans";
import type { LibraryItem, Loan, OwnedFormat } from "../domain/types";

/** Deterministic fake library for performance tests and the dev-only `?seed=N` URL option. */
export function generateLibrary(count: number, seed = 1): LibraryItem[] {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const some = <T,>(xs: readonly T[], max: number) => {
    const n = 1 + Math.floor(rnd() * max);
    return [...new Set(Array.from({ length: n }, () => pick(xs)))];
  };

  const genres: [string, string][] = [
    ["Draama", "Drama"], ["Komedia", "Comedy"], ["Toiminta", "Action"], ["Trilleri", "Thriller"],
    ["Kauhu", "Horror"], ["Tieteiselokuva", "Science Fiction"], ["Romantiikka", "Romance"],
    ["Dokumentti", "Documentary"], ["Animaatio", "Animation"], ["Sota", "War"], ["Rikos", "Crime"], ["Seikkailu", "Adventure"],
  ];
  const first = ["Aki", "Mika", "Jane", "Sofia", "Ridley", "Agnès", "Hayao", "Pedro", "Lukas", "Ava", "Kari", "Greta", "Akira", "Wes", "Chloé"];
  const last = ["Virtanen", "Koskinen", "Scott", "Coppola", "Varda", "Miyazaki", "Almodóvar", "Moodysson", "Duvernay", "Gerwig", "Kurosawa", "Anderson", "Zhao", "Mäkelä", "Öberg"];
  const directors = first.flatMap((f) => last.map((l) => `${f} ${l}`));
  const actors = Array.from({ length: 300 }, (_, i) => `${pick(first)} ${pick(last)} ${i % 7 === 0 ? "Jr." : ""}`.trim() + (i > 120 ? ` ${i}` : ""));
  const countries = ["FI", "US", "GB", "FR", "DE", "JP", "SE", "IT", "ES", "CA", "KR", "DK"];
  const languages = ["fi", "en", "fr", "de", "ja", "sv", "it", "es", "ko"];
  const w1 = ["Silent", "Last", "Golden", "Broken", "Midnight", "Northern", "Hidden", "Lonely", "Burning", "Winter"];
  const w2 = ["River", "Summer", "Road", "City", "Garden", "Promise", "Empire", "Night", "Station", "Island"];
  const formats: OwnedFormat[] = ["dvd", "bluray", "uhd", "digital"];

  const people = ["Maija", "Jussi", "Liisa", "Pekka"];
  const day = 86_400_000;
  const ago = (n: number) => dateKey(new Date(Date.now() - n * day));
  const ahead = (n: number) => dateKey(new Date(Date.now() + n * day));

  let lent = 0;
  return Array.from({ length: count }, (_, i) => {
    const id = 100_000 + i;
    const g = some(genres, 3);
    const en = `${pick(w1)} ${pick(w2)} ${i + 1}`;
    const watched = rnd() < 0.55;
    const owned = rnd() < 0.4;
    const status = watched ? "watched" : rnd() < 0.4 ? "want" : "none";
    const loanRoll = rnd();
    const loan: Loan | undefined =
      owned && loanRoll < 0.06
        ? { direction: "lentTo", person: pick(people), since: ago(20 + Math.floor(rnd() * 40)), due: lent++ < 4 || rnd() < 0.5 ? ago(2 + Math.floor(rnd() * 15)) : ahead(1 + Math.floor(rnd() * 20)) }
        : !owned && loanRoll < 0.02
          ? { direction: "borrowedFrom", person: pick(people), since: ago(5 + Math.floor(rnd() * 10)), due: ahead(3 + Math.floor(rnd() * 20)) }
          : undefined;
    return {
      movie: {
        tmdbId: id,
        year: 1940 + Math.floor(rnd() * 86),
        runtime: 70 + Math.floor(rnd() * 130),
        originalTitle: en,
        originalLanguage: pick(languages),
        titles: { en, fi: rnd() < 0.5 ? `${en} (FI)` : undefined },
        overviews: { en: "Synthetic movie." },
        genres: { fi: g.map((x) => x[0]), en: g.map((x) => x[1]) },
        directors: some(directors, 2),
        cast: some(actors, 4),
        countries: some(countries, 2),
      },
      entry: {
        tmdbId: id,
        owned,
        format: owned ? pick(formats) : undefined,
        location: owned && rnd() < 0.3 ? pick(["Summer cottage", "Office"]) : undefined,
        status,
        rating: watched && rnd() < 0.7 ? 1 + Math.floor(rnd() * 10) : undefined,
        loan,
        watchedDates: watched ? ["2024-05-01"] : [],
        notes: "",
        addedAt: "2025-01-01T00:00:00.000Z",
      },
    } as LibraryItem;
  });
}

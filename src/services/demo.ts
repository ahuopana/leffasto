import { normalize } from "../domain/localize";
import type { Movie } from "../domain/types";
import type { MetadataProvider, SearchResult } from "./tmdb";

/** Offline demo catalogue, used when no TMDB API key is configured. */
export const DEMO_MOVIES: Movie[] = [
  {
    tmdbId: 1, year: 1955, runtime: 180, originalTitle: "Tuntematon sotilas", originalLanguage: "fi",
    titles: { fi: "Tuntematon sotilas", en: "The Unknown Soldier" },
    overviews: { fi: "Edvin Laineen klassikko Väinö Linnan romaanin pohjalta.", en: "Classic Finnish war film based on Väinö Linna's novel." },
    genres: { fi: ["Sota", "Draama"], en: ["War", "Drama"] },
    directors: ["Edvin Laine"], cast: ["Reino Tolvanen", "Kosti Klemelä"], countries: ["FI"],
  },
  {
    tmdbId: 2, year: 1986, runtime: 73, originalTitle: "Varjoja paratiisissa", originalLanguage: "fi",
    titles: { fi: "Varjoja paratiisissa", en: "Shadows in Paradise" },
    overviews: { fi: "Kaurismäen Helsinki-trilogian ensimmäinen osa.", en: "First part of Kaurismäki's Helsinki trilogy." },
    genres: { fi: ["Draama", "Romantiikka"], en: ["Drama", "Romance"] },
    directors: ["Aki Kaurismäki"], cast: ["Matti Pellonpää", "Kati Outinen"], countries: ["FI"],
  },
  {
    tmdbId: 3, year: 2017, runtime: 98, originalTitle: "Toivon tuolla puolen", originalLanguage: "fi",
    titles: { fi: "Toivon tuolla puolen", en: "The Other Side of Hope" },
    overviews: { fi: "", en: "A Syrian refugee arrives in Helsinki." },
    genres: { fi: ["Draama", "Komedia"], en: ["Drama", "Comedy"] },
    directors: ["Aki Kaurismäki"], cast: ["Sherwan Haji", "Sakari Kuosmanen"], countries: ["FI"],
  },
  {
    tmdbId: 4, year: 1982, runtime: 117, originalTitle: "Blade Runner", originalLanguage: "en",
    titles: { fi: "Blade Runner", en: "Blade Runner" },
    overviews: { fi: "", en: "A blade runner must pursue replicants in dystopian Los Angeles." },
    genres: { fi: ["Tieteiselokuva"], en: ["Science Fiction"] },
    directors: ["Ridley Scott"], cast: ["Harrison Ford", "Rutger Hauer"], countries: ["US"],
  },
  {
    tmdbId: 5, year: 2001, runtime: 122, originalTitle: "Le Fabuleux Destin d'Amélie Poulain", originalLanguage: "fr",
    titles: { fi: "Amélie", en: "Amélie" },
    overviews: { fi: "Pariisilainen tarjoilija päättää parantaa muiden elämää.", en: "A shy waitress decides to improve the lives of those around her." },
    genres: { fi: ["Komedia", "Romantiikka"], en: ["Comedy", "Romance"] },
    directors: ["Jean-Pierre Jeunet"], cast: ["Audrey Tautou"], countries: ["FR"],
  },
  {
    tmdbId: 6, year: 2003, runtime: 125, originalTitle: "Lost in Translation", originalLanguage: "en",
    titles: { fi: "Lost in Translation", en: "Lost in Translation" },
    overviews: { fi: "", en: "A faded movie star and a young woman form an unlikely bond in Tokyo." },
    genres: { fi: ["Draama"], en: ["Drama"] },
    directors: ["Sofia Coppola"], cast: ["Bill Murray", "Scarlett Johansson"], countries: ["US"],
  },
];

export class DemoProvider implements MetadataProvider {
  async search(query: string): Promise<SearchResult[]> {
    const q = normalize(query);
    return DEMO_MOVIES.filter((m) =>
      [m.originalTitle, m.titles.fi, m.titles.en].some((t) => t && normalize(t).includes(q)),
    ).map((m) => ({
      tmdbId: m.tmdbId,
      title: m.titles.fi ?? m.originalTitle,
      originalTitle: m.originalTitle,
      year: m.year,
    }));
  }

  async details(tmdbId: number): Promise<Movie> {
    const movie = DEMO_MOVIES.find((m) => m.tmdbId === tmdbId);
    if (!movie) throw new Error(`Unknown demo movie ${tmdbId}`);
    return movie;
  }
}

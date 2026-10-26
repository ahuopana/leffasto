export type Lang = "fi" | "en";
export type UiLanguage = "system" | Lang;
export type TitleDisplay = "localized" | "original";
export type Status = "none" | "want" | "watched";
export type OwnedFormat = "dvd" | "bluray" | "uhd" | "digital";

export interface Localized<T> {
  fi?: T;
  en?: T;
}

export interface Movie {
  tmdbId: number;
  imdbId?: string;
  year?: number;
  runtime?: number;
  originalTitle: string;
  /** ISO 639-1 code, e.g. "fi". */
  originalLanguage?: string;
  titles: Localized<string>;
  overviews: Localized<string>;
  genres: Localized<string[]>;
  directors: string[];
  cast: string[];
  countries: string[];
  posterPath?: string;
}

export interface UserEntry {
  tmdbId: number;
  owned: boolean;
  format?: OwnedFormat;
  status: Status;
  /** 1-10 integer; displayed as 0.5-5 stars. */
  rating?: number;
  watchedDates: string[];
  notes: string;
  addedAt: string;
}

export interface LibraryItem {
  movie: Movie;
  entry: UserEntry;
}

export type FacetId =
  | "genre" | "decade" | "director" | "country" | "actor"
  | "language" | "rating" | "status" | "format" | "runtime";

export type ListColumn =
  | "title" | "year" | "genres" | "directors" | "countries" | "runtime" | "rating" | "status" | "format";

export interface Settings {
  uiLanguage: UiLanguage;
  contentLanguage: Lang;
  titleDisplay: TitleDisplay;
  tmdbApiKey: string;
  view: "grid" | "list";
  groupBy: FacetId | "none";
  sortKey: ListColumn;
  sortDir: "asc" | "desc";
}

export const defaultSettings: Settings = {
  uiLanguage: "system",
  contentLanguage: "fi",
  titleDisplay: "localized",
  tmdbApiKey: "",
  view: "grid",
  groupBy: "none",
  sortKey: "title",
  sortDir: "asc",
};

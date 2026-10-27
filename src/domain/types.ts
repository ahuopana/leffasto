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

export type LoanDirection = "lentTo" | "borrowedFrom";

export interface Loan {
  direction: LoanDirection;
  /** Who the movie was lent to / borrowed from. */
  person: string;
  /** Local dates, YYYY-MM-DD. */
  since: string;
  due?: string;
  note?: string;
}

export interface LoanRecord extends Loan {
  returned: string;
}

export interface UserEntry {
  tmdbId: number;
  owned: boolean;
  format?: OwnedFormat;
  /** Where the owned copy is kept; undefined = the default place. */
  location?: string;
  status: Status;
  /** 1-10 integer; displayed as 0.5-5 stars. */
  rating?: number;
  /** Active loan; at most one per movie. */
  loan?: Loan;
  loanHistory?: LoanRecord[];
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
  | "language" | "rating" | "status" | "format" | "runtime" | "location" | "person";

export type ListColumn =
  | "title" | "year" | "genres" | "directors" | "countries" | "runtime" | "rating" | "status" | "format" | "location" | "loan";

export interface Settings {
  uiLanguage: UiLanguage;
  contentLanguage: Lang;
  titleDisplay: TitleDisplay;
  tmdbApiKey: string;
  /** Name of the default place; empty = localized "Home". */
  defaultLocationName: string;
  /** Daily "want to watch this?" suggestion. */
  suggestionEnabled: boolean;
  /** Local time of the daily notification, "HH:MM". */
  suggestionTime: string;
  notificationsEnabled: boolean;
  /** Also suggest owned movies that are not watched yet. */
  suggestOwnedUnwatched: boolean;
  avoidRepeatDays: number;
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
  defaultLocationName: "",
  suggestionEnabled: true,
  suggestionTime: "18:00",
  notificationsEnabled: false,
  suggestOwnedUnwatched: false,
  avoidRepeatDays: 30,
  view: "grid",
  groupBy: "none",
  sortKey: "title",
  sortDir: "asc",
};

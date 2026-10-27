import type { SuggestionDay } from "../domain/suggestion";

const KEY = "leffasto.suggestions.v1";

export interface SuggestionState {
  history: SuggestionDay[];
  /** Date of the last daily "want to watch this?" notification. */
  lastNotified?: string;
  /** Date for which the user hid the "Tonight's pick" card. */
  dismissed?: string;
  /** "tmdbId:due" of overdue loans we already notified about. */
  overdueNotified: string[];
}

export const emptySuggestionState: SuggestionState = { history: [], overdueNotified: [] };

export class SuggestionStore {
  constructor(private storage: Storage) {}

  get(): SuggestionState {
    try {
      const raw = this.storage.getItem(KEY);
      return { ...emptySuggestionState, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...emptySuggestionState };
    }
  }

  save(state: SuggestionState) {
    this.storage.setItem(KEY, JSON.stringify(state));
  }
}

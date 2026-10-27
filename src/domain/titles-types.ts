/** The subset of a search result that title matching needs (kept separate to avoid a services -> domain cycle). */
export interface SearchResultLike {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year?: number;
}

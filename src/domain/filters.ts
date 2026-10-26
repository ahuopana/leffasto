import { matchesQuery } from "./localize";
import type { LibraryItem } from "./types";

export type View = "all" | "owned" | "want" | "watched";

export function filterItems(items: LibraryItem[], view: View, query: string): LibraryItem[] {
  return items
    .filter((i) => {
      switch (view) {
        case "owned": return i.entry.owned;
        case "want": return i.entry.status === "want";
        case "watched": return i.entry.status === "watched";
        default: return true;
      }
    })
    .filter((i) => matchesQuery(i.movie, query));
}

import { useState } from "react";
import type { Group } from "../domain/group";
import type { LibraryItem } from "../domain/types";
import { useI18n } from "../i18n";
import { MovieCard } from "./MovieCard";

const SHELF_PREVIEW = 30;
const GROUPS_PREVIEW = 40;

interface Props {
  groups: { group: Group; label: string }[];
  items: LibraryItem[];
  titles: readonly (string | number)[];
  selected: number | null;
  onSelect: (tmdbId: number) => void;
}

/** Category shelves: a movie appears in every group it belongs to. */
export function Shelves({ groups, items, titles, selected, onSelect }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [groupLimit, setGroupLimit] = useState(GROUPS_PREVIEW);
  const flip = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  return (
    <div className="shelves">
      {groups.slice(0, groupLimit).map(({ group, label }) => {
        const isCollapsed = collapsed.has(group.key);
        const showAll = expanded.has(group.key);
        const shown = showAll ? group.indexes : group.indexes.slice(0, SHELF_PREVIEW);
        return (
          <section key={group.key} className="shelf">
            <header>
              <button className="link shelf-title" aria-expanded={!isCollapsed} onClick={() => setCollapsed(flip(collapsed, group.key))}>
                {isCollapsed ? "▸" : "▾"} {label} <span className="muted">({group.indexes.length})</span>
              </button>
            </header>
            {!isCollapsed && (
              <>
                <div className="shelf-grid">
                  {shown.map((i) => (
                    <MovieCard
                      key={items[i].movie.tmdbId}
                      item={items[i]}
                      title={String(titles[i])}
                      selected={selected === items[i].movie.tmdbId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
                {group.indexes.length > SHELF_PREVIEW && (
                  <button className="link" onClick={() => setExpanded(flip(expanded, group.key))}>
                    {showAll ? t("group.showFewer") : t("group.showAll", { count: group.indexes.length })}
                  </button>
                )}
              </>
            )}
          </section>
        );
      })}
      {groups.length > groupLimit && (
        <button className="link" onClick={() => setGroupLimit(groupLimit + GROUPS_PREVIEW)}>{t("group.moreGroups")}</button>
      )}
    </div>
  );
}

import { memo, useMemo } from "react";
import { displayGenres } from "../domain/localize";
import type { Group } from "../domain/group";
import type { LibraryItem, ListColumn, Settings } from "../domain/types";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { useWindow } from "./useWindow";

export const ROW_H = 32;
const COLUMNS: ListColumn[] = ["title", "year", "genres", "directors", "countries", "runtime", "rating", "status", "format"];
const NUMERIC: ListColumn[] = ["year", "runtime", "rating"];

type VRow = { kind: "header"; key: string; label: string; count: number } | { kind: "item"; index: number };

interface Props {
  items: LibraryItem[];
  /** Sorted item indexes, or groups (each already sorted) when grouping is on. */
  indexes: readonly number[];
  groups?: { group: Group; label: string }[];
  titles: readonly (string | number)[];
  settings: Settings;
  countryName: (code: string) => string;
  selected: number | null;
  onSelect: (tmdbId: number) => void;
  onSort: (column: ListColumn) => void;
}

const Row = memo(function Row({ item, title, settings, countryName, selected, onSelect, t }: {
  item: LibraryItem; title: string; settings: Settings; countryName: (c: string) => string;
  selected: boolean; onSelect: (id: number) => void; t: (k: MessageKey) => string;
}) {
  const { movie, entry } = item;
  return (
    <div className={`list-row ${selected ? "selected" : ""}`} onClick={() => onSelect(movie.tmdbId)}>
      <span className="cell title">{title}</span>
      <span className="cell num">{movie.year ?? ""}</span>
      <span className="cell">{displayGenres(movie, settings.contentLanguage).join(", ")}</span>
      <span className="cell">{movie.directors.join(", ")}</span>
      <span className="cell">{movie.countries.map(countryName).join(", ")}</span>
      <span className="cell num">{movie.runtime ?? ""}</span>
      <span className="cell num">{entry.rating !== undefined ? `★ ${(entry.rating / 2).toFixed(1)}` : ""}</span>
      <span className="cell">
        {entry.status === "watched" ? `✔️ ${t("detail.watched")}` : entry.status === "want" ? `🔖 ${t("detail.want")}` : ""}
      </span>
      <span className="cell">{entry.owned ? `📀 ${entry.format ? t(`format.${entry.format}` as MessageKey) : ""}` : ""}</span>
    </div>
  );
});

export function ListView({ items, indexes, groups, titles, settings, countryName, selected, onSelect, onSort }: Props) {
  const { t } = useI18n();
  const rows = useMemo<VRow[]>(() => {
    if (!groups) return indexes.map((index) => ({ kind: "item", index }));
    return groups.flatMap(({ group, label }) => [
      { kind: "header" as const, key: group.key, label, count: group.indexes.length },
      ...group.indexes.map((index) => ({ kind: "item" as const, index })),
    ]);
  }, [indexes, groups]);
  const win = useWindow(rows.length, ROW_H, 10);
  const visible = rows.slice(win.start, win.end);

  return (
    <div className="list">
      <div className="list-row list-head">
        {COLUMNS.map((c) => (
          <button key={c} className={`cell head ${NUMERIC.includes(c) ? "num" : ""}`} onClick={() => onSort(c)}>
            {t(`col.${c}` as MessageKey)}
            {settings.sortKey === c && (settings.sortDir === "asc" ? " ▲" : " ▼")}
          </button>
        ))}
      </div>
      <div className="virtual-scroll" ref={win.ref} onScroll={win.onScroll}>
        <div style={{ height: win.totalHeight, position: "relative" }}>
          {visible.map((row, k) => (
            <div key={row.kind === "header" ? `h${row.key}` : items[row.index].movie.tmdbId + "-" + (win.start + k)}
              className="virtual-row" style={{ transform: `translateY(${(win.start + k) * ROW_H}px)`, height: ROW_H }}>
              {row.kind === "header" ? (
                <div className="group-header">{row.label} <span className="muted">({row.count})</span></div>
              ) : (
                <Row
                  item={items[row.index]}
                  title={String(titles[row.index])}
                  settings={settings}
                  countryName={countryName}
                  selected={selected === items[row.index].movie.tmdbId}
                  onSelect={onSelect}
                  t={t}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { memo } from "react";
import type { LibraryItem } from "../domain/types";
import { useI18n } from "../i18n";
import { Poster } from "./Poster";

interface Props {
  item: LibraryItem;
  title: string;
  selected: boolean;
  onSelect: (tmdbId: number) => void;
}

export const MovieCard = memo(function MovieCard({ item: { movie, entry }, title, selected, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <button className={`card ${selected ? "selected" : ""}`} onClick={() => onSelect(movie.tmdbId)}>
      <Poster movie={movie} title={title} />
      <div className="badges">
        {entry.owned && <span title={t("detail.owned")}>📀</span>}
        {entry.status === "want" && <span title={t("detail.want")}>🔖</span>}
        {entry.status === "watched" && <span title={t("detail.watched")}>✔️</span>}
        {entry.rating !== undefined && <span className="rating">★ {(entry.rating / 2).toFixed(1)}</span>}
      </div>
      <span className="card-title">{title}</span>
      <span className="muted small">{movie.year}</span>
    </button>
  );
});

import { displayGenres, displayOverview, displayTitle } from "../domain/localize";
import type { LibraryItem, OwnedFormat, Settings, UserEntry } from "../domain/types";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { Poster } from "./Poster";
import { Stars } from "./Stars";

const FORMATS: OwnedFormat[] = ["dvd", "bluray", "uhd", "digital"];

interface Props {
  item: LibraryItem;
  settings: Settings;
  onUpdate: (patch: Partial<UserEntry>) => void;
  onMarkWatched: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function Detail({ item, settings, onUpdate, onMarkWatched, onRemove, onClose }: Props) {
  const { t } = useI18n();
  const { movie, entry } = item;
  const title = displayTitle(movie, settings);
  const overview = displayOverview(movie, settings.contentLanguage);
  const genres = displayGenres(movie, settings.contentLanguage);

  return (
    <aside className="detail" aria-label={title}>
      <button className="icon close" aria-label={t("detail.close")} onClick={onClose}>×</button>
      <Poster movie={movie} title={title} />
      <h2>{title}</h2>
      <p className="muted">
        {[movie.year, movie.runtime && t("detail.runtime", { minutes: movie.runtime }), genres.join(", ")]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {movie.directors.length > 0 && <p>{t("detail.directedBy", { names: movie.directors.join(", ") })}</p>}
      <p className="overview">{overview ?? t("detail.noOverview")}</p>

      <div className="toggles">
        <label><input type="checkbox" checked={entry.owned} onChange={(e) => onUpdate({ owned: e.target.checked })} /> {t("detail.owned")}</label>
        <label>
          <input
            type="checkbox"
            checked={entry.status === "want"}
            onChange={(e) => onUpdate({ status: e.target.checked ? "want" : "none" })}
          /> {t("detail.want")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={entry.status === "watched"}
            onChange={(e) => (e.target.checked ? onMarkWatched() : onUpdate({ status: "none" }))}
          /> {t("detail.watched")}
        </label>
      </div>
      {entry.owned && (
        <label className="field">
          {t("detail.format")}
          <select value={entry.format ?? ""} onChange={(e) => onUpdate({ format: (e.target.value || undefined) as OwnedFormat | undefined })}>
            <option value="">–</option>
            {FORMATS.map((f) => <option key={f} value={f}>{t(`format.${f}` as MessageKey)}</option>)}
          </select>
        </label>
      )}
      {entry.watchedDates.length > 0 && (
        <p className="muted small">
          {t("detail.watchedOn", {
            dates: entry.watchedDates.map((d) => new Date(d).toLocaleDateString()).join(", "),
          })}
        </p>
      )}
      <div className="field">
        <span>{t("detail.rating")}</span>
        <Stars value={entry.rating} onChange={(rating) => onUpdate({ rating })} />
      </div>
      <button className="danger" onClick={onRemove}>{t("detail.remove")}</button>
    </aside>
  );
}

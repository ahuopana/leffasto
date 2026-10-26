import { useState } from "react";
import { displayGenres, displayOverview, displayTitle } from "../domain/localize";
import type { LibraryItem, OwnedFormat, Settings, UserEntry } from "../domain/types";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { Poster } from "./Poster";
import { Stars } from "./Stars";

const NEW = "__new__";
const FORMATS: OwnedFormat[] = ["dvd", "bluray", "uhd", "digital"];

interface Props {
  item: LibraryItem;
  settings: Settings;
  /** Existing places in use (without the default one), for selection on other movies. */
  locations: string[];
  defaultLocationName: string;
  onUpdate: (patch: Partial<UserEntry>) => void;
  onSetRating: (rating: number | undefined) => void;
  onMarkWatched: () => void;
  onMarkUnwatched: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function Detail({ item, settings, locations, defaultLocationName, onUpdate, onSetRating, onMarkWatched, onMarkUnwatched, onRemove, onClose }: Props) {
  const { t } = useI18n();
  const [confirmUnwatch, setConfirmUnwatch] = useState(false);
  const [newLocation, setNewLocation] = useState<string | null>(null);
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
            disabled={entry.status === "watched"}
            onChange={(e) => onUpdate({ status: e.target.checked ? "want" : "none" })}
          /> {t("detail.want")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={entry.status === "watched"}
            onChange={(e) => {
              if (e.target.checked) onMarkWatched();
              else if (entry.rating !== undefined) setConfirmUnwatch(true);
              else onMarkUnwatched();
            }}
          /> {t("detail.watched")}
        </label>
      </div>
      {confirmUnwatch && (
        <div className="confirm" role="alertdialog">
          <p>{t("detail.unwatchConfirm")}</p>
          <button className="primary" onClick={() => { onMarkUnwatched(); setConfirmUnwatch(false); }}>{t("detail.unwatchYes")}</button>
          <button className="link" onClick={() => setConfirmUnwatch(false)}>{t("detail.cancel")}</button>
        </div>
      )}
      {entry.owned && (
        <label className="field">
          {t("detail.format")}
          <select value={entry.format ?? ""} onChange={(e) => onUpdate({ format: (e.target.value || undefined) as OwnedFormat | undefined })}>
            <option value="">–</option>
            {FORMATS.map((f) => <option key={f} value={f}>{t(`format.${f}` as MessageKey)}</option>)}
          </select>
        </label>
      )}
      {entry.owned && (
        <div className="field">
          <label htmlFor="location">{t("detail.location")}</label>
          {newLocation === null ? (
            <select
              id="location"
              value={entry.location ?? ""}
              onChange={(e) => (e.target.value === NEW ? setNewLocation("") : onUpdate({ location: e.target.value || undefined }))}
            >
              <option value="">{defaultLocationName}</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value={NEW}>{t("location.new")}</option>
            </select>
          ) : (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newLocation.trim();
                if (name) onUpdate({ location: name === defaultLocationName ? undefined : name });
                setNewLocation(null);
              }}
            >
              <input autoFocus value={newLocation} placeholder={t("location.namePlaceholder")} onChange={(e) => setNewLocation(e.target.value)} />
              <button className="primary" type="submit">{t("location.add")}</button>
              <button className="link" type="button" onClick={() => setNewLocation(null)}>{t("detail.cancel")}</button>
            </form>
          )}
        </div>
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
        <Stars value={entry.rating} onChange={onSetRating} />
      </div>
      <button className="danger" onClick={onRemove}>{t("detail.remove")}</button>
    </aside>
  );
}

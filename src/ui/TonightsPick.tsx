import { displayGenres, displayOverview, displayTitle } from "../domain/localize";
import type { Pick } from "../domain/suggestion";
import type { Settings } from "../domain/types";
import { useI18n } from "../i18n";
import { Poster } from "./Poster";

interface Props {
  pick: Pick;
  settings: Settings;
  onWatchNow: () => void;
  onNotToday: () => void;
  onNotInterested: () => void;
  onOpen: () => void;
  onDismiss: () => void;
}

export function TonightsPick({ pick, settings, onWatchNow, onNotToday, onNotInterested, onOpen, onDismiss }: Props) {
  const { t } = useI18n();
  const { movie } = pick.item;
  const title = displayTitle(movie, settings);
  const overview = displayOverview(movie, settings.contentLanguage);
  return (
    <section className="pick" aria-label={t("pick.title")}>
      <div className="pick-poster"><Poster movie={movie} title={title} /></div>
      <div className="pick-body">
        <p className="eyebrow">🎲 {t("pick.title")} · <span className="muted">{t(pick.reason === "want" ? "pick.reasonWant" : "pick.reasonOwned")}</span></p>
        <h2>{title} <span className="muted">{movie.year && `(${movie.year})`}</span></h2>
        <p className="muted small">
          {[movie.runtime && t("detail.runtime", { minutes: movie.runtime }), displayGenres(movie, settings.contentLanguage).join(", "), movie.directors[0]]
            .filter(Boolean).join(" · ")}
        </p>
        {overview && <p className="pick-overview">{overview}</p>}
        <div className="inline-form">
          <button className="primary" onClick={onWatchNow}>{t("pick.watchNow")}</button>
          <button className="toggle" onClick={onNotToday}>{t("pick.notToday")}</button>
          <button className="toggle" onClick={onNotInterested}>{t("pick.notInterested")}</button>
          <button className="link" onClick={onOpen}>{t("pick.open")}</button>
        </div>
      </div>
      <button className="icon" aria-label={t("pick.dismiss")} title={t("pick.dismiss")} onClick={onDismiss}>×</button>
    </section>
  );
}

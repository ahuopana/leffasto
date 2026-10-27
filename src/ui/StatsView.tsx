import { useMemo, useState } from "react";
import { FACET_LABELS, valueLabel } from "../domain/facets";
import type { FacetIndex } from "../domain/facets";
import { dateKey } from "../domain/loans";
import { countBy, leaderboard, overview, ratingDistribution, releaseHistogram, viewingsByMonth, viewingsByYear } from "../domain/stats";
import type { LeaderMetric } from "../domain/stats";
import type { FacetId, Lang, Settings } from "../domain/types";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import { BarList } from "./charts/BarList";
import type { BarRow } from "./charts/BarList";
import { ChartCard } from "./charts/ChartCard";
import { Histogram } from "./charts/Histogram";

const LEADER_FACETS: FacetId[] = ["director", "actor", "genre", "country", "decade", "language"];
const TOP = 10;

interface Props {
  index: FacetIndex;
  /** Item indexes in scope (whole library or the current filters). */
  indexes: readonly number[];
  settings: Settings;
  collator: Intl.Collator;
  defaultLocation: string;
  onScope: (scope: Settings["statsScope"]) => void;
  /** Jump to the library filtered to this facet value. */
  onDrill: (facet: FacetId, value: string) => void;
  now?: () => Date;
}

const stars = (v: number, lang: Lang) => (v / 2).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function StatsView({ index, indexes, settings, collator, defaultLocation, onScope, onDrill, now = () => new Date() }: Props) {
  const { t, lang } = useI18n();
  const items = useMemo(() => indexes.map((i) => index.items[i]), [index, indexes]);
  const [releaseUnit, setReleaseUnit] = useState<"decade" | "year">("decade");
  const [activityUnit, setActivityUnit] = useState<"month" | "year">("month");
  const [leaderFacet, setLeaderFacet] = useState<FacetId>("director");
  const [metric, setMetric] = useState<LeaderMetric>("avg");
  const [minRated, setMinRated] = useState(2);
  const [showAll, setShowAll] = useState(false);

  const o = useMemo(() => overview(items), [items]);
  const release = useMemo(() => releaseHistogram(items, releaseUnit), [items, releaseUnit]);
  const today = dateKey(now());
  const monthly = useMemo(() => viewingsByMonth(items, today.slice(0, 7), 24), [items, today]);
  const yearly = useMemo(() => viewingsByYear(items), [items]);
  const ratings = useMemo(() => ratingDistribution(items), [items]);
  const label = (facet: FacetId) => (v: string) => valueLabel(facet, v, lang, t, defaultLocation);
  const leaders = useMemo(
    () => leaderboard(index, indexes, leaderFacet, { metric, minRated, collator, label: label(leaderFacet) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, indexes, leaderFacet, metric, minRated, collator, lang, defaultLocation],
  );
  const fmt = (n: number) => n.toLocaleString(lang);
  const hours = Math.round(o.minutesWatched / 60);
  const viewings = activityUnit === "month" ? monthly : yearly;

  const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString(lang, { month: "short", year: "2-digit" });
  const collection = (facet: FacetId, order?: string[]): BarRow[] => {
    const c = countBy(index, indexes, facet);
    const keys = order ? order.filter((k) => c.has(k)) : [...c.keys()].sort((a, b) => c.get(b)! - c.get(a)! || collator.compare(a, b));
    return keys.map((k) => ({ key: k, label: label(facet)(k), value: c.get(k)!, valueText: fmt(c.get(k)!) }));
  };
  const formats = collection("format", ["dvd", "bluray", "uhd", "digital"]);
  const locations = collection("location");
  const runtimes = collection("runtime", ["lt90", "90-120", "120-150", "gt150"]);

  if (!items.length && settings.statsScope === "all") {
    return <section className="stats"><h2>{t("stats.title")}</h2><p className="empty">{t("stats.empty")}</p></section>;
  }

  const shownLeaders = showAll ? leaders : leaders.slice(0, TOP);
  const maxAvg = 10;
  const leaderRows: BarRow[] = shownLeaders.map((r) => ({
    key: r.value,
    label: label(leaderFacet)(r.value),
    value: metric === "avg" ? r.avg ?? 0 : metric === "watched" ? r.watched : r.movies,
    valueText: metric === "avg" ? `★ ${stars(r.avg ?? 0, lang)}` : fmt(metric === "watched" ? r.watched : r.movies),
    detail: metric === "avg" ? t("stats.leaders.detail", { rated: r.rated, movies: r.movies }) : t("stats.leaders.detailCount", { movies: r.movies, watched: r.watched }),
  }));

  return (
    <section className="stats">
      <header className="stats-head">
        <h2>{t("stats.title")}</h2>
        <label className="inline">
          {t("stats.scope")}
          <select value={settings.statsScope} onChange={(e) => onScope(e.target.value as Settings["statsScope"])}>
            <option value="all">{t("stats.scopeAll")}</option>
            <option value="filtered">{t("stats.scopeFiltered")}</option>
          </select>
        </label>
        <span className="muted">{t("stats.movies", { count: fmt(o.movies) })}</span>
      </header>

      <div className="tiles">
        <Tile label={t("stats.tile.movies")} value={fmt(o.movies)} />
        <Tile label={t("stats.tile.watched")} value={fmt(o.watched)} sub={t("stats.tile.watchedShare", { percent: o.movies ? Math.round((o.watched / o.movies) * 100) : 0 })} />
        <Tile label={t("stats.tile.owned")} value={fmt(o.owned)} />
        <Tile label={t("stats.tile.want")} value={fmt(o.want)} />
        <Tile label={t("stats.tile.loans")} value={fmt(o.onLoan)} />
        <Tile label={t("stats.tile.hours")} value={fmt(hours)} />
        <Tile label={t("stats.tile.avg")} value={o.avgRating !== undefined ? `★ ${stars(o.avgRating, lang)}` : "–"} />
      </div>

      <div className="chart-grid">
        <ChartCard
          title={t("stats.release.title")}
          subtitle={release.unknown ? t("stats.release.unknown", { count: release.unknown }) : t("stats.release.subtitle")}
          controls={<Toggle value={releaseUnit} options={[["decade", t("stats.release.decade")], ["year", t("stats.release.year")]]} onChange={setReleaseUnit} />}
          table={{ head: [t("stats.release.title"), t("stats.release.watched"), t("stats.release.unwatched")], rows: release.buckets.map((b) => [releaseUnit === "decade" ? `${b.key}s` : b.key, b.watched, b.unwatched]) }}
        >
          <Histogram
            ariaLabel={t("stats.release.title")}
            labelEvery={releaseUnit === "year" ? 10 : 1}
            legend={[{ name: t("stats.release.watched"), tone: "primary" }, { name: t("stats.release.unwatched"), tone: "muted" }]}
            bars={release.buckets.map((b) => ({
              key: String(b.key),
              label: releaseUnit === "decade" ? `${String(b.key).slice(2)}s` : String(b.key),
              title: releaseUnit === "decade" ? `${b.key}s` : String(b.key),
              segments: [
                { name: t("stats.release.watched"), value: b.watched, tone: "primary" },
                { name: t("stats.release.unwatched"), value: b.unwatched, tone: "muted" },
              ],
            }))}
            onSelect={(key) => onDrill("decade", `${releaseUnit === "decade" ? key : Math.floor(Number(key) / 10) * 10}s`)}
          />
        </ChartCard>

        <ChartCard
          title={t("stats.activity.title")}
          subtitle={[viewings.undated ? t("stats.activity.undated", { count: viewings.undated }) : null, activityUnit === "month" && viewings.outside ? t("stats.activity.outside", { count: viewings.outside }) : null].filter(Boolean).join(" · ") || t("stats.activity.subtitle")}
          controls={<Toggle value={activityUnit} options={[["month", t("stats.activity.month")], ["year", t("stats.activity.year")]]} onChange={setActivityUnit} />}
          table={{ head: [t("stats.activity.title"), t("stats.activity.viewings")], rows: viewings.buckets.map((b) => [activityUnit === "month" ? monthLabel(b.key) : b.key, b.count]) }}
        >
          <Histogram
            ariaLabel={t("stats.activity.title")}
            labelEvery={activityUnit === "month" ? 3 : 1}
            bars={viewings.buckets.map((b) => ({
              key: b.key,
              label: activityUnit === "month" ? monthLabel(b.key) : b.key,
              title: activityUnit === "month" ? monthLabel(b.key) : b.key,
              segments: [{ name: t("stats.activity.viewings"), value: b.count, tone: "primary" }],
            }))}
          />
        </ChartCard>

        <ChartCard
          title={t("stats.ratings.title")}
          subtitle={ratings.rated ? t("stats.ratings.subtitle", { rated: ratings.rated, avg: stars(ratings.mean!, lang), median: stars(ratings.median!, lang) }) : t("stats.ratings.none")}
          table={{ head: ["★", t("stats.ratings.movies")], rows: ratings.counts.map((c, i) => [stars(i + 1, lang), c]) }}
        >
          <Histogram
            ariaLabel={t("stats.ratings.title")}
            bars={ratings.counts.map((c, i) => ({
              key: String(i + 1),
              label: (i + 1) % 2 === 0 ? String((i + 1) / 2) : "",
              title: `★ ${stars(i + 1, lang)}`,
              segments: [{ name: t("stats.ratings.movies"), value: c, tone: "primary" }],
            }))}
          />
        </ChartCard>

        <ChartCard
          title={t("stats.leaders.title")}
          controls={
            <div className="leader-controls">
              <label className="inline">{t("stats.leaders.by")}
                <select value={leaderFacet} onChange={(e) => { setLeaderFacet(e.target.value as FacetId); setShowAll(false); }}>
                  {LEADER_FACETS.map((f) => <option key={f} value={f}>{t(FACET_LABELS[f] as MessageKey)}</option>)}
                </select>
              </label>
              <label className="inline">{t("stats.leaders.metric")}
                <select value={metric} onChange={(e) => setMetric(e.target.value as LeaderMetric)}>
                  <option value="avg">{t("stats.leaders.avg")}</option>
                  <option value="movies">{t("stats.leaders.movies")}</option>
                  <option value="watched">{t("stats.leaders.watched")}</option>
                </select>
              </label>
              {metric === "avg" && (
                <label className="inline">{t("stats.leaders.minRated")}
                  <input type="number" min={1} max={50} value={minRated} onChange={(e) => setMinRated(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              )}
            </div>
          }
          table={{
            head: [t("stats.leaders.col.name"), t("stats.leaders.col.avg"), t("stats.leaders.col.rated"), t("stats.leaders.col.movies"), t("stats.leaders.col.watched")],
            rows: leaders.map((r) => [label(leaderFacet)(r.value), r.avg !== undefined ? stars(r.avg, lang) : "–", r.rated, r.movies, r.watched]),
          }}
        >
          {leaders.length === 0 ? (
            <p className="muted">{t("stats.leaders.none")}</p>
          ) : (
            <>
              <BarList ariaLabel={t("stats.leaders.title")} rows={leaderRows} max={metric === "avg" ? maxAvg : undefined} onSelect={(value) => onDrill(leaderFacet, value)} />
              {leaders.length > TOP && (
                <button className="link" onClick={() => setShowAll(!showAll)}>
                  {showAll ? t("stats.leaders.showTop") : t("stats.leaders.showAll", { count: leaders.length })}
                </button>
              )}
            </>
          )}
        </ChartCard>

        <ChartCard title={t("stats.collection.title")}>
          <div className="collection">
            <div><h4>{t("stats.collection.format")}</h4>{formats.length ? <BarList ariaLabel={t("stats.collection.format")} rows={formats} onSelect={(k) => onDrill("format", k)} /> : <p className="muted">{t("stats.collection.none")}</p>}</div>
            {locations.length > 1 && <div><h4>{t("stats.collection.location")}</h4><BarList ariaLabel={t("stats.collection.location")} rows={locations} onSelect={(k) => onDrill("location", k)} /></div>}
            <div><h4>{t("stats.collection.runtime")}</h4><BarList ariaLabel={t("stats.collection.runtime")} rows={runtimes} onSelect={(k) => onDrill("runtime", k)} /></div>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented small" role="group">
      {options.map(([v, label]) => <button key={v} className={value === v ? "on" : ""} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  );
}

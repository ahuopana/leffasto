import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { buildIndex, DEFAULT_LOCATION, locationsInUse, orderedValues, valueLabel, visibleFacets } from "../domain/facets";
import { applyFilters, emptyFilter, selectAll, selectOnly } from "../domain/filter";
import type { FilterState } from "../domain/filter";
import { groupItems, OTHER } from "../domain/group";
import { buildSortKeys, sortIndexes } from "../domain/sort";
import { PEOPLE_FACETS, UNKNOWN } from "../domain/facets";
import type { FacetId, ListColumn, Settings, UserEntry } from "../domain/types";
import { I18nContext, resolveLanguage, translate } from "../i18n";
import type { MessageKey } from "../i18n";
import { DemoProvider } from "../services/demo";
import { TmdbClient } from "../services/tmdb";
import type { MetadataProvider } from "../services/tmdb";
import { LibraryStore } from "../storage/library";
import { AddPanel } from "./AddPanel";
import { Detail } from "./Detail";
import { FilterPanel } from "./FilterPanel";
import { ListView } from "./ListView";
import { SettingsView } from "./SettingsView";
import { Shelves } from "./Shelves";
import { VirtualGrid } from "./VirtualGrid";
import { FACET_LABELS } from "../domain/facets";

type Preset = "all" | "owned" | "want" | "watched";
const NAV: { preset: Preset; label: MessageKey }[] = [
  { preset: "all", label: "nav.all" },
  { preset: "owned", label: "nav.owned" },
  { preset: "want", label: "nav.want" },
  { preset: "watched", label: "nav.watched" },
];

const NAV_ICON: Record<Preset, string> = { all: "🎞", owned: "📀", want: "🔖", watched: "✔️" };

function activePreset(filter: FilterState): Preset | null {
  const sel = filter.facets.status;
  if (!sel) return "all";
  if (sel.mode === "include" && sel.values.size === 1) {
    const [v] = [...sel.values];
    if (v === "owned" || v === "want" || v === "watched") return v;
  }
  return null;
}

export function App({ storage, systemLocale = navigator.language }: { storage: Storage; systemLocale?: string }) {
  const store = useMemo(() => new LibraryStore(storage, { debounceMs: 300 }), [storage]);
  useEffect(() => {
    const flush = () => store.flush();
    window.addEventListener("beforeunload", flush);
    return () => { flush(); window.removeEventListener("beforeunload", flush); };
  }, [store]);

  const [items, setItems] = useState(() => store.list());
  const [settings, setSettings] = useState(() => store.getSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const lang = resolveLanguage(settings.uiLanguage, systemLocale);
  const i18n = useMemo(() => ({ lang, t: (k: MessageKey, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang]);
  const { t } = i18n;
  const collator = useMemo(() => new Intl.Collator(lang), [lang]);

  const demo = !settings.tmdbApiKey;
  const provider: MetadataProvider = useMemo(
    () => (demo ? new DemoProvider() : new TmdbClient(settings.tmdbApiKey)),
    [demo, settings.tmdbApiKey],
  );

  // Derived data: facet index, sort keys, filtered + sorted indexes, optional groups.
  const index = useMemo(() => buildIndex(items, settings), [items, settings.contentLanguage]);
  const countryName = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames(lang, { type: "region" }); } catch { /* fall back to codes */ }
    return (code: string) => dn?.of(code) ?? code;
  }, [lang]);
  const defaultLocationName = settings.defaultLocationName.trim() || t("location.default");
  const sortKeys = useMemo(
    () => buildSortKeys(items, settings, countryName, defaultLocationName),
    [items, settings.contentLanguage, settings.titleDisplay, countryName, defaultLocationName],
  );
  const locations = useMemo(
    () => [...index.counts.location.keys()].filter((v) => v !== DEFAULT_LOCATION && v !== UNKNOWN).sort(collator.compare),
    [index, collator],
  );
  const showLocation = locationsInUse(index) > 1;
  const deferredFilter = useDeferredValue(filter);
  const filtered = useMemo(() => applyFilters(index, deferredFilter), [index, deferredFilter]);
  const sorted = useMemo(
    () => sortIndexes(filtered, settings.view === "list" ? settings.sortKey : "title", settings.view === "list" ? settings.sortDir : "asc", sortKeys, collator),
    [filtered, settings.view, settings.sortKey, settings.sortDir, sortKeys, collator],
  );
  const groups = useMemo(() => {
    if (settings.groupBy === "none") return undefined;
    const facet = settings.groupBy;
    const label = (v: string) => (v === OTHER ? t("group.other") : valueLabel(facet, v, lang, t, defaultLocationName));
    const raw = groupItems(index, sorted, facet, (counts) => orderedValues(facet, counts, collator, label), PEOPLE_FACETS.includes(facet) ? 2 : 1);
    return raw.map((group) => ({ group, label: label(group.key) }));
  }, [index, sorted, settings.groupBy, collator, lang, t, defaultLocationName]);

  const selectedItem = items.find((i) => i.movie.tmdbId === selected) ?? null;
  const preset = activePreset(filter);
  const activeFacetCount = Object.keys(filter.facets).length;

  const changeSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      store.saveSettings(next);
      return next;
    });
  }, [store]);
  const select = useCallback((id: number) => setSelected(id), []);
  const sortBy = useCallback((column: ListColumn) => {
    changeSettings(settings.sortKey === column
      ? { sortDir: settings.sortDir === "asc" ? "desc" : "asc" }
      : { sortKey: column, sortDir: "asc" });
  }, [changeSettings, settings.sortKey, settings.sortDir]);

  const update = (id: number, patch: Partial<UserEntry>) => setItems(store.update(id, patch));
  async function add(tmdbId: number) {
    setItems(store.add(await provider.details(tmdbId)));
    setSelected(tmdbId);
    setAdding(false);
  }
  const applyPreset = (p: Preset) => {
    setShowSettings(false);
    setSelected(null);
    setFilter(p === "all" ? selectAll(filter, "status") : selectOnly(filter, "status", p));
  };
  const presetCount = (p: Preset) => (p === "all" ? items.length : index.counts.status.get(p) ?? 0);
  const titles = sortKeys.title;

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <nav className={`sidebar ${showFilters && !showSettings ? "collapsed" : ""}`}>
          <h1><span aria-hidden>🎬</span><span className="label"> {t("appName")}</span></h1>
          {NAV.map(({ preset: p, label }) => (
            <button key={p} className={!showSettings && preset === p ? "active" : ""} title={t(label)} onClick={() => applyPreset(p)}>
              <span className="icon" aria-hidden>{NAV_ICON[p]}</span>
              <span className="label">{t(label)}</span>
              <span className="count">{presetCount(p)}</span>
            </button>
          ))}
          <button className={showSettings ? "active" : ""} title={t("nav.settings")} onClick={() => { setShowSettings(true); setSelected(null); }}>
            <span className="icon" aria-hidden>⚙︎</span>
            <span className="label">{t("nav.settings")}</span>
          </button>
          <p className="attribution">{t("attribution")}</p>
        </nav>

        {showSettings ? (
          <main><SettingsView settings={settings} onChange={(s) => changeSettings(s)} /></main>
        ) : (
          <>
            {showFilters && (
              <FilterPanel index={index} filter={filter} shown={filtered.length} collator={collator} defaultLocation={defaultLocationName} onChange={setFilter} />
            )}
            <main className="library">
              <div className="toolbar">
                <input type="search" value={filter.query} placeholder={t("search.library")} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
                <button className={`toggle ${showFilters ? "on" : ""}`} aria-pressed={showFilters} onClick={() => setShowFilters(!showFilters)}>
                  ⚙︎ {t("filter.title")}{activeFacetCount > 0 && <span className="badge">{activeFacetCount}</span>}
                </button>
                <label className="inline">
                  {t("group.by")}
                  <select value={settings.groupBy} onChange={(e) => changeSettings({ groupBy: e.target.value as FacetId | "none" })}>
                    <option value="none">{t("group.none")}</option>
                    {visibleFacets(index).map((f) => <option key={f} value={f}>{t(FACET_LABELS[f])}</option>)}
                  </select>
                </label>
                <div className="segmented" role="group">
                  <button className={settings.view === "grid" ? "on" : ""} onClick={() => changeSettings({ view: "grid" })}>▦ {t("view.grid")}</button>
                  <button className={settings.view === "list" ? "on" : ""} onClick={() => changeSettings({ view: "list" })}>☰ {t("view.list")}</button>
                </div>
                <span className="spacer" />
                <button className="primary" onClick={() => setAdding(true)}>＋ {t("add.title")}</button>
              </div>

              {sorted.length === 0 ? (
                <p className="empty">{items.length === 0 ? t("empty.library") : t("empty.filter")}</p>
              ) : settings.view === "list" ? (
                <ListView items={items} indexes={sorted} groups={groups} titles={titles} settings={settings}
                  countryName={countryName} showLocation={showLocation} defaultLocationName={defaultLocationName}
                  selected={selected} onSelect={select} onSort={sortBy} />
              ) : groups ? (
                <div className="virtual-scroll">
                  <Shelves groups={groups} items={items} titles={titles} selected={selected} onSelect={select} />
                </div>
              ) : (
                <VirtualGrid indexes={sorted} items={items} titles={titles} selected={selected} onSelect={select} />
              )}
            </main>
          </>
        )}

        {selectedItem && !showSettings && (
          <Detail
            item={selectedItem}
            settings={settings}
            locations={locations}
            defaultLocationName={defaultLocationName}
            onUpdate={(patch) => update(selectedItem.movie.tmdbId, patch)}
            onSetRating={(r) => setItems(store.setRating(selectedItem.movie.tmdbId, r))}
            onMarkWatched={() => setItems(store.markWatched(selectedItem.movie.tmdbId))}
            onMarkUnwatched={() => setItems(store.markUnwatched(selectedItem.movie.tmdbId))}
            onRemove={() => { setItems(store.remove(selectedItem.movie.tmdbId)); setSelected(null); }}
            onClose={() => setSelected(null)}
          />
        )}
        {adding && (
          <AddPanel
            provider={provider}
            demo={demo}
            inLibrary={new Set(items.map((i) => i.movie.tmdbId))}
            onAdd={add}
            onClose={() => setAdding(false)}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
}


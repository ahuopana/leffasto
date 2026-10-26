import { useMemo, useState } from "react";
import { filterItems } from "../domain/filters";
import type { View } from "../domain/filters";
import { displayTitle } from "../domain/localize";
import type { Settings, UserEntry } from "../domain/types";
import { I18nContext, resolveLanguage, translate } from "../i18n";
import type { MessageKey } from "../i18n";
import { DemoProvider } from "../services/demo";
import { TmdbClient } from "../services/tmdb";
import type { MetadataProvider } from "../services/tmdb";
import { LibraryStore } from "../storage/library";
import { AddPanel } from "./AddPanel";
import { Detail } from "./Detail";
import { Poster } from "./Poster";
import { SettingsView } from "./SettingsView";

type Page = View | "settings";
const NAV: { page: Page; label: MessageKey }[] = [
  { page: "all", label: "nav.all" },
  { page: "owned", label: "nav.owned" },
  { page: "want", label: "nav.want" },
  { page: "watched", label: "nav.watched" },
  { page: "settings", label: "nav.settings" },
];

export function App({ storage, systemLocale = navigator.language }: { storage: Storage; systemLocale?: string }) {
  const store = useMemo(() => new LibraryStore(storage), [storage]);
  const [items, setItems] = useState(() => store.list());
  const [settings, setSettings] = useState(() => store.getSettings());
  const [page, setPage] = useState<Page>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const lang = resolveLanguage(settings.uiLanguage, systemLocale);
  const i18n = useMemo(() => ({ lang, t: (k: MessageKey, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang]);
  const { t } = i18n;

  const demo = !settings.tmdbApiKey;
  const provider: MetadataProvider = useMemo(
    () => (demo ? new DemoProvider() : new TmdbClient(settings.tmdbApiKey)),
    [demo, settings.tmdbApiKey],
  );

  const visible = page === "settings" ? [] : filterItems(items, page, query);
  const selectedItem = items.find((i) => i.movie.tmdbId === selected) ?? null;

  const changeSettings = (s: Settings) => {
    store.saveSettings(s);
    setSettings(s);
  };
  const update = (id: number, patch: Partial<UserEntry>) => setItems(store.update(id, patch));

  async function add(tmdbId: number) {
    setItems(store.add(await provider.details(tmdbId)));
    setSelected(tmdbId);
    setAdding(false);
  }

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <nav className="sidebar">
          <h1>🎬 {t("appName")}</h1>
          {NAV.map(({ page: p, label }) => (
            <button key={p} className={page === p ? "active" : ""} onClick={() => { setPage(p); setSelected(null); }}>
              {t(label)}
              {p !== "settings" && <span className="count">{filterItems(items, p, "").length}</span>}
            </button>
          ))}
          <p className="attribution">{t("attribution")}</p>
        </nav>

        <main>
          {page === "settings" ? (
            <SettingsView settings={settings} onChange={changeSettings} />
          ) : (
            <>
              <div className="toolbar">
                <input type="search" value={query} placeholder={t("search.library")} onChange={(e) => setQuery(e.target.value)} />
                <button className="primary" onClick={() => setAdding(true)}>＋ {t("add.title")}</button>
              </div>
              {visible.length === 0 ? (
                <p className="empty">{items.length === 0 ? t("empty.library") : t("empty.filter")}</p>
              ) : (
                <ul className="grid">
                  {visible.map(({ movie, entry }) => {
                    const title = displayTitle(movie, settings);
                    return (
                      <li key={movie.tmdbId}>
                        <button className={`card ${selected === movie.tmdbId ? "selected" : ""}`} onClick={() => setSelected(movie.tmdbId)}>
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </main>

        {selectedItem && page !== "settings" && (
          <Detail
            item={selectedItem}
            settings={settings}
            onUpdate={(patch) => update(selectedItem.movie.tmdbId, patch)}
            onMarkWatched={() => setItems(store.markWatched(selectedItem.movie.tmdbId))}
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

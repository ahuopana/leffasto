import { useState } from "react";
import { useI18n } from "../i18n";
import type { MetadataProvider, SearchResult } from "../services/tmdb";

interface Props {
  provider: MetadataProvider;
  demo: boolean;
  inLibrary: Set<number>;
  onAdd: (tmdbId: number) => Promise<void>;
  onClose: () => void;
}

export function AddPanel({ provider, demo, inLibrary, onAdd, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setError(null);
      setResults(await provider.search(query.trim()));
    } catch (err) {
      setError(t("add.error", { message: err instanceof Error ? err.message : String(err) }));
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={t("add.title")} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{t("add.title")}</h2>
          <button className="icon" aria-label={t("detail.close")} onClick={onClose}>×</button>
        </header>
        {demo && <p className="notice">{t("add.demoMode")}</p>}
        <form onSubmit={search}>
          <input autoFocus value={query} placeholder={t("add.placeholder")} onChange={(e) => setQuery(e.target.value)} />
        </form>
        {error && <p className="error">{error}</p>}
        {results?.length === 0 && <p className="muted">{t("add.noResults")}</p>}
        <ul className="results">
          {results?.map((r) => (
            <li key={r.tmdbId}>
              <div>
                <strong>{r.title}</strong> {r.year && <span className="muted">({r.year})</span>}
                {r.originalTitle !== r.title && <div className="muted small">{r.originalTitle}</div>}
              </div>
              {inLibrary.has(r.tmdbId) ? (
                <span className="muted">{t("add.added")}</span>
              ) : (
                <button className="primary" onClick={() => onAdd(r.tmdbId)}>{t("add.button")}</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

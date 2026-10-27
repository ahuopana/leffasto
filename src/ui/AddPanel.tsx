import { useMemo, useState } from "react";
import { BarcodeCache } from "../domain/barcode";
import type { OwnedFormat } from "../domain/types";
import { useI18n } from "../i18n";
import { UpcItemDbLookup } from "../services/barcode-lookup";
import type { BarcodeLookup } from "../services/barcode-lookup";
import { recognizeCover } from "../services/ocr";
import type { MetadataProvider, SearchResult } from "../services/tmdb";
import { BarcodeTab } from "./BarcodeTab";
import { CoverTab } from "./CoverTab";
import { ScanQueue } from "./ScanQueue";
import { useScanQueue } from "./useScanQueue";
import type { ScanDeps } from "./useScanQueue";

type Tab = "search" | "barcode" | "cover";

interface Props {
  provider: MetadataProvider;
  demo: boolean;
  inLibrary: Set<number>;
  /** Adds one movie from search and opens it. */
  onAdd: (tmdbId: number) => Promise<void>;
  /** Adds movies as owned in the given format; resolves to how many were added. */
  onAddOwned: (tmdbIds: number[], format: OwnedFormat) => Promise<number>;
  storage: Storage;
  /** Set when one metadata source failed but the other answered. */
  sourceWarning?: "elonet" | "tmdb" | null;
  onClose: () => void;
  /** Injection points for tests. */
  lookup?: BarcodeLookup;
  ocr?: ScanDeps["ocr"];
  initialTab?: Tab;
}

export function AddPanel({ provider, demo, inLibrary, onAdd, onAddOwned, storage, sourceWarning, onClose, lookup, ocr, initialTab = "search" }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [format, setFormat] = useState<OwnedFormat>("dvd");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const cache = useMemo(() => new BarcodeCache(storage), [storage]);
  const deps = useMemo<ScanDeps>(
    () => ({ provider, cache, lookup: lookup ?? new UpcItemDbLookup(), ocr: ocr ?? ((img, p) => recognizeCover(img, p)) }),
    [provider, cache, lookup, ocr],
  );
  const queue = useScanQueue(deps);

  async function addAll() {
    const ready = queue.items.filter((i) => i.chosen !== undefined);
    setAdding(true);
    try {
      const added = await onAddOwned([...new Set(ready.map((i) => i.chosen!))], format);
      for (const i of ready) if (i.source === "barcode") cache.set(i.label, i.chosen!);
      queue.removeMany(ready.map((i) => i.id));
      setNotice(t("scan.addedCount", { count: added }));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-label={t("add.title")} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{t("add.title")}</h2>
          <button className="icon" aria-label={t("detail.close")} onClick={onClose}>×</button>
        </header>
        <div className="segmented tabs" role="tablist">
          {(["search", "barcode", "cover"] as Tab[]).map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => { setTab(id); setNotice(null); }}>
              {id === "search" ? "🔎" : id === "barcode" ? "▮▯▮" : "🖼"} {t(`add.tab.${id}` as const)}
            </button>
          ))}
        </div>
        {demo && <p className="notice">{t("add.demoMode")}</p>}
        {sourceWarning && <p className="notice" role="status">{t(sourceWarning === "elonet" ? "add.elonetUnavailable" : "add.tmdbUnavailable")}</p>}
        {notice && <p className="notice ok" role="status">{notice}</p>}
        {tab === "search" && <SearchTab provider={provider} inLibrary={inLibrary} onAdd={onAdd} />}
        {tab === "barcode" && <BarcodeTab onCode={(code) => { setNotice(null); return queue.addBarcode(code); }} />}
        {tab === "cover" && <CoverTab progress={queue.progress} onPhoto={(blob, name) => { setNotice(null); queue.addCover(blob, name); }} />}
        {tab !== "search" && (
          <ScanQueue
            items={queue.items}
            inLibrary={inLibrary}
            format={format}
            onFormat={setFormat}
            onChoose={queue.choose}
            onManual={queue.setManual}
            onRemove={queue.remove}
            onAddAll={addAll}
            adding={adding}
          />
        )}
      </div>
    </div>
  );
}

function SearchTab({ provider, inLibrary, onAdd }: { provider: MetadataProvider; inLibrary: Set<number>; onAdd: (id: number) => Promise<void> }) {
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
    <>
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
              {r.source && <span className={`source-badge ${r.source}`}>{t(`add.source.${r.source}` as const)}</span>}
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
    </>
  );
}

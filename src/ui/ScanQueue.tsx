import { useState } from "react";
import type { OwnedFormat } from "../domain/types";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import type { ScanItem } from "../services/resolve";

const FORMATS: OwnedFormat[] = ["dvd", "bluray", "uhd", "digital"];

interface Props {
  items: ScanItem[];
  inLibrary: Set<number>;
  format: OwnedFormat;
  onFormat: (f: OwnedFormat) => void;
  onChoose: (id: string, tmdbId: number | undefined) => void;
  onManual: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onAddAll: () => void;
  adding: boolean;
}

const MESSAGE: Record<NonNullable<ScanItem["message"]>, MessageKey> = {
  notFound: "scan.notFound", rateLimit: "scan.rateLimit", failed: "scan.failed", noText: "scan.noText",
};

export function ScanQueue({ items, inLibrary, format, onFormat, onChoose, onManual, onRemove, onAddAll, adding }: Props) {
  const { t } = useI18n();
  const ready = items.filter((i) => i.chosen !== undefined);
  return (
    <section className="scan-queue" aria-label={t("scan.queue", { count: items.length })}>
      <h3>{t("scan.queue", { count: items.length })}</h3>
      {items.length === 0 && <p className="muted small">{t("scan.queueEmpty")}</p>}
      <ul>
        {items.map((item) => <QueueRow key={item.id} item={item} inLibrary={inLibrary} onChoose={onChoose} onManual={onManual} onRemove={onRemove} />)}
      </ul>
      {items.length > 0 && (
        <footer>
          <label className="inline">{t("scan.format")}
            <select value={format} onChange={(e) => onFormat(e.target.value as OwnedFormat)}>
              {FORMATS.map((f) => <option key={f} value={f}>{t(`format.${f}` as MessageKey)}</option>)}
            </select>
          </label>
          <button className="primary" disabled={!ready.length || adding} onClick={onAddAll}>{t("scan.addAll", { count: ready.length })}</button>
        </footer>
      )}
    </section>
  );
}

function QueueRow({ item, inLibrary, onChoose, onManual, onRemove }: Pick<Props, "inLibrary" | "onChoose" | "onManual" | "onRemove"> & { item: ScanItem }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const chosen = item.candidates.find((c) => c.result.tmdbId === item.chosen);
  return (
    <li className={`scan-item ${item.status}`}>
      <div className="scan-item-head">
        <span className="scan-code">{item.source === "barcode" ? "▮▯▮" : "🖼"} {item.label}</span>
        {item.readAs && <span className="muted small">{t("scan.readAs", { text: item.readAs })}</span>}
        <button className="icon small" aria-label={t("scan.remove")} onClick={() => onRemove(item.id)}>×</button>
      </div>
      {item.status === "looking" && <p className="muted small">{t("scan.looking")}</p>}
      {(item.status === "manual" || item.status === "error") && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onManual(item.id, title.trim()); }}>
          <span className="muted small">{item.message ? t(MESSAGE[item.message]) : t("scan.notFound")}</span>
          <input value={title} placeholder={t("scan.titlePlaceholder")} onChange={(e) => setTitle(e.target.value)} />
          <button className="toggle" type="submit">{t("scan.search")}</button>
        </form>
      )}
      {item.status === "matched" && chosen && (
        <p className="scan-match">
          ✓ <strong>{chosen.result.title}</strong> {chosen.result.year && <span className="muted">({chosen.result.year})</span>}
          {inLibrary.has(chosen.result.tmdbId) && <span className="muted small"> · {t("scan.alreadyHave")}</span>}
          <button className="link" onClick={() => onChoose(item.id, undefined)}>{t("scan.skip")}</button>
        </p>
      )}
      {item.status === "choose" && (
        <div>
          <p className="muted small">{t("scan.choose")}</p>
          <ul className="candidates">
            {item.candidates.map((c) => (
              <li key={c.result.tmdbId}>
                <button className="link candidate" onClick={() => onChoose(item.id, c.result.tmdbId)}>
                  {c.result.title} {c.result.year && `(${c.result.year})`}
                  <span className="muted small"> {t("scan.matchPercent", { percent: Math.round(c.score * 100) })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

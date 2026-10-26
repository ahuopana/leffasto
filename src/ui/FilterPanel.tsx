import { useMemo, useState } from "react";
import { FACET_LABELS, orderedValues, valueLabel, visibleFacets } from "../domain/facets";
import type { FacetIndex } from "../domain/facets";
import { emptyFilter, isChecked, isActive, selectAll, selectNone, toggleValue } from "../domain/filter";
import type { FilterState } from "../domain/filter";
import type { FacetId } from "../domain/types";
import { useI18n } from "../i18n";

const PREVIEW = 12;

interface Props {
  index: FacetIndex;
  filter: FilterState;
  shown: number;
  collator: Intl.Collator;
  defaultLocation: string;
  onChange: (f: FilterState) => void;
}

export function FilterPanel({ index, filter, shown, collator, defaultLocation, onChange }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<Set<FacetId>>(new Set(["genre"]));
  return (
    <aside className="filters" aria-label={t("filter.title")}>
      <div className="filters-head">
        <h3>{t("filter.title")}</h3>
        {isActive(filter) && <button className="link" onClick={() => onChange(emptyFilter)}>{t("filter.reset")}</button>}
      </div>
      <p className="muted small">{t("filter.count", { shown, total: index.items.length })}</p>
      {visibleFacets(index).map((facet) => (
        <FacetSection
          key={facet}
          facet={facet}
          index={index}
          filter={filter}
          collator={collator}
          defaultLocation={defaultLocation}
          open={open.has(facet)}
          onToggleOpen={() => setOpen((s) => { const n = new Set(s); if (!n.delete(facet)) n.add(facet); return n; })}
          onChange={onChange}
          t={t}
          lang={lang}
        />
      ))}
    </aside>
  );
}

function FacetSection({ facet, index, filter, collator, defaultLocation, open, onToggleOpen, onChange, t, lang }: {
  facet: FacetId; index: FacetIndex; filter: FilterState; collator: Intl.Collator; defaultLocation: string; open: boolean;
  onToggleOpen: () => void; onChange: (f: FilterState) => void; t: ReturnType<typeof useI18n>["t"]; lang: ReturnType<typeof useI18n>["lang"];
}) {
  const [search, setSearch] = useState("");
  const [more, setMore] = useState(false);
  const counts = index.counts[facet];
  const label = useMemo(() => (v: string) => valueLabel(facet, v, lang, t, defaultLocation), [facet, lang, t, defaultLocation]);
  const values = useMemo(() => orderedValues(facet, counts, collator, label), [facet, counts, collator, label]);
  const sel = filter.facets[facet];

  const q = search.trim().toLowerCase();
  const matching = q ? values.filter((v) => label(v).toLowerCase().includes(q)) : values;
  const visible = q || more ? matching.slice(0, 80) : matching.slice(0, PREVIEW);

  return (
    <section className={`facet ${sel ? "active" : ""}`}>
      <button className="facet-head" aria-expanded={open} onClick={onToggleOpen}>
        {open ? "▾" : "▸"} {t(FACET_LABELS[facet])}
        {sel && <span className="dot" aria-hidden>●</span>}
      </button>
      {open && (
        <div className="facet-body">
          <div className="facet-actions">
            <button className="link" onClick={() => onChange(selectAll(filter, facet))}>{t("filter.all")}</button>
            <button className="link" onClick={() => onChange(selectNone(filter, facet))}>{t("filter.none")}</button>
            {values.length > PREVIEW && (
              <input className="facet-search" value={search} placeholder={t("filter.search")} onChange={(e) => setSearch(e.target.value)} />
            )}
          </div>
          <ul>
            {visible.map((v) => (
              <li key={v}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked(sel, v)}
                    onChange={() => onChange(toggleValue(filter, facet, v, values))}
                  />
                  <span className="facet-value">{label(v)}</span>
                  <span className="muted small">{counts.get(v)}</span>
                </label>
              </li>
            ))}
          </ul>
          {!q && matching.length > PREVIEW && (
            <button className="link" onClick={() => setMore(!more)}>{more ? t("filter.showLess") : t("filter.showMore")}</button>
          )}
        </div>
      )}
    </section>
  );
}

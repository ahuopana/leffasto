import { useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n";

interface Props {
  title: string;
  subtitle?: string;
  /** Controls shown at the top right of the card (toggles, selects). */
  controls?: ReactNode;
  /** Rows for the table view: header + body cells. */
  table?: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}

/** Card with a title, optional controls, and a chart/table switch so the numbers are always readable as text. */
export function ChartCard({ title, subtitle, controls, table, children }: Props) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="chart-card">
      <header>
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <div className="chart-controls">
          {controls}
          {table && (
            <button className="link" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
              {asTable ? t("stats.showChart") : t("stats.showTable")}
            </button>
          )}
        </div>
      </header>
      {asTable && table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

import { useState } from "react";

export interface BarRow {
  key: string;
  label: string;
  /** Length of the bar, 0..max. */
  value: number;
  /** Text at the bar tip. */
  valueText: string;
  /** Secondary text under the label. */
  detail?: string;
}

interface Props {
  rows: BarRow[];
  max?: number;
  ariaLabel: string;
  onSelect?: (key: string) => void;
}

/** Horizontal bars with the label on the left and the value at the tip; one series, so no legend. */
export function BarList({ rows, max, ariaLabel, onSelect }: Props) {
  const [tip, setTip] = useState<{ row: BarRow; x: number; y: number } | null>(null);
  const top = max ?? Math.max(1e-9, ...rows.map((r) => r.value));
  return (
    <div className="barlist" role="list" aria-label={ariaLabel} onMouseLeave={() => setTip(null)}>
      {rows.map((r) => {
        const Tag = onSelect ? "button" : "div";
        return (
          <Tag
            key={r.key}
            role="listitem"
            className="bar-row"
            {...(onSelect ? { onClick: () => onSelect(r.key) } : {})}
            onMouseMove={(e: React.MouseEvent) => setTip({ row: r, x: e.clientX, y: e.clientY })}
          >
            <span className="bar-label"><span className="bar-name">{r.label}</span>{r.detail && <small className="muted">{r.detail}</small>}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(0, (r.value / top) * 100)}%` }} /></span>
            <span className="bar-value">{r.valueText}</span>
          </Tag>
        );
      })}
      {tip && (
        <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="presentation">
          <strong>{tip.row.label}</strong>
          <div>{tip.row.valueText}{tip.row.detail && ` · ${tip.row.detail}`}</div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";

export interface HistSegment {
  name: string;
  value: number;
  /** CSS class giving the segment its fill (series colour or muted). */
  tone: "primary" | "muted";
}

export interface HistBar {
  key: string;
  /** Short label under the bar (may be hidden when crowded). */
  label: string;
  /** Full text for the tooltip heading. */
  title: string;
  segments: HistSegment[];
}

interface Props {
  bars: HistBar[];
  ariaLabel: string;
  /** Show a label under every n-th bar to avoid collisions. */
  labelEvery?: number;
  onSelect?: (key: string) => void;
  /** Legend for >= 2 segment names (omit for a single series). */
  legend?: { name: string; tone: "primary" | "muted" }[];
}

const nice = (max: number) => {
  if (max <= 5) return Math.max(1, max);
  const mag = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / mag) * mag;
};

/** Vertical bars (optionally stacked) with a y-axis max, labels every n bars and a hover tooltip. */
export function Histogram({ bars, ariaLabel, labelEvery = 1, onSelect, legend }: Props) {
  const [tip, setTip] = useState<{ bar: HistBar; x: number; y: number } | null>(null);
  const max = nice(Math.max(1, ...bars.map((b) => b.segments.reduce((s, x) => s + x.value, 0))));
  return (
    <figure className="hist" role="img" aria-label={ariaLabel}>
      {legend && (
        <ul className="legend">
          {legend.map((l) => <li key={l.name}><i className={`swatch ${l.tone}`} />{l.name}</li>)}
        </ul>
      )}
      <div className="hist-plot">
        <div className="y-axis"><span>{max}</span><span>{max / 2}</span><span>0</span></div>
        <div className="hist-bars" onMouseLeave={() => setTip(null)}>
          {bars.map((b, i) => {
            const total = b.segments.reduce((s, x) => s + x.value, 0);
            const Tag = onSelect ? "button" : "div";
            return (
              <Tag
                key={b.key}
                className="hist-col"
                {...(onSelect ? { onClick: () => onSelect(b.key), "aria-label": `${b.title}: ${total}` } : {})}
                onMouseMove={(e: React.MouseEvent) => setTip({ bar: b, x: e.clientX, y: e.clientY })}
              >
                <span className="hist-stack" style={{ height: `${(total / max) * 100}%` }}>
                  {b.segments.filter((s) => s.value > 0).map((s) => (
                    <span key={s.name} className={`seg ${s.tone}`} style={{ flexGrow: s.value }} />
                  ))}
                </span>
                <span className="hist-label">{i % labelEvery === 0 ? b.label : ""}</span>
              </Tag>
            );
          })}
        </div>
      </div>
      {tip && (
        <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="presentation">
          <strong>{tip.bar.title}</strong>
          {tip.bar.segments.map((s) => <div key={s.name}><i className={`swatch ${s.tone}`} /> {s.name}: {s.value}</div>)}
        </div>
      )}
    </figure>
  );
}

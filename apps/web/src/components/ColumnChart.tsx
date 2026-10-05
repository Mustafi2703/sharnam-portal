/**
 * Excel-style column and line charts for module dashboards: y-axis with gridlines,
 * category labels under every column, the value printed on each column, and a legend for multiple series.
 */
import { useMemo } from "react";

export type Series = { key: string; label: string; color: string };

const PALETTE = ["#1E3A5F", "#0F766E", "#C45C26", "#2563EB", "#7C3AED", "#B45309", "#9F1239", "#059669"];

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 4, step: 1 };
  // Counts: whole-number ticks (no 0.3 / 0.5 steps)
  if (Number.isInteger(v) && v <= 5) return { max: Math.max(v, 1) + (v >= 4 ? 1 : 0), step: 1 };
  const raw = v / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || raw;
  return { max: Math.ceil(v / step) * step, step };
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function wrap(label: string, max = 12): string[] {
  const words = String(label).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2).map((l, i, a) => (i === 1 && a.length === 2 && words.join(" ").length > l.length + a[0].length + 1 ? `${l.slice(0, max - 1)}…` : l));
}

function Frame({ title, subtitle, children, legend }: { title: string; subtitle?: string; children: React.ReactNode; legend?: Series[] }) {
  return (
    <div className="pie-card flex flex-col min-h-[260px]">
      <div className="pie-card__accent" />
      <div className="relative z-[1] mb-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="text-[11px] text-steel-muted">{subtitle}</p> : null}
      </div>
      {legend && legend.length > 1 ? (
        <div className="relative z-[1] flex flex-wrap gap-3 text-[11px] text-steel-muted mb-1">
          {legend.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative z-[1] flex-1">{children}</div>
    </div>
  );
}

/**
 * Vertical column chart. `items` rows carry a `label` plus one numeric field per series
 * (default single series `value`). Grouped columns when several series are given.
 */
export function ColumnChart({
  title,
  subtitle,
  items,
  series,
  yLabel,
  height = 230,
  emptyText = "No entries for this period.",
}: {
  title: string;
  subtitle?: string;
  items: Record<string, unknown>[];
  series?: Series[];
  yLabel?: string;
  height?: number;
  emptyText?: string;
}) {
  const ser = series && series.length ? series : [{ key: "value", label: yLabel || "Count", color: PALETTE[0] }];
  const rows = useMemo(() => (items || []).map((r) => ({ label: String(r.label ?? "—"), vals: ser.map((s) => Number(r[s.key]) || 0) })), [items, ser]);
  const total = rows.reduce((n, r) => n + r.vals.reduce((a, b) => a + b, 0), 0);
  if (!rows.length || total === 0) {
    return (
      <Frame title={title} subtitle={subtitle}>
        <p className="text-sm text-steel-muted">{emptyText}</p>
      </Frame>
    );
  }
  const { max, step } = niceMax(Math.max(...rows.flatMap((r) => r.vals)));
  const padL = 40;
  const padB = 44;
  const padT = 18;
  const groupW = Math.max(46, Math.min(110, 560 / rows.length));
  const width = padL + rows.length * groupW + 12;
  const plotH = height - padB - padT;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const barW = Math.min(34, (groupW - 14) / ser.length);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <Frame title={title} subtitle={subtitle} legend={ser}>
      <div className="overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="max-w-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - 6} y1={y(t)} y2={y(t)} stroke="var(--color-line, #d5dadd)" strokeDasharray={t === 0 ? undefined : "3 3"} />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--color-steel-muted, #5c6570)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {yLabel ? (
            <text x={10} y={padT + plotH / 2} fontSize={10} fill="var(--color-steel-muted, #5c6570)" transform={`rotate(-90 10 ${padT + plotH / 2})`} textAnchor="middle">
              {yLabel}
            </text>
          ) : null}
          {rows.map((r, gi) => {
            const gx = padL + gi * groupW + (groupW - barW * ser.length) / 2;
            return (
              <g key={`${r.label}-${gi}`}>
                {r.vals.map((v, si) => {
                  const x = gx + si * barW;
                  const top = y(v);
                  return (
                    <g key={si}>
                      <rect x={x + 1} y={top} width={barW - 2} height={Math.max(0, padT + plotH - top)} rx={2} fill={ser[si].color}>
                        <title>{`${r.label} · ${ser[si].label}: ${fmt(v)}`}</title>
                      </rect>
                      {v > 0 ? (
                        <text x={x + barW / 2} y={top - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-ink, #111)">
                          {fmt(v)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {wrap(r.label).map((line, li) => (
                  <text key={li} x={padL + gi * groupW + groupW / 2} y={padT + plotH + 14 + li * 12} textAnchor="middle" fontSize={10} fill="var(--color-ink, #111)">
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </Frame>
  );
}

/** Line chart with markers — e.g. cube strength against the IS lower limit. */
export function LineChart({
  title,
  subtitle,
  items,
  series,
  yLabel,
  height = 230,
  emptyText = "No results for this period.",
}: {
  title: string;
  subtitle?: string;
  items: Record<string, unknown>[];
  series: Series[];
  yLabel?: string;
  height?: number;
  emptyText?: string;
}) {
  const rows = (items || []).map((r) => ({ label: String(r.label ?? ""), vals: series.map((s) => Number(r[s.key]) || 0) }));
  if (!rows.length) {
    return (
      <Frame title={title} subtitle={subtitle}>
        <p className="text-sm text-steel-muted">{emptyText}</p>
      </Frame>
    );
  }
  const { max, step } = niceMax(Math.max(...rows.flatMap((r) => r.vals)));
  const padL = 40;
  const padB = 30;
  const padT = 16;
  const stepX = Math.max(44, Math.min(90, 560 / Math.max(1, rows.length - 1)));
  const width = padL + Math.max(1, rows.length - 1) * stepX + 30;
  const plotH = height - padB - padT;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const x = (i: number) => padL + 14 + i * stepX;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return (
    <Frame title={title} subtitle={subtitle} legend={series}>
      <div className="overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="max-w-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - 6} y1={y(t)} y2={y(t)} stroke="var(--color-line, #d5dadd)" strokeDasharray={t === 0 ? undefined : "3 3"} />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--color-steel-muted, #5c6570)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {yLabel ? (
            <text x={10} y={padT + plotH / 2} fontSize={10} fill="var(--color-steel-muted, #5c6570)" transform={`rotate(-90 10 ${padT + plotH / 2})`} textAnchor="middle">
              {yLabel}
            </text>
          ) : null}
          {series.map((s, si) => (
            <g key={s.key}>
              <polyline fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={si > 0 ? "5 4" : undefined} points={rows.map((r, i) => `${x(i)},${y(r.vals[si])}`).join(" ")} />
              {rows.map((r, i) => (
                <g key={i}>
                  <circle cx={x(i)} cy={y(r.vals[si])} r={3.5} fill={s.color} />
                  {si === 0 ? (
                    <text x={x(i)} y={y(r.vals[si]) - 7} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-ink, #111)">
                      {fmt(r.vals[si])}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          ))}
          {rows.map((r, i) => (
            <text key={i} x={x(i)} y={padT + plotH + 16} textAnchor="middle" fontSize={10} fill="var(--color-ink, #111)">
              {r.label}
            </text>
          ))}
        </svg>
      </div>
    </Frame>
  );
}

export const CHART_COLORS = {
  navy: PALETTE[0],
  teal: PALETTE[1],
  orange: PALETTE[2],
  blue: PALETTE[3],
  red: "#B91C1C",
  green: "#15803D",
};

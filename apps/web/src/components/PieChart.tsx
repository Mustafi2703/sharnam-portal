/** Shared dashboard charts — theme-aware, readable in light + dark */

export type ChartItem = { label: string; value: number; color?: string };

const FALLBACK = ["#0B6A78", "#C45C26", "#2563EB", "#7C3AED", "#059669", "#DB2777", "#0891B2", "#D97706"];

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readChartPalette(): string[] {
  if (typeof window === "undefined") return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const keys = [
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
    "--chart-6",
    "--color-brand",
    "--color-mark",
  ];
  const found = keys
    .map((k) => s.getPropertyValue(k).trim())
    .filter((c) => c && (c.startsWith("#") || c.startsWith("rgb") || c.startsWith("hsl")));
  return found.length >= 2 ? found : FALLBACK;
}

function normalizeItems(items: ChartItem[] | undefined | null): ChartItem[] {
  return (items || [])
    .map((i) => ({
      label: String(i?.label ?? "—"),
      value: Number(i?.value) || 0,
      color: i?.color,
    }))
    .filter((i) => i.value > 0);
}

function donutPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const x0o = cx + rOuter * Math.cos(a0);
  const y0o = cy + rOuter * Math.sin(a0);
  const x1o = cx + rOuter * Math.cos(a1);
  const y1o = cy + rOuter * Math.sin(a1);
  const x0i = cx + rInner * Math.cos(a1);
  const y0i = cy + rInner * Math.sin(a1);
  const x1i = cx + rInner * Math.cos(a0);
  const y1i = cy + rInner * Math.sin(a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x0i} ${y0i}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x1i} ${y1i}`,
    "Z",
  ].join(" ");
}

export function PieChart({
  title,
  items,
  size = 168,
}: {
  title: string;
  items: ChartItem[];
  size?: number;
}) {
  const palette = readChartPalette();
  const brand = palette[0] || FALLBACK[0];
  const paper = cssVar("--color-paper", "#ffffff");
  const muted = cssVar("--color-steel-muted", "#5c6570");
  const ring = cssVar("--color-line", "#d5dadd");
  const rows = normalizeItems(items);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter * 0.58;
  let angle = -Math.PI / 2;

  return (
    <div className="pie-card h-full flex flex-col min-h-[220px]">
      <div className="pie-card__accent" />
      <h3 className="text-sm font-semibold text-ink mb-3 relative z-[1]">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-steel-muted relative z-[1]">No chart data yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4 flex-1 relative z-[1]">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="shrink-0 mx-auto"
            role="img"
            aria-label={`${title}: ${Math.round(total)} total`}
          >
            <circle cx={cx} cy={cy} r={rOuter + 2} fill={ring} opacity={0.35} />
            {rows.map((row, i) => {
              const slice = (row.value / total) * Math.PI * 2;
              const a0 = angle;
              const a1 = angle + Math.max(slice, 0.04);
              angle += slice;
              const color = row.color || palette[i % palette.length];
              if (rows.length === 1 || slice >= Math.PI * 2 - 0.001) {
                return (
                  <g key={row.label}>
                    <circle cx={cx} cy={cy} r={rOuter} fill={color} />
                    <circle cx={cx} cy={cy} r={rInner} fill={paper} />
                  </g>
                );
              }
              return (
                <path
                  key={`${row.label}-${i}`}
                  d={donutPath(cx, cy, rOuter, rInner, a0, a1)}
                  fill={color}
                  stroke={paper}
                  strokeWidth={2}
                />
              );
            })}
            <circle cx={cx} cy={cy} r={rInner - 1} fill={paper} />
            <text x={cx} y={cy - 2} textAnchor="middle" fill={brand} style={{ fontSize: 22, fontWeight: 700 }}>
              {Math.round(total)}
            </text>
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              fill={muted}
              style={{ fontSize: 9, letterSpacing: "0.1em", fontWeight: 600 }}
            >
              TOTAL
            </text>
          </svg>
          <ul className="text-xs space-y-2.5 min-w-[132px] flex-1">
            {rows.map((row, i) => {
              const color = row.color || palette[i % palette.length];
              const pct = Math.round((row.value / total) * 100);
              return (
                <li key={`${row.label}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 truncate min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-black/10"
                      style={{ background: color }}
                    />
                    <span className="truncate font-medium text-ink" title={row.label}>
                      {row.label}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums shrink-0 text-right">
                    <span className="text-ink font-semibold">{row.value}</span>
                    <span className="text-brand font-semibold ml-1.5">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Horizontal bar chart used on Progress / Cost desks */
export function BarChart({
  title,
  items,
  valueKey = "value",
  compareKey,
  maxBars = 12,
}: {
  title: string;
  items: any[];
  valueKey?: string;
  compareKey?: string;
  maxBars?: number;
}) {
  const palette = readChartPalette();
  const primary = palette[0] || FALLBACK[0];
  const secondary = palette[1] || FALLBACK[1];
  const track = cssVar("--color-line", "#d5dadd");
  const rows = (items || []).slice(0, maxBars);
  const max = Math.max(
    1,
    ...rows.map((r) => Math.max(Number(r[valueKey]) || 0, compareKey ? Number(r[compareKey]) || 0 : 0))
  );

  return (
    <div className="pie-card h-full flex flex-col min-h-[180px]">
      <div className="pie-card__accent" />
      <h3 className="text-sm font-semibold text-ink mb-3 relative z-[1]">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-steel-muted relative z-[1]">No chart data yet.</p>
      ) : (
        <div className="space-y-3 flex-1 relative z-[1]">
          {rows.map((r, idx) => {
            const a = Number(r[valueKey]) || 0;
            const b = compareKey ? Number(r[compareKey]) || 0 : 0;
            const label = String(r.label ?? `Row ${idx + 1}`);
            return (
              <div
                key={`${label}-${idx}`}
                className="grid grid-cols-[minmax(72px,110px)_1fr_auto] gap-2 items-center text-xs"
              >
                <div className="truncate text-steel-muted font-medium" title={label}>
                  {label}
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="h-2.5 rounded-sm overflow-hidden" style={{ background: track }}>
                    <div
                      className="h-full rounded-sm transition-[width]"
                      style={{
                        width: `${Math.max((a / max) * 100, a > 0 ? 3 : 0)}%`,
                        minWidth: a > 0 ? 2 : 0,
                        background: primary,
                      }}
                    />
                  </div>
                  {compareKey != null && (
                    <div className="h-2.5 rounded-sm overflow-hidden" style={{ background: track }}>
                      <div
                        className="h-full rounded-sm transition-[width]"
                        style={{
                          width: `${Math.max((b / max) * 100, b > 0 ? 3 : 0)}%`,
                          minWidth: b > 0 ? 2 : 0,
                          background: secondary,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-ink text-right whitespace-nowrap tabular-nums">
                  {compareKey != null
                    ? `${Math.round(a)} / ${Math.round(b)}`
                    : Number.isInteger(a)
                      ? a
                      : a.toFixed(1)}
                </div>
              </div>
            );
          })}
          {compareKey != null && (
            <div className="flex gap-3 text-[10px] uppercase tracking-wide text-steel-muted pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 inline-block rounded-sm" style={{ background: primary }} />
                Primary
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 inline-block rounded-sm" style={{ background: secondary }} />
                Compare
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

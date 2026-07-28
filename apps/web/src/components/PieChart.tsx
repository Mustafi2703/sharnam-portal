/** Vibrant Sharnam donut charts */
const PALETTE = [
  "#0f766e",
  "#126e82",
  "#f59e0b",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
];

export type PieItem = { label: string; value: number; color?: string };

export function PieChart({
  title,
  items,
  size = 156,
}: {
  title: string;
  items: PieItem[];
  size?: number;
}) {
  const rows = (items || []).filter((i) => Number(i.value) > 0);
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0) || 1;
  const r = size / 2;
  const ir = r * 0.56;
  let angle = -Math.PI / 2;

  function arc(cx: number, cy: number, rad: number, a0: number, a1: number) {
    const x0 = cx + rad * Math.cos(a0);
    const y0 = cy + rad * Math.sin(a0);
    const x1 = cx + rad * Math.cos(a1);
    const y1 = cy + rad * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1}`;
  }

  return (
    <div className="pie-card h-full flex flex-col min-h-[200px]">
      <div className="pie-card__accent" />
      <h3 className="text-sm font-semibold text-ink mb-3 relative">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-steel-muted relative">No chart data.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4 flex-1 relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 mx-auto drop-shadow-sm">
            <circle cx={r} cy={r} r={r - 1} fill="#f0fdfa" />
            {rows.map((row, i) => {
              const slice = (Number(row.value) / total) * Math.PI * 2;
              const a0 = angle;
              const a1 = angle + Math.max(slice, 0.02);
              angle += slice;
              const color = row.color || PALETTE[i % PALETTE.length];
              if (slice >= Math.PI * 2 - 0.001) {
                return <circle key={row.label} cx={r} cy={r} r={r - 4} fill={color} />;
              }
              const outer = arc(r, r, r - 4, a0, a1);
              const inner = arc(r, r, ir, a1, a0);
              return (
                <path
                  key={row.label}
                  d={`${outer} L ${r + ir * Math.cos(a1)} ${r + ir * Math.sin(a1)} ${inner} Z`}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              );
            })}
            <circle cx={r} cy={r} r={ir - 1} fill="#fff" />
            <text x={r} y={r - 2} textAnchor="middle" fill="#0f766e" style={{ fontSize: 20, fontWeight: 700 }}>
              {Math.round(total)}
            </text>
            <text x={r} y={r + 14} textAnchor="middle" fill="#5c6578" style={{ fontSize: 9, letterSpacing: "0.08em" }}>
              TOTAL
            </text>
          </svg>
          <ul className="text-xs space-y-2 min-w-[128px] flex-1">
            {rows.map((row, i) => {
              const color = row.color || PALETTE[i % PALETTE.length];
              const pct = Math.round((Number(row.value) / total) * 100);
              return (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 truncate min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm" style={{ background: color }} />
                    <span className="truncate font-medium text-ink" title={row.label}>
                      {row.label}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-steel-muted shrink-0">
                    {row.value}
                    <span className="text-brand font-semibold ml-1">{pct}%</span>
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

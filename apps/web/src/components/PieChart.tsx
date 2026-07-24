/** Workday-style donut / pie chart — no chart library dependency */
const PALETTE = ["#C45C26", "#3D4450", "#2F6F4E", "#0B6A78", "#C24D1A", "#64748B", "#1C4A5A", "#E4632A"];

export type PieItem = { label: string; value: number; color?: string };

export function PieChart({
  title,
  items,
  size = 148,
}: {
  title: string;
  items: PieItem[];
  size?: number;
}) {
  const rows = (items || []).filter((i) => Number(i.value) > 0);
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0) || 1;
  const r = size / 2;
  const ir = r * 0.58;
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
    <div className="wd-pie card-pad h-full flex flex-col min-h-[180px] rounded-sm border border-line bg-white p-4">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-steel-muted">No chart data.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 mx-auto">
            {rows.map((row, i) => {
              const slice = (Number(row.value) / total) * Math.PI * 2;
              const a0 = angle;
              const a1 = angle + slice;
              angle = a1;
              const color = row.color || PALETTE[i % PALETTE.length];
              if (slice >= Math.PI * 2 - 0.001) {
                return (
                  <circle key={row.label} cx={r} cy={r} r={r - 2} fill={color} />
                );
              }
              const outer = arc(r, r, r - 2, a0, a1);
              const inner = arc(r, r, ir, a1, a0);
              return (
                <path
                  key={row.label}
                  d={`${outer} L ${r + ir * Math.cos(a1)} ${r + ir * Math.sin(a1)} ${inner} Z`}
                  fill={color}
                />
              );
            })}
            <circle cx={r} cy={r} r={ir - 1} fill="#fff" />
            <text x={r} y={r - 4} textAnchor="middle" className="fill-ink" style={{ fontSize: 18, fontWeight: 700 }}>
              {Math.round(total)}
            </text>
            <text x={r} y={r + 14} textAnchor="middle" className="fill-steel-muted" style={{ fontSize: 9 }}>
              TOTAL
            </text>
          </svg>
          <ul className="text-xs space-y-1.5 min-w-[120px] flex-1">
            {rows.map((row, i) => (
              <li key={row.label} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: row.color || PALETTE[i % PALETTE.length] }}
                  />
                  <span className="truncate" title={row.label}>
                    {row.label}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {row.value} · {Math.round((Number(row.value) / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Charts matching DRAWING REGISTER - 01.xlsx Dashboard. */

export type RegisterDashLine = {
  building?: string | null;
  discipline?: string | null;
  drawingType?: string | null;
  consultantName?: string | null;
  criticalDrawing?: string | null;
  delayResponsibility?: string | null;
  submissionDelayDays?: number | null;
  plannedSubmissionDate?: string | Date | null;
  actualSubmissionDate?: string | Date | null;
  revisionDate?: string | Date | null;
  issueDate?: string | Date | null;
};

const PALETTE = ["#1e3a5f", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#65a30d", "#c2410c", "#4338ca", "#0e7490"];

export function isoWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return {
    year: date.getUTCFullYear(),
    week: Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}

export function isoWeekRange(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const start = new Date(jan4);
  start.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function stamp(value?: string | Date | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(value: string | Date | null | undefined, start: Date, end: Date) {
  const d = stamp(value);
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function filterRegisterLines(lines: RegisterDashLine[], start: Date | null, end: Date | null) {
  if (!start || !end) return lines;
  return lines.filter(
    (line) =>
      inRange(line.actualSubmissionDate, start, end) ||
      inRange(line.plannedSubmissionDate, start, end) ||
      inRange(line.revisionDate, start, end) ||
      inRange(line.issueDate, start, end),
  );
}

function countBy(lines: RegisterDashLine[], pick: (line: RegisterDashLine) => string) {
  const acc: Record<string, number> = {};
  for (const line of lines) {
    const label = pick(line).trim() || "Other";
    acc[label] = (acc[label] || 0) + 1;
  }
  return Object.entries(acc)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function DrawingRegisterCharts({ lines }: { lines: RegisterDashLine[] }) {
  const location = (() => {
    const acc: Record<string, number> = {};
    for (const line of lines) {
      const building = (line.building || "—").trim() || "—";
      const discipline = (line.discipline || "Other").trim() || "Other";
      const label = `${building} · ${discipline}`;
      acc[label] = (acc[label] || 0) + 1;
    }
    return Object.entries(acc)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  })();
  const byDiscipline = countBy(lines, (l) => l.discipline || "Other");
  const byType = countBy(lines, (l) => l.drawingType || "Other");
  const byOrg = countBy(lines, (l) => (l.consultantName || "").trim() || "Unassigned");
  const critical = countBy(lines, (l) => (/yes/i.test(l.criticalDrawing || "") ? "Yes" : "No"));
  const submitted = lines.filter((l) => stamp(l.actualSubmissionDate)).length;
  const pending = Math.max(0, lines.length - submitted);
  const delay = (() => {
    const acc: Record<string, number> = {};
    for (const line of lines) {
      const days = line.submissionDelayDays ?? 0;
      if (!days) continue;
      const label = (line.delayResponsibility || "").trim() || "Unassigned";
      acc[label] = (acc[label] || 0) + days;
    }
    return Object.entries(acc)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <ColumnChart title="Location wise drawings submitted" points={location} emptyLabel="No buildings on the register yet" />
      <DoughnutChart title="Total drawings submitted" points={byDiscipline} emptyLabel="No drawings on the register yet" />
      <DoughnutChart title="Total critical drawings" points={critical} emptyLabel="No criticality set yet" />
      <ColumnChart title="Submission delay in days" points={delay} emptyLabel="No delay days yet — set planned date and upload on GFC" />
      <ColumnChart title="Drawings submitted by org" points={byOrg} emptyLabel="No consultant or org on the register yet" />
      <ColumnChart title="Drawing type" points={byType} emptyLabel="No drawing type tagged yet" />
      <DoughnutChart
        title="Submitted at this point"
        className="lg:col-span-2"
        points={[
          { label: "Submitted", value: submitted },
          { label: "Not yet submitted", value: pending },
        ].filter((p) => p.value > 0)}
        emptyLabel="No drawings in this week or date range"
        centerLabel={lines.length ? `${Math.round((submitted / lines.length) * 100)}%` : "0%"}
      />
    </div>
  );
}

function ColumnChart({
  title,
  points,
  emptyLabel,
}: {
  title: string;
  points: { label: string; value: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const shown = points.slice(0, 14);
  return (
    <div className="rounded-xl border border-line bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-line bg-[#1e3a5f] text-white text-xs font-medium tracking-wide">{title}</div>
      <div className="p-4">
        {!shown.length && <p className="text-sm text-steel-muted">{emptyLabel}</p>}
        {!!shown.length && (
          <div className="flex items-end gap-2 h-44 overflow-x-auto">
            {shown.map((p, i) => (
              <div key={p.label} className="flex flex-col items-center justify-end h-full min-w-[3.2rem] flex-1">
                <span className="text-[10px] font-mono text-ink mb-1">{p.value}</span>
                <div
                  className="w-full max-w-[2.2rem] rounded-t"
                  style={{
                    height: `${Math.max(8, Math.round((p.value / max) * 120))}px`,
                    background: PALETTE[i % PALETTE.length],
                  }}
                  title={`${p.label}: ${p.value}`}
                />
                <span className="mt-1 text-[10px] text-steel-muted text-center leading-tight line-clamp-2" title={p.label}>
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DoughnutChart({
  title,
  points,
  emptyLabel,
  centerLabel,
  className = "",
}: {
  title: string;
  points: { label: string; value: number }[];
  emptyLabel: string;
  centerLabel?: string;
  className?: string;
}) {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className={`rounded-xl border border-line bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-2 border-b border-line bg-[#1e3a5f] text-white text-xs font-medium tracking-wide">{title}</div>
      <div className="p-4 flex flex-wrap items-center gap-6">
        {!total && <p className="text-sm text-steel-muted">{emptyLabel}</p>}
        {!!total && (
          <>
            <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0">
              {points.map((p, i) => {
                const frac = p.value / total;
                const dash = Math.max(frac * c - 1, 0);
                const rot = (acc / total) * 360 - 90;
                acc += p.value;
                return (
                  <circle
                    key={p.label}
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth="16"
                    strokeDasharray={`${dash} ${c - dash}`}
                    transform={`rotate(${rot} 60 60)`}
                  />
                );
              })}
              <text x="60" y="64" textAnchor="middle" className="fill-ink" fontSize="14" fontWeight="600">
                {centerLabel || total}
              </text>
            </svg>
            <ul className="space-y-1.5 text-sm min-w-[10rem]">
              {points.map((p, i) => (
                <li key={p.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate text-steel-muted" title={p.label}>
                    {p.label}
                  </span>
                  <span className="ml-auto font-mono text-xs">
                    {p.value} · {Math.round((p.value / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

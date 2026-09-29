/** Horizontal bar charts for DRAWING REGISTER - 01.xlsx dashboard pivots. */
export function DrawingRegisterCharts({
  byDiscipline,
  byCritical,
  delayByResponsibility,
  byConsultant = [],
  byPackage = [],
  byBuilding = [],
  byDrawingType = [],
  byBuildingDiscipline = [],
}: {
  byDiscipline: { label: string; value: number }[];
  byCritical: { label: string; value: number }[];
  delayByResponsibility: { label: string; days: number }[];
  byConsultant?: { label: string; value: number }[];
  byPackage?: { label: string; value: number }[];
  byBuilding?: { label: string; value: number }[];
  byDrawingType?: { label: string; value: number }[];
  byBuildingDiscipline?: { building: string; discipline: string; count: number }[];
}) {
  const buildingDiscPoints = byBuildingDiscipline.map((r) => ({
    label: `${r.building} · ${r.discipline}`,
    value: r.count,
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <BarChartCard title="By discipline" points={byDiscipline.map((p) => ({ label: p.label, value: p.value }))} />
      <BarChartCard title="By drawing type" points={byDrawingType.map((p) => ({ label: p.label, value: p.value }))} />
      <BarChartCard title="Critical drawing" points={byCritical.map((p) => ({ label: p.label, value: p.value }))} />
      <BarChartCard title="By package" points={byPackage.map((p) => ({ label: p.label, value: p.value }))} emptyLabel="No packages tagged yet" />
      <BarChartCard title="By building" points={byBuilding.map((p) => ({ label: p.label, value: p.value }))} emptyLabel="No buildings tagged yet" />
      <BarChartCard title="By consultant" points={byConsultant.map((p) => ({ label: p.label, value: p.value }))} emptyLabel="No consultants tagged yet" />
      <BarChartCard
        title="Building × discipline"
        className="lg:col-span-2"
        points={buildingDiscPoints}
        emptyLabel="No building × discipline rows yet"
      />
      <BarChartCard
        title="Delay responsibility (days)"
        className="lg:col-span-2"
        points={delayByResponsibility.map((p) => ({ label: p.label, value: p.days }))}
        emptyLabel="No delay responsibility tagged yet"
      />
    </div>
  );
}

function BarChartCard({
  title,
  points,
  className = "",
  emptyLabel = "No data yet",
}: {
  title: string;
  points: { label: string; value: number }[];
  className?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={`rounded-xl border border-line bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-2 border-b border-line bg-procore-navy text-white text-xs font-semibold uppercase tracking-wider">
        {title}
      </div>
      <div className="p-4 space-y-2.5">
        {points.length === 0 && <p className="text-sm text-steel-muted">{emptyLabel}</p>}
        {points.slice(0, 12).map((p) => (
          <div key={p.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] gap-2 items-center text-sm">
            <span className="truncate text-steel-muted" title={p.label}>
              {p.label}
            </span>
            <div className="h-3 rounded-full bg-sand/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-procore-navy/90 transition-all"
                style={{ width: `${Math.round((p.value / max) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-right">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

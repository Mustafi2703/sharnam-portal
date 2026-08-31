import { BarChart, PieChart } from "./PieChart";
import { Card } from "./ui";

export type WprCharts = {
  rangeStart: string;
  rangeEnd: string;
  summary: {
    plannedPct: number;
    actualPct: number;
    variancePct: number;
    spi: number;
    openNcrs: number;
    dprDaysInRange: number;
    milestonesOnTrack: number;
    milestonesTotal: number;
    drawingsRegistered: number;
    safetyEvents: number;
  };
  scurve: { date: string; label: string; planned: number; actual: number }[];
  manpowerHistogram: { label: string; planned: number; actual: number }[];
  cashflow: { label: string; planned: number; actual: number }[];
  milestones: { label: string; planned: number; actual: number }[];
  drawingDci: { label: string; value: number }[];
  plannedVsActual: { label: string; planned: number; actual: number }[];
  quality: { label: string; value: number }[];
  safety: { label: string; previous: number; current: number }[];
  dashboardKpis: [string, string | number][];
};

function ScurveChart({ points }: { points: { label: string; planned: number; actual: number }[] }) {
  const rows = points.length ? points : [{ label: "—", planned: 0, actual: 0 }];
  const w = 360;
  const h = 160;
  const pad = 28;
  const maxY = Math.max(10, ...rows.flatMap((p) => [p.planned, p.actual])) * 1.08;
  const step = rows.length > 1 ? (w - pad * 2) / (rows.length - 1) : 0;
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const planned = rows.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.planned)}`).join(" ");
  const actual = rows.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.actual)}`).join(" ");
  const hasData = rows.some((p) => p.planned > 0 || p.actual > 0);
  return (
    <div>
      <div className="text-sm font-semibold mb-2">Progress trend · planned vs actual % (DPR rollup)</div>
      {!hasData ? (
        <p className="text-sm text-steel-muted mb-2">Publish DPRs in this window — or use section table data below after Regenerate.</p>
      ) : null}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-lg min-h-[140px]" role="img" aria-label="WPR progress curve">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        {planned.includes("L") ? (
          <path d={planned} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="4 3" />
        ) : null}
        <path d={actual} fill="none" stroke="#0F766E" strokeWidth="2.5" />
      </svg>
      <div className="flex gap-4 text-[11px] text-steel-muted mt-1 flex-wrap">
        {rows.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

function SafetyCompareChart({ items }: { items: { label: string; previous: number; current: number }[] }) {
  const rows = items.filter((i) => i.previous > 0 || i.current > 0);
  if (!rows.length) return <p className="text-sm text-steel-muted">No safety records in this window.</p>;
  return (
    <BarChart
      title="HSE indicators · previous vs current period"
      items={rows.map((r) => ({ label: r.label, planned: r.previous, actual: r.current }))}
      valueKey="actual"
      compareKey="planned"
    />
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "warn" ? "border-warn/40 bg-warn/5" : tone === "ok" ? "border-ok/40 bg-ok/5" : "border-line bg-white"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-steel-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

export function WprDashboardCharts({ charts, emptyHint }: { charts: WprCharts; emptyHint?: boolean }) {
  const s = charts.summary;
  const spiTone = s.spi >= 0.95 ? "ok" : s.spi < 0.85 ? "warn" : undefined;
  const varTone = s.variancePct < -5 ? "warn" : s.variancePct >= 0 ? "ok" : undefined;

  return (
    <div className="space-y-5">
      {emptyHint && (
        <p className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-lg px-3 py-2">
          Showing section-table preview — click <strong>Regenerate from live data</strong> for full DPR-linked charts.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiTile label="Planned %" value={s.plannedPct ? `${s.plannedPct}%` : "—"} />
        <KpiTile label="Actual %" value={s.actualPct ? `${s.actualPct}%` : "—"} tone={varTone} />
        <KpiTile label="Variance" value={s.variancePct ? `${s.variancePct}%` : "—"} tone={varTone} />
        <KpiTile label="SPI" value={s.spi || "—"} tone={spiTone} />
        <KpiTile label="Open NCRs" value={s.openNcrs} tone={s.openNcrs > 0 ? "warn" : "ok"} />
        <KpiTile label="DPR days" value={s.dprDaysInRange} />
        <KpiTile
          label="Milestones"
          value={s.milestonesTotal ? `${s.milestonesOnTrack}/${s.milestonesTotal}` : "—"}
        />
        <KpiTile label="Drawings" value={s.drawingsRegistered || "—"} />
        <KpiTile label="Safety events" value={s.safetyEvents} />
      </div>

      <p className="text-xs text-steel-muted px-1">
        Reporting window: {charts.rangeStart} → {charts.rangeEnd} · charts match SPDC WPR PPT slides (milestone,
        manpower histogram, cashflow, DCI, planned vs actual, quality, safety).
      </p>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <ScurveChart points={charts.scurve} />
        </Card>
        {charts.manpowerHistogram.length > 0 ? (
          <BarChart
            title="Weekly manpower histogram"
            items={charts.manpowerHistogram}
            valueKey="actual"
            compareKey="planned"
          />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">No manpower data — fill Progress → Planned vs Actual or DPR.</Card>
        )}
        {charts.milestones.length > 0 ? (
          <BarChart
            title="Project milestone schedule · plan vs actual days"
            items={charts.milestones}
            valueKey="actual"
            compareKey="planned"
          />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">No milestones — open <strong>24 report sections</strong> tab or Regenerate.</Card>
        )}
        {charts.cashflow.length > 0 ? (
          <BarChart
            title="Project cashflow overview (₹ lakh)"
            items={charts.cashflow}
            valueKey="actual"
            compareKey="planned"
          />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">Cashflow chart fills from Cost module periods.</Card>
        )}
        {charts.drawingDci.length > 0 ? (
          <PieChart title="Drawing register · DCI by discipline" items={charts.drawingDci} />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">Drawing DCI pie — populate Drawing Register section.</Card>
        )}
        {charts.plannedVsActual.length > 0 ? (
          <BarChart
            title="Planned vs actual · weekly qty"
            items={charts.plannedVsActual}
            valueKey="actual"
            compareKey="planned"
          />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">Planned vs actual — from Progress activity lines.</Card>
        )}
        {charts.quality.length > 0 ? (
          <PieChart title="Weekly quality updates · QAP status" items={charts.quality} />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">Quality pie — from QAP / cube tests in period.</Card>
        )}
        {charts.safety.some((x) => x.previous > 0 || x.current > 0) ? (
          <SafetyCompareChart items={charts.safety} />
        ) : (
          <Card className="p-4 text-sm text-steel-muted min-h-[180px]">Safety compare — log toolbox talks / incidents in Safety module.</Card>
        )}
      </div>
    </div>
  );
}

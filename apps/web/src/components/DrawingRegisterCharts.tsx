/** Drawing register dashboard — same chart cards as the quality dashboard. */

import { PieChart } from "./PieChart";
import { ColumnChart } from "./ColumnChart";

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

const DISCIPLINE_COLORS = ["#1E3A5F", "#C45C26", "#0F766E", "#2563EB", "#7C3AED", "#B45309", "#9F1239", "#059669"];

export function DrawingRegisterCharts({ lines }: { lines: RegisterDashLine[] }) {
  const sub = lines.filter((l) => stamp(l.actualSubmissionDate));
  // Location wise (building) × discipline, as in DRAWING REGISTER Dashboard chart 1
  const disciplines = [...new Set(lines.map((l) => (l.discipline || "Other").trim() || "Other"))];
  const buildings = [...new Set(lines.map((l) => (l.building || "—").trim() || "—"))];
  const locationRows = buildings.map((b) => {
    const row: Record<string, unknown> = { label: b };
    for (const d of disciplines) {
      row[d] = sub.filter((l) => ((l.building || "—").trim() || "—") === b && ((l.discipline || "Other").trim() || "Other") === d).length;
    }
    return row;
  });
  const discSeries = disciplines.map((d, i) => ({ key: d, label: d, color: DISCIPLINE_COLORS[i % DISCIPLINE_COLORS.length] }));
  const byDiscipline = countBy(sub, (l) => l.discipline || "Other");
  const byType = countBy(lines, (l) => l.drawingType || "Other");
  const byOrg = countBy(sub, (l) => (l.consultantName || "").trim() || "Unassigned");
  const critical = countBy(lines, (l) => (/yes/i.test(l.criticalDrawing || "") ? "Critical" : "Not critical"));
  const pending = Math.max(0, lines.length - sub.length);
  const delayByDiscipline = disciplines
    .map((d) => ({
      label: d,
      value: lines.filter((l) => ((l.discipline || "Other").trim() || "Other") === d).reduce((n, l) => n + Math.max(0, l.submissionDelayDays ?? 0), 0),
    }))
    .filter((r) => r.value > 0);
  const delayByResp = (() => {
    const acc: Record<string, number> = {};
    for (const line of lines) {
      const days = line.submissionDelayDays ?? 0;
      if (days <= 0) continue;
      const label = (line.delayResponsibility || "").trim() || "Unassigned";
      acc[label] = (acc[label] || 0) + days;
    }
    return Object.entries(acc).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      <div className="md:col-span-2">
        <ColumnChart title="Location wise drawings submitted" subtitle="Building / area by discipline" items={locationRows} series={discSeries} yLabel="Drawings" />
      </div>
      <PieChart title="Total drawings submitted" items={byDiscipline} />
      <PieChart title="Total critical drawings" items={critical} />
      <ColumnChart title="Submission delay in days" subtitle="Days late against the planned date, by discipline" items={delayByDiscipline} series={[{ key: "value", label: "Delay (days)", color: "#B91C1C" }]} yLabel="Days" emptyText="No delays in this period." />
      <ColumnChart title="Drawings submitted by org" subtitle="Consultant / organisation" items={byOrg} series={[{ key: "value", label: "Drawings", color: "#0F766E" }]} yLabel="Drawings" />
      <ColumnChart title="Delay by responsibility" subtitle="Who the delay days sit with" items={delayByResp} series={[{ key: "value", label: "Delay (days)", color: "#C45C26" }]} yLabel="Days" emptyText="No delays in this period." />
      <PieChart title="Drawing type" items={byType} />
      <PieChart
        title="Submitted at this point"
        items={[
          { label: "Submitted", value: sub.length },
          { label: "Not yet submitted", value: pending },
        ]}
      />
    </div>
  );
}

/**
 * Branded HTML export for DPR Maker snapshots (Print → Save as PDF).
 */
import { renderBrandedReportHtml } from "./brandedExport.js";
import type { DprDelay, DprHeader, DprIssue, DprLine, DprManpower, DprMaterial, DprPhoto, DprSafety } from "./dprXlsx.js";

function inr(v: number | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function renderDprSnapshotHtml(opts: {
  project: { code: string; name: string; clientName?: string | null; location?: string | null };
  logDate: Date;
  discipline: string;
  status: string;
  header: DprHeader;
  lines: DprLine[];
  manpower?: DprManpower[];
  materials?: DprMaterial[];
  safety?: Partial<DprSafety>;
  highlights?: string[];
  nextDayPlan?: string[];
  delays?: DprDelay[];
  issues?: DprIssue[];
  signatures?: DprPhoto[];
}): string {
  const h = opts.header;
  const qtyToday = opts.lines.reduce((s, l) => s + (l.qtyToday || 0), 0);
  const manActual = (opts.manpower || []).reduce((s, m) => s + (m.actual || 0), 0);
  const rebarKg = (opts.materials || []).find((m) => /reinforcement|rebar|fe 500/i.test(m.name))?.consumed || 0;

  const sections: { heading: string; headers: string[]; rows: (string | number)[][] }[] = [
    {
      heading: "Quantity progress",
      headers: ["Group", "Description", "Unit", "Scope", "Cum prev", "Today", "Remarks"],
      rows: opts.lines.map((l) => [
        l.group || "—",
        l.description,
        l.unit || "—",
        l.scopeQty ?? "—",
        l.cumQtyPrev ?? "—",
        l.qtyToday ?? 0,
        l.remarks || "",
      ]),
    },
  ];

  if (opts.manpower?.length) {
    sections.push({
      heading: "Manpower deployed",
      headers: ["Trade", "Planned", "Actual", "Hours"],
      rows: opts.manpower.map((m) => [m.trade, m.planned ?? 0, m.actual ?? 0, m.hoursWorked ?? 8]),
    });
  }

  if (opts.materials?.length) {
    sections.push({
      heading: "Materials at site",
      headers: ["Material", "Unit", "Opening", "Received", "Consumed"],
      rows: opts.materials.map((m) => [m.name, m.unit || "", m.opening ?? 0, m.received ?? 0, m.consumed ?? 0]),
    });
  }

  if (opts.highlights?.length) {
    sections.push({
      heading: "Today's highlights",
      headers: ["#", "Note"],
      rows: opts.highlights.filter(Boolean).map((t, i) => [i + 1, t]),
    });
  }

  if (opts.nextDayPlan?.length) {
    sections.push({
      heading: "Next day plan",
      headers: ["#", "Activity"],
      rows: opts.nextDayPlan.filter(Boolean).map((t, i) => [i + 1, t]),
    });
  }

  if (opts.delays?.length) {
    sections.push({
      heading: "Delays / idle time",
      headers: ["Cause", "Category", "Hours lost", "EOT"],
      rows: opts.delays.map((d) => [d.cause || "—", d.category || "—", d.hoursLost ?? "—", d.eot || "—"]),
    });
  }

  if (opts.issues?.length) {
    sections.push({
      heading: "Issues & risks",
      headers: ["Description", "Severity", "Owner"],
      rows: opts.issues.map((i) => [i.description || "—", i.severity || "—", i.owner || "—"]),
    });
  }

  if (opts.signatures?.length) {
    sections.push({
      heading: "Sign-off",
      headers: ["Role", "Captured", "Path"],
      rows: opts.signatures.map((s) => [s.caption || "Signer", fmtDate(s.takenAt), s.path]),
    });
  }

  const s = opts.safety || {};
  return renderBrandedReportHtml({
    title: `Daily Progress Report · ${opts.discipline.replace(/_/g, " ")}`,
    subtitle: `${fmtDate(opts.logDate.toISOString())} · ${opts.status} · SPDC discipline template data`,
    project: opts.project,
    kpis: [
      { label: "Report no.", value: h.reportNumber || "—" },
      { label: "Qty today", value: qtyToday },
      { label: "Manpower on site", value: manActual },
      { label: "Rebar consumed (kg)", value: rebarKg },
      { label: "Safe man-hours", value: s.safeManHoursToday ?? 0 },
      { label: "AC certified", value: inr(h.acCertifiedToDate) },
    ],
    sections: [
      {
        heading: "Project header",
        headers: ["Field", "Value"],
        rows: [
          ["Contractor", h.contractor || "—"],
          ["Location", h.location || opts.project.location || "—"],
          ["Weather", h.weather || "—"],
          ["Report date", fmtDate(h.reportDate)],
          ["Data date", fmtDate(h.dataDate)],
          ["Prepared by", h.preparedBy || "—"],
          ["Cum man-days (prev)", h.cumManDaysPrev ?? "—"],
          ["Cum safe man-hours (prev)", h.cumSafeManHoursPrev ?? "—"],
        ],
      },
      ...sections,
    ],
  });
}

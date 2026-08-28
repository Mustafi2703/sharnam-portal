import XLSX from "../lib/xlsx.js";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";

const __apiDir = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_EMAIL_LOGO = path.resolve(__apiDir, "../../assets/logo.png");

const EMAIL_LOGO_CANDIDATES = [
  BUNDLED_EMAIL_LOGO,
  path.resolve(process.cwd(), "apps/api/assets/logo.png"),
  path.resolve(process.cwd(), "apps/web/public/logo.png"),
  path.resolve(process.cwd(), "../web/public/logo.png"),
  path.resolve(process.cwd(), "../../apps/web/public/logo.png"),
  path.resolve(process.cwd(), "public/logo.png"),
];

const BUNDLED_LOGO = path.resolve(__apiDir, "../../assets/logo-transparent.png");

const LOGO_CANDIDATES = [
  BUNDLED_LOGO,
  path.resolve(process.cwd(), "apps/api/assets/logo-transparent.png"),
  path.resolve(process.cwd(), "apps/web/public/logo-transparent.png"),
  path.resolve(process.cwd(), "../web/public/logo-transparent.png"),
  path.resolve(process.cwd(), "../../apps/web/public/logo-transparent.png"),
  path.resolve(process.cwd(), "public/logo-transparent.png"),
  ...EMAIL_LOGO_CANDIDATES,
];

export type SheetSpec = {
  name: string;
  /** First row = headers */
  rows: (string | number | boolean | null | undefined)[][];
};

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN");
}

/** On-disk Sharnam logo (transparent PNG preferred). */
export function sharnamLogoPath(): string | null {
  for (const p of LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Embed Sharnam logo when available on disk (local + Render monorepo layouts). */
export function sharnamLogoDataUri(): string {
  const p = sharnamLogoPath();
  if (!p) return "";
  try {
    const ext = path.extname(p).toLowerCase() === ".png" ? "png" : "png";
    return `data:image/${ext};base64,${fs.readFileSync(p).toString("base64")}`;
  } catch {
    return "";
  }
}

/** Official Sharnam wordmark for HTML email (`apps/web/public/logo.png`). */
export function sharnamEmailLogoPath(): string | null {
  for (const p of EMAIL_LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Logo src for HTML email — embedded base64 from logo.png, then live portal URL. */
export function sharnamEmailLogoSrc(): string {
  const p = sharnamEmailLogoPath();
  if (p) {
    try {
      return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
    } catch {
      /* fall through */
    }
  }
  const origin = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
  return `${origin}/logo.png`;
}

/** Teal शरणम् wordmark — raw logo.png on paper-grey header (no white plate). */
export function sharnamEmailLogoHtml(width = 172): string {
  const src = sharnamEmailLogoSrc();
  return `<img src="${src}" alt="Sharnam · शरणम्" width="${width}" style="display:block;width:${width}px;max-width:72%;height:auto;border:0;outline:none;background:transparent;margin:0;" />`;
}

export function workbookBuffer(sheets: SheetSpec[], meta?: { title?: string; projectCode?: string }): Buffer {
  const wb = XLSX.utils.book_new();
  const cover: (string | number)[][] = [
    ["Sharnam Project Development Consultants & Co."],
    ["शरणम् · PMC Client Report"],
    [meta?.title || "Project analytics export"],
    ["Project", meta?.projectCode || "—"],
    ["Generated", new Date().toLocaleString("en-IN")],
    [],
    ["Sheets in this workbook:"],
    ...sheets.map((s, i) => [`${i + 1}. ${s.name}`]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), "Cover");
  for (const sheet of sheets) {
    const safe = sheet.name.replace(/[\\/?*[\]]/g, "-").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), safe);
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/** Stamp the SPDC / Sharnam logo on the first worksheet of an existing XLSX buffer. */
export async function stampSpdcWorkbookLogo(buffer: Buffer): Promise<Buffer> {
  const logo = sharnamLogoPath();
  if (!logo) return buffer;
  const tmpPath = path.join(
    os.tmpdir(),
    `spdc-stamp-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
  );
  try {
    fs.writeFileSync(tmpPath, buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(tmpPath);
    const ws = wb.worksheets[0];
    if (!ws) return buffer;
    const imgId = wb.addImage({ filename: logo, extension: "png" });
    ws.getRow(1).height = Math.max(Number(ws.getRow(1).height || 18), 36);
    ws.addImage(imgId, {
      tl: { col: 0.1, row: 0.05 },
      ext: { width: 118, height: 38 },
      editAs: "oneCell",
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  } catch {
    return buffer;
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

export function renderBrandedReportHtml(opts: {
  title: string;
  subtitle?: string;
  project: { code: string; name: string; clientName?: string | null; location?: string | null };
  kpis: { label: string; value: string | number }[];
  sections: { heading: string; headers: string[]; rows: (string | number)[][] }[];
}): string {
  const logo = sharnamLogoDataUri();
  const p = opts.project;
  const kpiHtml = opts.kpis
    .map(
      (k) =>
        `<div class="kpi"><div class="n">${esc(k.value)}</div><div class="l">${esc(k.label)}</div></div>`
    )
    .join("");
  const sectionsHtml = opts.sections
    .map((sec) => {
      const head = sec.headers.map((h) => `<th>${esc(h)}</th>`).join("");
      const body =
        sec.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("") || `<tr><td colspan="${sec.headers.length}">No records</td></tr>`;
      return `<section><h2>${esc(sec.heading)}</h2><div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(opts.title)} — ${esc(p.code)} · Sharnam</title>
  <style>
    @page { margin: 14mm; }
    body{font-family:"Source Sans 3","Segoe UI",Helvetica,Arial,sans-serif;color:#1a1d26;margin:0;background:#f0f2f5}
    .actions{text-align:center;padding:16px}.actions button{background:#0f766e;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer}
    .sheet{max-width:1040px;margin:0 auto 24px;background:#fff;border:1px solid #e2e5eb;box-shadow:0 12px 36px rgba(26,29,38,.08);overflow:hidden}
    .hero{background:linear-gradient(135deg,#1a1d26 0%,#243447 50%,#126e82 100%);color:#fff;padding:22px 28px;display:flex;gap:18px;align-items:center}
    .hero img{height:52px;width:auto;background:#fff;border-radius:10px;padding:6px 10px}
    .hero .eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#99f6e4;margin-bottom:6px}
    .hero h1{margin:0;font-size:22px;letter-spacing:-.02em}
    .hero .sub{opacity:.85;font-size:13px;margin-top:6px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:14px 28px;border-bottom:1px solid #e2e5eb;font-size:13px}
    .meta b{color:#5c6578;font-weight:600;display:inline-block;min-width:100px}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;padding:16px 28px;background:#f7f8fa;border-bottom:1px solid #e2e5eb}
    .kpi{border:1px solid #e2e5eb;border-radius:10px;padding:12px;background:#fff}
    .kpi .n{font-size:22px;font-weight:700;color:#0f766e}.kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5c6578;margin-top:4px}
    section{padding:18px 28px} h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#1a1d26;border-bottom:2px solid #0f766e;padding-bottom:6px;margin:0 0 12px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e2e5eb;padding:8px 10px;text-align:left;vertical-align:top}
    th{background:#f0f2f5;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5c6578}
    .foot{padding:14px 28px 22px;font-size:11px;color:#5c6578;display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e2e5eb}
    @media print{.actions{display:none} body{background:#fff}.sheet{box-shadow:none;border:0;margin:0}}
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="hero">
      ${logo ? `<img src="${logo}" alt="Sharnam"/>` : ""}
      <div>
        <div class="eyebrow">शरणम् · Sharnam PMC</div>
        <h1>${esc(opts.title)}</h1>
        <div class="sub">${esc(opts.subtitle || "Client-ready analytics pack")}</div>
      </div>
    </div>
    <div class="meta">
      <div><b>Project</b> ${esc(p.name)}</div>
      <div><b>Code</b> ${esc(p.code)}</div>
      <div><b>Client</b> ${esc(p.clientName || "—")}</div>
      <div><b>Location</b> ${esc(p.location || "—")}</div>
      <div><b>Generated</b> ${esc(new Date().toLocaleString("en-IN"))}</div>
      <div><b>PMC</b> Sharnam Project Development Consultants &amp; Co.</div>
    </div>
    <div class="kpis">${kpiHtml}</div>
    ${sectionsHtml}
    <div class="foot">
      <span>Confidential · For client coordination</span>
      <span>© ${new Date().getFullYear()} Sharnam · शरणम्</span>
    </div>
  </div>
</body>
</html>`;
}

/** Workday-style project analytics pack — KPIs + referenced detail tables */
export async function buildAnalyticsPack(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const [
    rfis,
    meetings,
    submissions,
    safety,
    drawings,
    diaries,
    milestones,
    hindrances,
    budget,
    cashflow,
    ncrs,
    cubes,
  ] = await Promise.all([
    prisma.rfi.findMany({
      where: { projectId },
      include: {
        assignedTo: { select: { fullName: true, email: true } },
        createdBy: { select: { fullName: true } },
        drawing: { select: { drawingNumber: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.meeting.findMany({
      where: { projectId },
      include: { items: true },
      orderBy: { meetingDate: "desc" },
      take: 80,
    }),
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId } },
      include: {
        assignment: { include: { template: true } },
        submittedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.safetyRecord.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" }, take: 100 }),
    prisma.drawing.findMany({
      where: { projectId },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { drawingNumber: "asc" },
      take: 300,
    }),
    prisma.dailyLog.findMany({
      where: { projectId },
      include: { manpower: true },
      orderBy: { logDate: "desc" },
      take: 30,
    }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 80 }),
    prisma.progressHindrance.findMany({ where: { projectId }, take: 80 }),
    prisma.costBudgetLine.findMany({ where: { projectId } }),
    prisma.costCashflowPeriod.findMany({ where: { projectId } }),
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { issueDate: "desc" }, take: 120 }),
    prisma.cubeTest.findMany({ where: { projectId }, orderBy: { castDate: "desc" }, take: 120 }),
  ]);

  const openRfis = rfis.filter((r) => r.status === "Open" || r.status === "Draft");
  const openSafety = safety.filter((s) => s.status === "Open");
  const published = drawings.filter((d) => d.isPublished);
  const delayed = milestones.filter((m) => (m.varianceDays || 0) > 0);
  const openHindrance = hindrances.filter((h) => h.status === "Open");
  const openNcr = ncrs.filter((n) => n.status === "Open");
  const budgeted = budget.reduce((s, b) => s + (b.budgetedAmount || 0), 0);
  const certified = budget.reduce((s, b) => s + (b.certifiedAmount || 0), 0);

  const kpis = {
    openRfis: openRfis.length,
    totalRfis: rfis.length,
    meetings: meetings.length,
    checklistFills: submissions.length,
    openSafety: openSafety.length,
    drawings: drawings.length,
    publishedDrawings: published.length,
    delayedMilestones: delayed.length,
    openHindrances: openHindrance.length,
    openNcrs: openNcr.length,
    totalNcrs: ncrs.length,
    cubeTests: cubes.length,
    budgeted,
    certified,
    diaryDays: diaries.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      location: project.location,
      status: project.status,
      pmc: "Sharnam Project Development Consultants & Co.",
    },
    kpis,
    charts: {
      rfiByStatus: countBy(rfis, (r) => r.status || "Unknown"),
      safetyByStatus: countBy(safety, (s) => s.status || "Unknown"),
      drawingPublish: [
        { label: "Published", value: published.length },
        { label: "Unpublished", value: drawings.length - published.length },
      ],
      milestoneStatus: countBy(milestones, (m) => m.status || "Unknown"),
      ncrByStatus: countBy(ncrs, (n) => n.status || "Unknown"),
    },
    rfis,
    meetings,
    submissions,
    safety,
    drawings,
    diaries,
    ncrs,
    cubes,
    milestones,
    hindrances,
    budget,
    cashflow,
  };
}

function countBy<T>(rows: T[], keyFn: (r: T) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r) || "Unknown";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

export function analyticsToSheets(pack: Awaited<ReturnType<typeof buildAnalyticsPack>>): SheetSpec[] {
  return [
    {
      name: "KPIs",
      rows: [
        ["Metric", "Value"],
        ...Object.entries(pack.kpis).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 100) / 100 : v]),
      ],
    },
    {
      name: "RFIs",
      rows: [
        ["Number", "Subject", "Status", "Kind", "Due", "Created"],
        ...pack.rfis.map((r) => [
          r.number,
          r.subject,
          r.status,
          r.rfiKind || "",
          fmtDate(r.dueDate),
          fmtDt(r.createdAt),
        ]),
      ],
    },
    {
      name: "Meetings",
      rows: [
        ["Title", "Date", "Status", "Open items"],
        ...pack.meetings.map((m) => [
          m.title,
          fmtDate(m.meetingDate),
          m.status || "",
          m.items?.filter((i) => i.resolutionStatus === "Open").length ?? 0,
        ]),
      ],
    },
    {
      name: "Checklist fills",
      rows: [
        ["Template", "Type", "Status", "Filled by", "Submitted"],
        ...pack.submissions.map((s) => [
          s.assignment?.template?.name || "",
          s.assignment?.template?.checklistType || "",
          s.status,
          s.submittedBy?.fullName || "",
          fmtDt(s.createdAt),
        ]),
      ],
    },
    {
      name: "Safety",
      rows: [
        ["Type", "Title", "Severity", "Status", "Occurred"],
        ...pack.safety.map((s) => [
          s.recordType || "",
          s.title || "",
          s.severity || "",
          s.status,
          fmtDt(s.occurredAt),
        ]),
      ],
    },
    {
      name: "Drawings",
      rows: [
        ["Number", "Title", "Discipline", "Published", "Rev"],
        ...pack.drawings.map((d) => [
          d.drawingNumber,
          d.title,
          d.discipline || "",
          d.isPublished ? "Yes" : "No",
          d.revisions?.[0]?.revisionLabel || d.currentRev || "",
        ]),
      ],
    },
    {
      name: "Milestones",
      rows: [
        ["Activity", "Status", "Planned end", "Actual end", "Variance days"],
        ...pack.milestones.map((m) => [
          m.activity,
          m.status || "",
          fmtDate(m.plannedEnd),
          fmtDate(m.actualEnd),
          m.varianceDays ?? "",
        ]),
      ],
    },
    {
      name: "Hindrances",
      rows: [
        ["Description", "Status", "Activity", "Occurred"],
        ...pack.hindrances.map((h) => [
          h.description,
          h.status,
          h.activity || "",
          fmtDt(h.occurredAt),
        ]),
      ],
    },
    {
      name: "NCR CAR",
      rows: [
        ["Number", "Type", "Status", "Location", "Issue date"],
        ...pack.ncrs.map((n) => [n.number, n.ncrType, n.status, n.location || "", fmtDate(n.issueDate)]),
      ],
    },
    {
      name: "Cube tests",
      rows: [
        ["Sr", "Cast", "Grade", "Description", "Load 7d", "Load 28d", "Result"],
        ...pack.cubes.map((c) => [
          c.srNo,
          fmtDate(c.castDate),
          c.grade || "",
          c.description || "",
          c.load7 ?? "",
          c.load28 ?? "",
          c.result || "",
        ]),
      ],
    },
  ];
}

export function analyticsToHtml(pack: Awaited<ReturnType<typeof buildAnalyticsPack>>) {
  return renderBrandedReportHtml({
    title: "Project analytics dashboard",
    subtitle: "Workday-style KPI pack with referenced live data for client sharing",
    project: pack.project,
    kpis: [
      { label: "Open RFIs", value: pack.kpis.openRfis },
      { label: "Meetings", value: pack.kpis.meetings },
      { label: "Checklist fills", value: pack.kpis.checklistFills },
      { label: "Safety open", value: pack.kpis.openSafety },
      { label: "Drawings", value: pack.kpis.drawings },
      { label: "Published GFC", value: pack.kpis.publishedDrawings },
      { label: "Delayed MS", value: pack.kpis.delayedMilestones },
      { label: "Hindrances", value: pack.kpis.openHindrances },
      { label: "Open NCR", value: pack.kpis.openNcrs },
      { label: "Cube tests", value: pack.kpis.cubeTests },
    ],
    sections: [
      {
        heading: "Open & recent RFIs",
        headers: ["Number", "Subject", "Status", "Due"],
        rows: pack.rfis.slice(0, 40).map((r) => [r.number, r.subject, r.status, fmtDate(r.dueDate)]),
      },
      {
        heading: "Meetings / MoM",
        headers: ["Title", "Date", "Open items"],
        rows: pack.meetings.slice(0, 30).map((m) => [
          m.title || "Meeting",
          fmtDate(m.meetingDate),
          String(m.items?.filter((i) => i.resolutionStatus === "Open").length ?? 0),
        ]),
      },
      {
        heading: "Checklist fills",
        headers: ["Template", "Type", "By", "Status"],
        rows: pack.submissions.slice(0, 40).map((s) => [
          s.assignment?.template?.name || "—",
          s.assignment?.template?.checklistType || "—",
          s.submittedBy?.fullName || "—",
          s.status,
        ]),
      },
      {
        heading: "Safety records",
        headers: ["Type", "Title", "Status", "When"],
        rows: pack.safety.slice(0, 30).map((s) => [
          s.recordType || "—",
          s.title || "—",
          s.status,
          fmtDt(s.occurredAt),
        ]),
      },
      {
        heading: "Drawings register (sample)",
        headers: ["Number", "Title", "Published"],
        rows: pack.drawings.slice(0, 50).map((d) => [d.drawingNumber, d.title, d.isPublished ? "Yes" : "No"]),
      },
      {
        heading: "NCR / CAR register",
        headers: ["Number", "Type", "Status", "Location", "Issue"],
        rows: pack.ncrs.slice(0, 40).map((n) => [
          n.number || "—",
          n.ncrType || "—",
          n.status,
          n.location || "—",
          fmtDate(n.issueDate),
        ]),
      },
      {
        heading: "Cube test register",
        headers: ["Sr", "Cast", "Grade", "Description", "Result"],
        rows: pack.cubes.slice(0, 40).map((c) => [
          c.srNo || "—",
          fmtDate(c.castDate),
          c.grade || "—",
          c.description || "—",
          c.result || "—",
        ]),
      },
    ],
  });
}

export type ModuleExportKey = "rfis" | "comms" | "quality" | "safety" | "drawings" | "progress" | "field" | "cost";

export async function buildModuleExport(projectId: string, module: ModuleExportKey) {
  const pack = await buildAnalyticsPack(projectId);
  const p = pack.project;

  switch (module) {
    case "rfis":
      return {
        title: "RFI register",
        sheets: [
          {
            name: "RFIs",
            rows: [
              [
                "Number",
                "Subject",
                "Question",
                "Status",
                "Kind",
                "Ball in court",
                "Assigned to",
                "Raised by",
                "Due",
                "Drawing",
                "Schedule impact",
                "Cost impact",
                "Created",
              ],
              ...pack.rfis.map((r: any) => [
                r.number,
                r.subject,
                r.question,
                r.status,
                r.rfiKind || "",
                r.ballInCourt || "",
                r.assignedTo?.fullName || "",
                r.createdBy?.fullName || "",
                fmtDate(r.dueDate),
                r.drawing ? `${r.drawing.drawingNumber} — ${r.drawing.title}` : "",
                r.scheduleImpact || "",
                r.costImpact || "",
                fmtDt(r.createdAt),
              ]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "RFI register",
          subtitle: "SPDC RFI form columns — linked drawing, assignee, impacts",
          project: p,
          kpis: [
            { label: "Total", value: pack.kpis.totalRfis },
            { label: "Open", value: pack.kpis.openRfis },
          ],
          sections: [
            {
              heading: "RFIs",
              headers: ["Number", "Subject", "Status", "Kind", "Assigned", "Due", "Drawing"],
              rows: pack.rfis.map((r: any) => [
                r.number,
                r.subject,
                r.status,
                r.rfiKind || "",
                r.assignedTo?.fullName || "—",
                fmtDate(r.dueDate),
                r.drawing?.drawingNumber || "—",
              ]),
            },
          ],
        }),
      };
    case "comms":
      return {
        title: "Communications pack",
        sheets: [
          {
            name: "Meetings",
            rows: [
              ["Title", "Date", "Status", "Open items"],
              ...pack.meetings.map((m) => [
                m.title,
                fmtDate(m.meetingDate),
                m.status || "",
                m.items?.filter((i) => i.resolutionStatus === "Open").length ?? 0,
              ]),
            ],
          },
          {
            name: "Action items",
            rows: [
              ["Meeting", "Item", "Status", "Priority"],
              ...pack.meetings.flatMap((m) =>
                (m.items || []).map((i) => [m.title, i.description, i.resolutionStatus, i.priority || ""])
              ),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Communications pack",
          subtitle: "Meetings, MoM, and open actions",
          project: p,
          kpis: [{ label: "Meetings", value: pack.kpis.meetings }],
          sections: [
            {
              heading: "Meetings",
              headers: ["Title", "Date", "Open items"],
              rows: pack.meetings.map((m) => [
                m.title || "—",
                fmtDate(m.meetingDate),
                String(m.items?.filter((i) => i.resolutionStatus === "Open").length ?? 0),
              ]),
            },
          ],
        }),
      };
    case "quality": {
      const [ncrs, cubes] = await Promise.all([
        prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { issueDate: "desc" }, take: 120 }),
        prisma.cubeTest.findMany({ where: { projectId }, orderBy: { castDate: "desc" }, take: 120 }),
      ]);
      const openNcr = ncrs.filter((n) => n.status === "Open").length;
      return {
        title: "Quality — NCR / CAR / cubes / checklists",
        sheets: [
          {
            name: "NCR CAR",
            rows: [
              ["Number", "Type", "Status", "Location", "Issue date"],
              ...ncrs.map((n) => [n.number, n.ncrType, n.status, n.location || "", fmtDate(n.issueDate)]),
            ],
          },
          {
            name: "Cube tests",
            rows: [
              ["Sr", "Cast date", "Grade", "Description", "Load 7d", "Load 28d", "Result"],
              ...cubes.map((c) => [
                c.srNo,
                fmtDate(c.castDate),
                c.grade || "",
                c.description || "",
                c.load7 ?? "",
                c.load28 ?? "",
                c.result || "",
              ]),
            ],
          },
          {
            name: "Fills",
            rows: [
              ["Template", "Type", "Status", "By", "Submitted"],
              ...pack.submissions.map((s) => [
                s.assignment?.template?.name || "",
                s.assignment?.template?.checklistType || "",
                s.status,
                s.submittedBy?.fullName || "",
                fmtDt(s.createdAt),
              ]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Quality pack — NCR · CAR · cubes · checklists",
          subtitle: "Weekly / monthly QA registers for client coordination",
          project: p,
          kpis: [
            { label: "NCR/CAR", value: ncrs.length },
            { label: "Open NCR", value: openNcr },
            { label: "Cube tests", value: cubes.length },
            { label: "Checklist fills", value: pack.kpis.checklistFills },
          ],
          sections: [
            {
              heading: "NCR / CAR register",
              headers: ["Number", "Type", "Status", "Location", "Issue"],
              rows: ncrs.slice(0, 80).map((n) => [
                n.number || "—",
                n.ncrType || "—",
                n.status,
                n.location || "—",
                fmtDate(n.issueDate),
              ]),
            },
            {
              heading: "Cube test register",
              headers: ["Sr", "Cast", "Grade", "Description", "7d", "28d", "Result"],
              rows: cubes.slice(0, 80).map((c) => [
                c.srNo || "—",
                fmtDate(c.castDate),
                c.grade || "—",
                c.description || "—",
                c.load7 ?? "—",
                c.load28 ?? "—",
                c.result || "—",
              ]),
            },
            {
              heading: "Checklist submissions",
              headers: ["Template", "Type", "By", "Status", "When"],
              rows: pack.submissions.slice(0, 60).map((s) => [
                s.assignment?.template?.name || "—",
                s.assignment?.template?.checklistType || "—",
                s.submittedBy?.fullName || "—",
                s.status,
                fmtDt(s.createdAt),
              ]),
            },
          ],
        }),
      };
    }
    case "safety":
      return {
        title: "Safety dashboard",
        sheets: [
          {
            name: "Safety",
            rows: [
              ["Type", "Title", "Severity", "Status", "Occurred"],
              ...pack.safety.map((s) => [
                s.recordType || "",
                s.title || "",
                s.severity || "",
                s.status,
                fmtDt(s.occurredAt),
              ]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Safety dashboard report",
          subtitle: "Open and historical safety records",
          project: p,
          kpis: [
            { label: "Records", value: pack.safety.length },
            { label: "Open", value: pack.kpis.openSafety },
          ],
          sections: [
            {
              heading: "Safety records",
              headers: ["Type", "Title", "Severity", "Status"],
              rows: pack.safety.map((s) => [
                s.recordType || "—",
                s.title || "—",
                s.severity || "—",
                s.status,
              ]),
            },
          ],
        }),
      };
    case "drawings":
      return {
        title: "GFC drawings register",
        sheets: [
          {
            name: "Drawings",
            rows: [
              ["Number", "Title", "Discipline", "Published", "Revision"],
              ...pack.drawings.map((d) => [
                d.drawingNumber,
                d.title,
                d.discipline || "",
                d.isPublished ? "Yes" : "No",
                d.revisions?.[0]?.revisionLabel || d.currentRev || "",
              ]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "GFC drawings register",
          subtitle: "Published and working drawings for client review",
          project: p,
          kpis: [
            { label: "Total", value: pack.kpis.drawings },
            { label: "Published", value: pack.kpis.publishedDrawings },
          ],
          sections: [
            {
              heading: "Register",
              headers: ["Number", "Title", "Discipline", "Published"],
              rows: pack.drawings.map((d) => [
                d.drawingNumber,
                d.title,
                d.discipline || "—",
                d.isPublished ? "Yes" : "No",
              ]),
            },
          ],
        }),
      };
    case "progress":
      return {
        title: "Progress analytics",
        sheets: [
          {
            name: "Milestones",
            rows: [
              ["Activity", "Status", "Planned end", "Actual end", "Variance"],
              ...pack.milestones.map((m) => [
                m.activity,
                m.status || "",
                fmtDate(m.plannedEnd),
                fmtDate(m.actualEnd),
                m.varianceDays ?? "",
              ]),
            ],
          },
          {
            name: "Hindrances",
            rows: [
              ["Description", "Status", "Occurred"],
              ...pack.hindrances.map((h) => [h.description, h.status, fmtDt(h.occurredAt)]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Progress analytics",
          subtitle: "Milestones and hindrances for client status packs",
          project: p,
          kpis: [
            { label: "Milestones", value: pack.milestones.length },
            { label: "Delayed", value: pack.kpis.delayedMilestones },
            { label: "Open hindrances", value: pack.kpis.openHindrances },
          ],
          sections: [
            {
              heading: "Milestones",
              headers: ["Activity", "Status", "Planned end", "Variance"],
              rows: pack.milestones.map((m) => [
                m.activity,
                m.status || "—",
                fmtDate(m.plannedEnd),
                String(m.varianceDays ?? "—"),
              ]),
            },
            {
              heading: "Hindrances",
              headers: ["Description", "Status", "When"],
              rows: pack.hindrances.map((h) => [h.description, h.status, fmtDt(h.occurredAt)]),
            },
          ],
        }),
      };
    case "field":
      return {
        title: "Field / day log summary",
        sheets: [
          {
            name: "Day logs",
            rows: [
              ["Date", "Status", "Weather", "Manpower"],
              ...pack.diaries.map((d) => [
                fmtDate(d.logDate),
                d.status || "",
                d.weatherCondition || "",
                d.manpower?.reduce((s, m) => s + (m.workerCount || 0), 0) ?? 0,
              ]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Field day-log summary",
          subtitle: "Recent site diaries for client packs",
          project: p,
          kpis: [{ label: "Diary days", value: pack.kpis.diaryDays }],
          sections: [
            {
              heading: "Day logs",
              headers: ["Date", "Status", "Weather", "Manpower"],
              rows: pack.diaries.map((d) => [
                fmtDate(d.logDate),
                d.status || "—",
                d.weatherCondition || "—",
                String(d.manpower?.reduce((s, m) => s + (m.workerCount || 0), 0) ?? 0),
              ]),
            },
          ],
        }),
      };
    case "cost":
      return {
        title: "Cost dashboard",
        sheets: [
          {
            name: "Budget",
            rows: [
              ["Item", "Budgeted", "Certified"],
              ...pack.budget.map((b) => [b.description || b.srNo || b.id, b.budgetedAmount, b.certifiedAmount]),
            ],
          },
          {
            name: "Cashflow",
            rows: [
              ["Period", "Package", "Planned", "Actual"],
              ...pack.cashflow.map((c) => [c.periodLabel, c.packageName, c.plannedAmount, c.actualAmount]),
            ],
          },
        ] as SheetSpec[],
        html: renderBrandedReportHtml({
          title: "Cost dashboard",
          subtitle: "Budget and cashflow snapshot for client finance packs",
          project: p,
          kpis: [
            { label: "Budgeted", value: Math.round(pack.kpis.budgeted) },
            { label: "Certified", value: Math.round(pack.kpis.certified) },
          ],
          sections: [
            {
              heading: "Budget lines (sample)",
              headers: ["Item", "Budgeted", "Certified"],
              rows: pack.budget.slice(0, 60).map((b) => [
                b.description || b.srNo || "—",
                String(b.budgetedAmount ?? ""),
                String(b.certifiedAmount ?? ""),
              ]),
            },
          ],
        }),
      };
    default:
      throw new Error("Unknown module");
  }
}

/** Flatten DPR pack into Excel sheets */
export function dprToSheets(pack: any): SheetSpec[] {
  return [
    {
      name: "KPIs",
      rows: [["Metric", "Value"], ...Object.entries(pack.kpis || {}).map(([k, v]) => [k, v as any])],
    },
    {
      name: "Manpower",
      rows: [
        ["Company", "Workers", "Hours", "Comments"],
        ...(pack.diary?.manpower || []).map((m: any) => [m.companyName, m.workerCount, m.hoursWorked, m.comments]),
      ],
    },
    {
      name: "RFIs",
      rows: [
        ["Number", "Subject", "Status", "Due"],
        ...(pack.rfis || []).map((r: any) => [r.number, r.subject, r.status, fmtDate(r.dueDate)]),
      ],
    },
    {
      name: "Safety",
      rows: [
        ["Type", "Status", "Description"],
        ...(pack.safety || []).map((s: any) => [s.recordType, s.status, s.description]),
      ],
    },
    {
      name: "Checklists",
      rows: [
        ["Type", "Name", "By", "Status"],
        ...(pack.submissions || []).map((s: any) => [
          s.assignment?.template?.checklistType,
          s.assignment?.template?.name,
          s.submittedBy?.fullName,
          s.status,
        ]),
      ],
    },
  ];
}

export function wprToSheets(pack: any): SheetSpec[] {
  return [
    {
      name: "KPIs",
      rows: [["Metric", "Value"], ...Object.entries(pack.kpis || {}).map(([k, v]) => [k, v as any])],
    },
    {
      name: "Diaries",
      rows: [
        ["Date", "Status", "Manpower"],
        ...(pack.diaries || []).map((d: any) => [
          fmtDate(d.logDate),
          d.status,
          (d.manpower || []).reduce((s: number, m: any) => s + (m.workerCount || 0), 0),
        ]),
      ],
    },
    {
      name: "Meetings",
      rows: [
        ["Title", "Date", "Items"],
        ...(pack.meetings || []).map((m: any) => [m.title, fmtDate(m.meetingDate), (m.items || []).length]),
      ],
    },
    {
      name: "RFIs",
      rows: [
        ["Number", "Subject", "Status"],
        ...(pack.rfis || []).map((r: any) => [r.number, r.subject, r.status]),
      ],
    },
    {
      name: "Drawings",
      rows: [
        ["Number", "Title", "Published"],
        ...(pack.drawings || []).map((d: any) => [d.drawingNumber, d.title, d.isPublished ? "Yes" : "No"]),
      ],
    },
  ];
}

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { prisma } from "../prisma.js";
import { SPDC_OFFICE_FOOTER, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoPath } from "./brandedExport.js";

const HEADER_FILL = "FF1E3A5F";
const SLATE = "FF445469";
const THIN = { style: "thin" as const, color: { argb: SLATE } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function day(value: Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isoWeekLabel() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `Week ${week}`;
}

export type RegisterPivotBundle = {
  project: { id: string; code: string; name: string; clientName?: string | null };
  weekLabel: string;
  lines: Awaited<ReturnType<typeof loadRegisterLines>>;
  pivots: {
    byBuildingDiscipline: { building: string; discipline: string; count: number }[];
    byDiscipline: { label: string; value: number }[];
    byCritical: { label: string; value: number }[];
    delayByResponsibility: { label: string; days: number }[];
    byConsultant: { label: string; value: number }[];
    byPackage: { label: string; value: number }[];
    byBuilding: { label: string; value: number }[];
    byDrawingType: { label: string; value: number }[];
    byFileLink: { label: string; value: number }[];
  };
  totals: {
    lines: number;
    gfc: number;
    critical: number;
    linkedGfc: number;
    delayed: number;
  };
};

function realFile(url?: string | null) {
  return !!url && !/\/pending\//i.test(url);
}

async function fileLinkCounts(projectId: string) {
  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    include: { revisions: { select: { pdfFileUrl: true, dwgFileUrl: true, fileUrl: true, fileName: true } } },
  });
  let pdf = 0;
  let dwg = 0;
  let both = 0;
  let datesOnly = 0;
  for (const d of drawings) {
    const hasPdf = d.revisions.some(
      (r) => realFile(r.pdfFileUrl) || (realFile(r.fileUrl) && /\.pdf/i.test(r.fileName || r.fileUrl || "")),
    );
    const hasDwg = d.revisions.some(
      (r) => realFile(r.dwgFileUrl) || (realFile(r.fileUrl) && /\.dwg/i.test(r.fileName || r.fileUrl || "")),
    );
    if (hasPdf && hasDwg) both += 1;
    else if (hasPdf) pdf += 1;
    else if (hasDwg) dwg += 1;
    else datesOnly += 1;
  }
  return [
    { label: "PDF + DWG", value: both },
    { label: "PDF only", value: pdf },
    { label: "DWG only", value: dwg },
    { label: "Dates only", value: datesOnly },
  ].filter((r) => r.value > 0);
}

async function loadRegisterLines(projectId: string) {
  return prisma.drawingRegisterLine.findMany({
    where: { projectId },
    orderBy: [{ srNo: "asc" }, { drawingNumber: "asc" }],
    include: { drawing: { select: { id: true, isPublished: true, currentRev: true } } },
  });
}

export async function loadRegisterPivotBundle(projectId: string): Promise<RegisterPivotBundle> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, name: true, clientName: true },
  });
  if (!project) throw new Error("Project not found");

  const lines = await loadRegisterLines(projectId);
  const groupCount = (pick: (l: (typeof lines)[number]) => string) =>
    Object.entries(
      lines.reduce((acc: Record<string, number>, line) => {
        const label = pick(line) || "Other";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {}),
    ).map(([label, value]) => ({ label, value }));

  const byBuildingDiscipline: { building: string; discipline: string; count: number }[] = [];
  const buildingMap = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const building = (line.building || "—").trim() || "—";
    const discipline = (line.discipline || "Other").trim() || "Other";
    const row = buildingMap.get(building) || new Map<string, number>();
    row.set(discipline, (row.get(discipline) || 0) + 1);
    buildingMap.set(building, row);
  }
  for (const [building, discs] of buildingMap) {
    for (const [discipline, count] of discs) byBuildingDiscipline.push({ building, discipline, count });
  }

  const delayByResponsibility = Object.entries(
    lines.reduce((acc: Record<string, number>, line) => {
      const label = (line.delayResponsibility || "").trim();
      if (!label) return acc;
      acc[label] = (acc[label] || 0) + (line.submissionDelayDays ?? 0);
      return acc;
    }, {}),
  ).map(([label, days]) => ({ label, days }));

  return {
    project,
    weekLabel: isoWeekLabel(),
    lines,
    pivots: {
      byBuildingDiscipline,
      byDiscipline: groupCount((l) => l.discipline || "Other"),
      byCritical: groupCount((l) => (/yes/i.test(l.criticalDrawing || "") ? "Yes" : "No")),
      delayByResponsibility,
      byConsultant: groupCount((l) => (l.consultantName || "").trim() || "—").filter((r) => r.label !== "—"),
      byPackage: groupCount((l) => (l.projectPackage || "").trim() || "—").filter((r) => r.label !== "—"),
      byBuilding: groupCount((l) => (l.building || "").trim() || "—").filter((r) => r.label !== "—"),
      byDrawingType: groupCount((l) => l.drawingType || "Other"),
      byFileLink: await fileLinkCounts(projectId),
    },
    totals: {
      lines: lines.length,
      gfc: lines.filter((l) => /gfc|good for construction/i.test(l.drawingType || "")).length,
      critical: lines.filter((l) => /yes/i.test(l.criticalDrawing || "")).length,
      linkedGfc: lines.filter((l) => l.drawingId).length,
      delayed: lines.filter((l) => (l.submissionDelayDays ?? 0) > 0).length,
    },
  };
}

function stampWorkbookBrand(sheet: ExcelJS.Worksheet, title: string, projectName: string, lastCol = 8) {
  const logo = sharnamLogoPath();
  sheet.getRow(1).height = 36;
  if (logo) {
    try {
      const imgId = sheet.workbook.addImage({ filename: logo, extension: "png" });
      sheet.addImage(imgId, { tl: { col: 0.15, row: 0.08 }, ext: { width: 120, height: 36 }, editAs: "oneCell" });
    } catch {
      /* logo optional */
    }
  }
  sheet.mergeCells(1, 2, 1, Math.max(lastCol, 2));
  const titleCell = sheet.getCell(1, 2);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  titleCell.alignment = { vertical: "middle", wrapText: true };
  sheet.mergeCells(2, 2, 2, Math.max(lastCol, 2));
  const pmc = sheet.getCell(2, 2);
  pmc.value = `PROJECT MANAGEMENT CONSULTANTS : ${SPDC_PMC_NAME}`;
  pmc.font = { size: 10, color: { argb: HEADER_FILL } };
  sheet.getCell(4, 2).value = projectName;
  sheet.getCell(4, 2).font = { size: 10, color: { argb: SLATE } };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.border = BOX;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 22;
}

function writePivotBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  sheet.getCell(startRow, 1).value = title;
  sheet.getCell(startRow, 1).font = { bold: true, size: 11, color: { argb: SLATE } };
  const h = sheet.getRow(startRow + 1);
  headers.forEach((text, i) => {
    h.getCell(i + 1).value = text;
  });
  styleHeaderRow(h);
  rows.forEach((cells, ri) => {
    const row = sheet.getRow(startRow + 2 + ri);
    cells.forEach((c, ci) => {
      row.getCell(ci + 1).value = c;
      row.getCell(ci + 1).border = BOX;
    });
  });
  return startRow + 2 + rows.length + 2;
}

function revNumIndex(revisionNumber?: string | null) {
  const n = parseInt(String(revisionNumber || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : -1;
}

function revisionForSlot(
  revisions: { revisionNumber: string; createdAt: Date; actualDate?: Date | null; plannedDate?: Date | null }[],
  slot: number,
) {
  const matches = revisions.filter((r) => revNumIndex(r.revisionNumber) === slot);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function revDateValue(rev?: { actualDate?: Date | null; plannedDate?: Date | null; createdAt: Date } | null) {
  if (!rev) return null;
  const d = rev.actualDate || rev.plannedDate || rev.createdAt;
  return d ? new Date(d) : null;
}

/** DRAWING REGISTER - 01.xlsx — Dashboard + Master Drawing Register sheets. */
export async function buildDrawingRegisterWorkbookXlsx(projectId: string): Promise<Buffer> {
  const bundle = await loadRegisterPivotBundle(projectId);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Portal";
  wb.created = new Date();

  const dash = wb.addWorksheet("Dashboard", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });
  dash.getColumn(1).width = 22;
  dash.getColumn(2).width = 18;
  dash.getColumn(3).width = 18;
  dash.getColumn(4).width = 14;

  stampWorkbookBrand(dash, `Drawing Register Dashboard — ${bundle.weekLabel}`, bundle.project.name);

  const kpis = [
    ["Total drawings", bundle.totals.lines],
    ["GFC type", bundle.totals.gfc],
    ["Critical", bundle.totals.critical],
    ["Linked to GFC upload", bundle.totals.linkedGfc],
    ["Delayed submissions", bundle.totals.delayed],
  ];
  let r = 6;
  kpis.forEach(([label, val]) => {
    dash.getCell(r, 2).value = label;
    dash.getCell(r, 2).font = { size: 10, color: { argb: "FF64748B" } };
    dash.getCell(r, 3).value = val;
    dash.getCell(r, 3).font = { bold: true, size: 16, color: { argb: HEADER_FILL } };
    r++;
  });

  let blockRow = 14;
  blockRow = writePivotBlock(
    dash,
    blockRow,
    "Building × discipline",
    ["Building", "Discipline", "Count"],
    bundle.pivots.byBuildingDiscipline.map((x) => [x.building, x.discipline, x.count]),
  );
  blockRow = writePivotBlock(
    dash,
    blockRow,
    "Discipline",
    ["Discipline", "Count"],
    bundle.pivots.byDiscipline.map((x) => [x.label, x.value]),
  );
  blockRow = writePivotBlock(
    dash,
    blockRow,
    "Critical drawing",
    ["Critical", "Count"],
    bundle.pivots.byCritical.map((x) => [x.label, x.value]),
  );
  blockRow = writePivotBlock(
    dash,
    blockRow,
    "Delay responsibility",
    ["Responsibility", "Sum delay (days)"],
    bundle.pivots.delayByResponsibility.map((x) => [x.label, x.days]),
  );
  writePivotBlock(
    dash,
    blockRow,
    "Consultant",
    ["Consultant", "Count"],
    bundle.pivots.byConsultant.map((x) => [x.label, x.value]),
  );

  const issues = await prisma.designCoordinationIssue.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const issueSheet = wb.addWorksheet("Drawing issues");
  stampWorkbookBrand(issueSheet, "Design coordination issues", bundle.project.name);
  const issueHeaders = ["Issue", "Drawing type", "Status", "Assignee", "Follow-ups", "Last follow-up", "RFI", "Opened"];
  issueHeaders.forEach((h, i) => {
    issueSheet.getCell(5, i + 1).value = h;
  });
  styleHeaderRow(issueSheet.getRow(5));
  issues.forEach((issue, idx) => {
    const row = issueSheet.getRow(6 + idx);
    const cells = [
      issue.title,
      issue.discipline || "",
      issue.status,
      issue.assignedToName || issue.assignedToEmail || "",
      `${issue.followUpCount}/5`,
      issue.lastFollowUpAt ? day(issue.lastFollowUpAt) : "",
      issue.escalatedRfiId ? "Yes" : "",
      day(issue.createdAt),
    ];
    cells.forEach((v, ci) => {
      row.getCell(ci + 1).value = v;
      row.getCell(ci + 1).border = BOX;
    });
  });

  const master = wb.addWorksheet("Master Drawing Register", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  stampWorkbookBrand(master, "Master Drawing Register", bundle.project.name);
  const masterHeaders = [
    "Sr #",
    "Project Package",
    "Building",
    "Discipline",
    "Drawing Number",
    "Drawing Title",
    "Drawing Type",
    "Consultant Name",
    "Revision Number",
    "Revision Date",
    "Revision Description",
    "Latest Revision",
    "Planned Submission Date",
    "Actual Submission Date",
    "Submission Delay (Days)",
    "Delay Responsibility",
    "Issued To",
    "Issue Date",
    "Copies Count",
    "Critical Drawing",
    "Remarks",
  ];
  masterHeaders.forEach((h, i) => {
    master.getCell(5, i + 1).value = h;
  });
  styleHeaderRow(master.getRow(5));
  bundle.lines.forEach((line, idx) => {
    const row = master.getRow(6 + idx);
    const cells = [
      line.srNo ?? "",
      line.projectPackage ?? "",
      line.building ?? "",
      line.discipline ?? "",
      line.drawingNumber,
      line.drawingTitle,
      line.drawingType ?? "",
      line.consultantName ?? "",
      line.revisionNumber ?? "",
      day(line.revisionDate),
      line.revisionDescription ?? "",
      line.latestRevision ?? "",
      day(line.plannedSubmissionDate),
      day(line.actualSubmissionDate),
      line.submissionDelayDays ?? "",
      line.delayResponsibility ?? "",
      line.issuedTo ?? "",
      day(line.issueDate),
      line.copiesCount ?? "",
      line.criticalDrawing ?? "",
      line.remarks ?? "",
    ];
    cells.forEach((v, ci) => {
      row.getCell(ci + 1).value = v;
      row.getCell(ci + 1).border = BOX;
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Approval & GFC Drawing Log.xlsx — GFC sheet layout. */
export async function buildApprovalGfcLogXlsx(projectId: string): Promise<Buffer> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { code: true, name: true, location: true },
  });
  if (!project) throw new Error("Project not found");

  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    include: { revisions: { orderBy: { createdAt: "asc" } } },
    orderBy: { drawingNumber: "asc" },
  });
  const maxSlot = drawings.reduce(
    (max, d) => Math.max(max, ...d.revisions.map((r) => revNumIndex(r.revisionNumber)), 5),
    5,
  );
  const slotCount = Math.min(Math.max(maxSlot + 1, 6), 8);

  const wb = new ExcelJS.Workbook();
  wb.creator = SPDC_PMC_NAME;
  const sheet = wb.addWorksheet("GFC", { views: [{ state: "frozen", ySplit: 3 }] });
  const lastCol = 6 + slotCount + 1 + slotCount;
  stampWorkbookBrand(
    sheet,
    `${(project.location || project.name).toUpperCase()} : DRAWING REGISTER`,
    project.name,
    lastCol,
  );

  const headers = [
    "DISCIPLINE",
    "BUILDING/AREA",
    "TL  No",
    "DWG. NO.",
    "TITLE",
    "Drawing Browse (From One Drive ) ",
    ...Array.from({ length: slotCount }, (_, i) => `R${i}`),
    "TOTAL",
    ...Array.from({ length: slotCount }, (_, i) => `R${i}`),
  ];
  headers.forEach((h, i) => {
    sheet.getCell(3, i + 1).value = h;
  });
  styleHeaderRow(sheet.getRow(3));

  drawings.forEach((d, idx) => {
    const row = sheet.getRow(4 + idx);
    const latest =
      d.revisions.find((r) => r.revisionNumber === d.currentRev) || d.revisions[d.revisions.length - 1];
    row.getCell(1).value = d.discipline;
    row.getCell(2).value = d.buildingArea || "";
    row.getCell(3).value = d.tlNo || "";
    row.getCell(4).value = d.drawingNumber;
    row.getCell(5).value = d.title;
    row.getCell(6).value = latest?.pdfFileUrl || latest?.dwgFileUrl || latest?.fileUrl || "";
    let total = 0;
    for (let slot = 0; slot < slotCount; slot++) {
      const rev = revisionForSlot(d.revisions, slot);
      const dt = revDateValue(rev);
      const dateCell = row.getCell(7 + slot);
      const flagCell = row.getCell(8 + slotCount + slot);
      if (dt) {
        dateCell.value = dt;
        dateCell.numFmt = "dd-mmm-yy";
        flagCell.value = 1;
        total += 1;
      } else {
        flagCell.value = 0;
      }
    }
    row.getCell(7 + slotCount).value = total;
    if (idx % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= lastCol) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F0E6" } };
        }
      });
    }
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= lastCol) cell.border = BOX;
    });
  });
  const foot = sheet.getRow(5 + drawings.length);
  foot.getCell(1).value = `PROJECT MANAGEMENT CONSULTANTS : ${SPDC_PMC_NAME} · ${SPDC_OFFICE_FOOTER}`;
  foot.getCell(1).font = { italic: true, size: 9, color: { argb: SLATE } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function drawBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  title: string,
  points: { label: string; value: number }[],
) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a5f").text(title, x, y, { width: w });
  y += 16;
  const max = Math.max(1, ...points.map((p) => p.value));
  const barH = 14;
  const gap = 6;
  for (const p of points.slice(0, 8)) {
    const bw = (p.value / max) * (w - 120);
    doc.font("Helvetica").fontSize(8).fillColor("#334155").text(p.label.slice(0, 28), x, y + 2, { width: 100 });
    doc.rect(x + 105, y, Math.max(bw, 2), barH).fill("#445469");
    doc.fillColor("#0f172a").text(String(p.value), x + 110 + bw, y + 2);
    y += barH + gap;
  }
  return y + 8;
}

/** Dashboard PDF for SharePoint — KPIs + bar charts (discipline / critical). */
export async function buildDrawingRegisterDashboardPdf(projectId: string): Promise<Buffer> {
  const bundle = await loadRegisterPivotBundle(projectId);
  const logo = sharnamLogoPath();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (logo) {
      try {
        doc.image(logo, 36, 28, { fit: [90, 50] });
      } catch {
        /* optional */
      }
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#1e3a5f")
      .text(`Drawing Register Dashboard — ${bundle.weekLabel}`, 140, 36);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text(`${bundle.project.name} · ${SPDC_PMC_NAME}`, 140, 58);

    let x = 36;
    let y = 96;
    const cardW = 130;
    for (const [label, val] of [
      ["Total drawings", bundle.totals.lines],
      ["GFC type", bundle.totals.gfc],
      ["Critical", bundle.totals.critical],
      ["Linked GFC", bundle.totals.linkedGfc],
      ["Delayed", bundle.totals.delayed],
    ] as const) {
      doc.roundedRect(x, y, cardW, 52, 4).stroke("#cbd5e1");
      doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(label, x + 8, y + 10, { width: cardW - 16 });
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#1e3a5f").text(String(val), x + 8, y + 26);
      x += cardW + 12;
    }

    y = 168;
    drawBarChart(doc, 36, y, 360, "Total drawings submitted", bundle.pivots.byDiscipline);
    drawBarChart(doc, 420, y, 360, "Total critical drawings", bundle.pivots.byCritical);
    y = 360;
    drawBarChart(
      doc,
      36,
      y,
      360,
      "Submission delay in days",
      bundle.pivots.delayByResponsibility.map((p) => ({ label: p.label, value: p.days })),
    );
    drawBarChart(doc, 420, y, 360, "Drawings submitted by org", bundle.pivots.byConsultant);

    doc.end();
  });
}

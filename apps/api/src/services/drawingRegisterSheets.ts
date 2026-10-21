/**
 * Parse DRAWING REGISTER - 01.xlsx for dashboard KPIs.
 */
import path from "path";
import XLSX from "../lib/xlsx.js";
import { findWorkbook } from "../lib/excelRoot.js";
import { prisma } from "../prisma.js";
import { delayDays } from "@sharnam/shared";
import { packageNotAllowed, projectPackageNames } from "./workPackageCatalog.js";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function resolveDrawingRegisterPath(): string | null {
  return findWorkbook(["DRAWING REGISTER - 03.xlsx", "DRAWING REGISTER - 01.xlsx"]);
}

export type DrawingRegisterDashboard = {
  weekLabel: string;
  totalDrawings: number;
  gfcCount: number;
  criticalCount: number;
  delayedCount: number;
  source: string;
};

export function loadDrawingRegisterDashboard(): DrawingRegisterDashboard | null {
  const file = resolveDrawingRegisterPath();
  if (!file) return null;
  const wb = XLSX.readFile(file);
  const master = wb.SheetNames.find((n) => /Master Drawing Register/i.test(n));
  if (!master) return null;
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[master], {
    header: 1,
    defval: "",
  }) as unknown[][];
  let weekLabel = "Week #";
  for (const r of rows.slice(0, 10)) {
    const label = String(r[1] ?? r[0] ?? "");
    const m = label.match(/Week\s*#?\s*(\d+)/i);
    if (m) weekLabel = `Week ${m[1]}`;
  }
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim() === "Sr #");
  let totalDrawings = 0;
  let gfcCount = 0;
  let criticalCount = 0;
  let delayedCount = 0;
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const sn = n(r[0]);
    const num = String(r[4] ?? "").trim();
    if (!sn || !num) continue;
    totalDrawings++;
    if (/gfc|good for construction/i.test(String(r[6] ?? ""))) gfcCount++;
    if (/yes/i.test(String(r[19] ?? ""))) criticalCount++;
    if (n(r[14]) > 0) delayedCount++;
  }
  return {
    weekLabel,
    totalDrawings,
    gfcCount,
    criticalCount,
    delayedCount,
    source: path.basename(file),
  };
}

/** Upsert master drawing register rows onto the project (GFC gate + WPR DCI). */
export async function syncDrawingRegisterToProject(
  projectId: string,
  uploadedById: string
): Promise<{ drawings: number; lines: number; source: string | null }> {
  const file = resolveDrawingRegisterPath();
  if (!file) return { drawings: 0, lines: 0, source: null };
  const wb = XLSX.readFile(file);
  const master = wb.SheetNames.find((n) => /Master Drawing Register/i.test(n));
  if (!master) return { drawings: 0, lines: 0, source: path.basename(file) };
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[master], {
    header: 1,
    defval: "",
  }) as unknown[][];
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim() === "Sr #");
  let drawings = 0;
  let lines = 0;
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const drawingNumber = String(r[4] ?? "").trim();
    const title = String(r[5] ?? "").trim();
    if (!drawingNumber || !title) continue;
    const discipline = String(r[3] ?? "Architecture").trim() || "Architecture";
    const rev = String(r[8] ?? "R0").trim() || "R0";
    const gfc = /gfc|good for construction/i.test(String(r[6] ?? ""));
    const drawing = await prisma.drawing.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        drawingNumber,
        title,
        discipline,
        buildingArea: String(r[2] ?? "").trim() || null,
        currentRev: rev,
        status: gfc ? "Approved" : "Draft",
        isPublished: gfc,
        folderPath: `Drawings/${discipline}`,
        revisions: {
          create: {
            revisionNumber: rev,
            revisionLabel: `${rev} — ${String(r[6] ?? "Issue")}`,
            fileUrl: `/uploads/onedrive/pending/${drawingNumber}-${rev}.pdf`,
            fileName: `${drawingNumber}-${rev}.pdf`,
            published: gfc,
            uploadedById,
          },
        },
      },
      update: {
        title,
        discipline,
        buildingArea: String(r[2] ?? "").trim() || null,
        currentRev: rev,
        status: gfc ? "Approved" : "Draft",
        isPublished: gfc,
      },
    });
    drawings += 1;
    await prisma.drawingRegisterLine.upsert({
      where: { drawingId: drawing.id },
      create: {
        projectId,
        drawingId: drawing.id,
        srNo: n(r[0]) || drawings,
        projectPackage: String(r[1] ?? "").trim() || null,
        building: String(r[2] ?? "").trim() || null,
        discipline,
        drawingNumber,
        drawingTitle: title,
        drawingType: String(r[6] ?? "").trim() || null,
        consultantName: String(r[7] ?? "").trim() || null,
        revisionNumber: rev,
        latestRevision: String(r[11] ?? "Yes").trim() || "Yes",
        source: path.basename(file),
      },
      update: {
        drawingTitle: title,
        discipline,
        revisionNumber: rev,
        drawingType: String(r[6] ?? "").trim() || null,
        consultantName: String(r[7] ?? "").trim() || null,
        source: path.basename(file),
      },
    });
    lines += 1;
  }
  return { drawings, lines, source: path.basename(file) };
}

function excelSerial(v: unknown): Date | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 30000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
}

/** Publish Arvind dormitory DCI rows so the drawing gate + WPR register match the June 2026 cut. */
export async function syncDciArvindDrawings(
  projectId: string,
  uploadedById: string
): Promise<{ drawings: number; lines: number; source: string | null }> {
  const file = findWorkbook(["DCI_ARVIND LIMITED_17-6-2026.xlsx", "DCI-Drawing-Register-Template.xlsx"]);
  if (!file) return { drawings: 0, lines: 0, source: null };
  const wb = XLSX.readFile(file);
  const name = wb.SheetNames.find((n) => /DCI/i.test(n)) || wb.SheetNames[0];
  if (!name || !wb.Sheets[name]) return { drawings: 0, lines: 0, source: path.basename(file) };
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[name], {
    header: 1,
    defval: "",
  }) as unknown[][];

  let discipline = "Architecture";
  let drawings = 0;
  let lines = 0;
  for (const r of rows) {
    const col0 = String(r[0] ?? "").trim();
    const drawingNumber = String(r[2] ?? r[0] ?? "").trim();
    const title = String(r[4] ?? "").trim();
    if (!title && !String(r[2] ?? "").trim() && col0 && !/discipline|dwg/i.test(col0)) {
      discipline = col0.replace(/\s+drawing$/i, "").trim() || discipline;
      continue;
    }
    if (!drawingNumber || !title || /dwg\.?\s*no|title/i.test(drawingNumber) || /title/i.test(title)) continue;

    const revDates = [r[6], r[7], r[8], r[9], r[10], r[11]];
    let rev = "R0";
    let issued: Date | null = excelSerial(r[5]);
    revDates.forEach((cell, idx) => {
      const d = excelSerial(cell);
      if (d) {
        rev = `R${idx}`;
        issued = d;
      }
    });

    const drawing = await prisma.drawing.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        drawingNumber,
        title,
        discipline,
        buildingArea: String(r[1] ?? "").trim() || null,
        currentRev: rev,
        status: "Approved",
        isPublished: true,
        folderPath: `Drawings/${discipline}`,
        revisions: {
          create: {
            revisionNumber: rev,
            revisionLabel: `${rev} — DCI`,
            fileUrl: `/uploads/onedrive/pending/${drawingNumber}-${rev}.pdf`,
            fileName: `${drawingNumber}-${rev}.pdf`,
            published: true,
            uploadedById,
            actualDate: issued,
            receivedDate: excelSerial(r[5]) || issued,
          },
        },
      },
      update: {
        title,
        discipline,
        buildingArea: String(r[1] ?? "").trim() || null,
        currentRev: rev,
        status: "Approved",
        isPublished: true,
      },
    });
    drawings += 1;

    const existingRev = await prisma.drawingRevision.findFirst({
      where: { drawingId: drawing.id, revisionNumber: rev },
    });
    if (!existingRev) {
      await prisma.drawingRevision.create({
        data: {
          drawingId: drawing.id,
          revisionNumber: rev,
          revisionLabel: `${rev} — DCI`,
          fileUrl: `/uploads/onedrive/pending/${drawingNumber}-${rev}.pdf`,
          fileName: `${drawingNumber}-${rev}.pdf`,
          published: true,
          uploadedById,
          actualDate: issued,
        },
      });
    } else if (!existingRev.published) {
      await prisma.drawingRevision.update({
        where: { id: existingRev.id },
        data: { published: true },
      });
    }

    await prisma.drawingRegisterLine.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        drawingId: drawing.id,
        srNo: drawings,
        building: String(r[1] ?? "").trim() || null,
        discipline,
        drawingNumber,
        drawingTitle: title,
        consultantName: String(r[3] ?? "").trim() || "AK Consultant",
        revisionNumber: rev,
        latestRevision: "Yes",
        issueDate: issued,
        source: path.basename(file),
      },
      update: {
        drawingId: drawing.id,
        drawingTitle: title,
        discipline,
        revisionNumber: rev,
        issueDate: issued,
        source: path.basename(file),
      },
    });
    lines += 1;
  }
  return { drawings, lines, source: path.basename(file) };
}

function cellDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const serial = excelSerial(v);
  if (serial) return serial;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Import Master Drawing Register rows from an uploaded DRAWING REGISTER - 01.xlsx buffer.
 * Upserts register lines only — does not invent SharePoint PDF stubs.
 */
export async function importMasterRegisterFromBuffer(
  projectId: string,
  buffer: Buffer,
  sourceName = "upload.xlsx",
): Promise<{ lines: number; source: string; picklists?: string[]; warnings: string[] }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const picklists = await applyInputSheetPicklists(projectId, wb);
  const warnings: string[] = [];
  const master =
    wb.SheetNames.find((n) => /Master Drawing Register/i.test(n)) ||
    wb.SheetNames.find((n) => /master/i.test(n)) ||
    wb.SheetNames[0];
  if (!master || !wb.Sheets[master]) return { lines: 0, source: sourceName, picklists, warnings };

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[master], {
    header: 1,
    defval: "",
  }) as unknown[][];
  const headerIdx = rows.findIndex((r) => {
    const a = String(r[0] ?? "").trim();
    const e = String(r[4] ?? "").trim();
    return a === "Sr #" || (/^sr/i.test(a) && /drawing/i.test(e));
  });

  let lines = 0;
  const allowedPackages = await projectPackageNames(projectId);
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const drawingNumber = String(r[4] ?? "").trim();
    const title = String(r[5] ?? "").trim();
    if (!drawingNumber || !title) continue;
    if (/drawing number|title/i.test(drawingNumber)) continue;

    const planned = cellDate(r[12]);
    const actual = cellDate(r[13]);
    const submissionDelayDays = delayDays(planned, actual);
    const rowLabel = `Row ${i + 1} (${drawingNumber})`;
    const srNo = cellInt(r[0], 1, 99999);
    if (srNo.bad) warnings.push(`${rowLabel}: Sr # "${String(r[0]).trim()}" is not a whole number, next number used`);
    const copies = cellInt(r[18], 0, 99);
    if (copies.bad) warnings.push(`${rowLabel}: No. of copies "${String(r[18]).trim()}" is not a whole number from 0 to 99, left empty`);
    const projectPackage = String(r[1] ?? "").trim();
    if (projectPackage && packageNotAllowed(projectPackage, allowedPackages)) {
      warnings.push(`${rowLabel}: package "${projectPackage}" is not on the project set-up. The value was kept.`);
    }

    await prisma.drawingRegisterLine.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        srNo: srNo.value ?? lines + 1,
        projectPackage: projectPackage || null,
        building: String(r[2] ?? "").trim() || null,
        discipline: String(r[3] ?? "").trim() || null,
        drawingNumber,
        drawingTitle: title,
        drawingType: String(r[6] ?? "").trim() || null,
        consultantName: String(r[7] ?? "").trim() || null,
        revisionNumber: String(r[8] ?? "").trim() || null,
        revisionDate: cellDate(r[9]),
        revisionDescription: String(r[10] ?? "").trim() || null,
        latestRevision: String(r[11] ?? "").trim() || null,
        plannedSubmissionDate: planned,
        actualSubmissionDate: actual,
        submissionDelayDays,
        delayResponsibility: String(r[15] ?? "").trim() || null,
        issuedTo: String(r[16] ?? "").trim() || null,
        issueDate: cellDate(r[17]),
        copiesCount: copies.value,
        criticalDrawing: String(r[19] ?? "").trim() || null,
        remarks: String(r[20] ?? "").trim() || null,
        source: sourceName,
      },
      update: {
        srNo: srNo.value ?? undefined,
        projectPackage: projectPackage || null,
        building: String(r[2] ?? "").trim() || null,
        discipline: String(r[3] ?? "").trim() || null,
        drawingTitle: title,
        drawingType: String(r[6] ?? "").trim() || null,
        consultantName: String(r[7] ?? "").trim() || null,
        revisionNumber: String(r[8] ?? "").trim() || null,
        revisionDate: cellDate(r[9]),
        revisionDescription: String(r[10] ?? "").trim() || null,
        latestRevision: String(r[11] ?? "").trim() || null,
        plannedSubmissionDate: planned,
        actualSubmissionDate: actual,
        submissionDelayDays,
        delayResponsibility: String(r[15] ?? "").trim() || null,
        issuedTo: String(r[16] ?? "").trim() || null,
        issueDate: cellDate(r[17]),
        copiesCount: copies.value,
        criticalDrawing: String(r[19] ?? "").trim() || null,
        remarks: String(r[20] ?? "").trim() || null,
        source: sourceName,
      },
    });
    lines += 1;
  }
  return { lines, source: sourceName, picklists, warnings: warnings.slice(0, 200) };
}

/** Whole number cell in [min, max]. Blank gives null; anything else that does not fit is flagged as bad and gives null. */
function cellInt(v: unknown, min: number, max: number): { value: number | null; bad: boolean } {
  if (v == null) return { value: null, bad: false };
  const text = typeof v === "number" ? String(v) : String(v).trim();
  if (!text) return { value: null, bad: false };
  if (!/^\d+$/.test(text)) return { value: null, bad: true };
  const num = Number(text);
  return num < min || num > max ? { value: null, bad: true } : { value: num, bad: false };
}

/** The workbook's "Input" sheet (Latest Revision | Drawing Type | Discipline | Delay Responsibility) → this project's pick-lists. */
async function applyInputSheetPicklists(projectId: string, wb: { SheetNames: string[]; Sheets: Record<string, unknown> }): Promise<string[]> {
  const name = wb.SheetNames.find((n: string) => /^input$/i.test(n.trim()));
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] as never, { header: 1, defval: "" }) as unknown[][];
  const head = rows[0] || [];
  const colOf = (re: RegExp) => head.findIndex((h) => re.test(String(h || "")));
  const read = (idx: number) => {
    if (idx < 0) return [] as string[];
    const out: string[] = [];
    for (const r of rows.slice(1)) {
      const v = String(r[idx] ?? "").replace(/\s+/g, " ").trim().replace(/^Strcutural/i, "Structural");
      if (!v || /^note:?$/i.test(v)) break;
      out.push(v);
    }
    return out;
  };
  const found: Partial<Record<"drawingTypes" | "disciplines" | "delayResponsibility", string[]>> = {};
  const types = read(colOf(/drawing\s*type/i));
  const disc = read(colOf(/discipline/i));
  const delay = read(colOf(/delay/i));
  if (types.length) found.drawingTypes = types;
  if (disc.length) found.disciplines = disc;
  if (delay.length) found.delayResponsibility = delay;
  if (!Object.keys(found).length) return [];
  const { savePicklists } = await import("./drawingPicklists.js");
  await savePicklists(projectId, found);
  return Object.keys(found);
}

/**
 * Import Approval & GFC Drawing Log.xlsx — creates/updates Drawing rows.
 * R0–Rn date columns become DrawingRevision rows (dates only). PDF/DWG still go through Upload rev / Update files.
 */
export async function importGfcLogFromBuffer(
  projectId: string,
  buffer: Buffer,
  uploadedById: string,
  sourceName = "gfc-upload.xlsx",
): Promise<{ drawings: number; revisions: number; source: string; skipped: number }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => /^gfc$/i.test(n)) ||
    wb.SheetNames.find((n) => /approval|drawing.?log/i.test(n)) ||
    wb.SheetNames[0];
  if (!sheetName || !wb.Sheets[sheetName]) {
    return { drawings: 0, revisions: 0, source: sourceName, skipped: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const headerIdx = rows.findIndex((r) => {
    const joined = r.map((c) => String(c ?? "").toLowerCase()).join("|");
    return /discipline/.test(joined) && (/dwg/.test(joined) || /drawing\s*no/.test(joined));
  });
  if (headerIdx < 0) {
    throw new Error(
      "Could not find the GFC header row (DISCIPLINE / DWG. NO. / TITLE / R0…). Use Approval & GFC Drawing Log.xlsx.",
    );
  }

  const header = rows[headerIdx] as unknown[];
  const col = (re: RegExp, fallback: number) => {
    const i = header.findIndex((c) => re.test(String(c ?? "")));
    return i >= 0 ? i : fallback;
  };
  const iDisc = col(/discipline/i, 0);
  const iBldg = col(/building|area/i, 1);
  const iTl = col(/tl/i, 2);
  const iDwg = col(/dwg|drawing\s*no/i, 3);
  const iTitle = col(/^title$/i, 4);
  const revSlots: number[] = [];
  const seenRev = new Set<string>();
  header.forEach((c, idx) => {
    const m = String(c ?? "")
      .trim()
      .match(/^(R\d+)$/i);
    if (!m) return;
    const label = m[1].toUpperCase();
    if (seenRev.has(label)) return; // workbook has a second R0–Rn block (counts) — keep first dates only
    seenRev.add(label);
    revSlots.push(idx);
  });
  // Fallback R0–R5 in columns 6–11 if header labels missing
  if (!revSlots.length) {
    for (let i = 6; i <= 11; i++) revSlots.push(i);
  }

  let drawings = 0;
  let revisions = 0;
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const drawingNumber = String(r[iDwg] ?? "").trim();
    const title = String(r[iTitle] ?? "").trim();
    if (!drawingNumber || !title) {
      skipped++;
      continue;
    }
    if (/dwg\.?\s*no|drawing\s*no/i.test(drawingNumber) || /^title$/i.test(title)) {
      skipped++;
      continue;
    }

    let discipline = String(r[iDisc] ?? "Architecture").trim() || "Architecture";
    if (/^architect/i.test(discipline)) discipline = "Architecture";
    else if (/^struct/i.test(discipline)) discipline = "Structural";
    else if (/mep|electrical|plumbing|hvac/i.test(discipline)) discipline = "MEPF";

    const buildingArea = String(r[iBldg] ?? "").trim() || null;
    const tlNo = String(r[iTl] ?? "").trim() || null;

    let currentRev = "R0";
    const revDates: { revisionNumber: string; date: Date }[] = [];
    for (const colIdx of revSlots) {
      const label = String(header[colIdx] ?? "").trim().toUpperCase() || `R${revDates.length}`;
      const revNum = /^R\d+$/i.test(label) ? label.toUpperCase() : `R${revDates.length}`;
      const d = cellDate(r[colIdx]);
      if (!d) continue;
      // Ignore TOTAL / count columns mistaken as dates
      if (d.getFullYear() < 1990) continue;
      revDates.push({ revisionNumber: revNum, date: d });
      currentRev = revNum;
    }

    const drawing = await prisma.drawing.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        drawingNumber,
        title,
        discipline,
        buildingArea,
        tlNo,
        currentRev,
        status: "Draft",
        isPublished: false,
        folderPath: `Drawings/${discipline}`,
      },
      update: {
        title,
        discipline,
        buildingArea,
        tlNo,
        currentRev,
      },
    });
    drawings += 1;

    for (const { revisionNumber, date } of revDates) {
      const existing = await prisma.drawingRevision.findFirst({
        where: { drawingId: drawing.id, revisionNumber },
      });
      const sameStamp =
        existing?.plannedDate &&
        existing.actualDate &&
        existing.plannedDate.getTime() === existing.actualDate.getTime();
      if (existing) {
        await prisma.drawingRevision.update({
          where: { id: existing.id },
          data: {
            actualDate: date,
            plannedDate: sameStamp ? null : existing.plannedDate,
            // Keep real files if already uploaded; only fill placeholder when empty
            ...(existing.fileUrl && !/\/pending\//i.test(existing.fileUrl)
              ? {}
              : {
                  fileUrl: `/uploads/onedrive/pending/${drawingNumber}-${revisionNumber}.pdf`,
                  fileName: `${drawingNumber}-${revisionNumber}.pdf`,
                }),
          },
        });
      } else {
        await prisma.drawingRevision.create({
          data: {
            drawingId: drawing.id,
            revisionNumber,
            revisionLabel: `${revisionNumber} - Approval & GFC Log import`,
            fileUrl: `/uploads/onedrive/pending/${drawingNumber}-${revisionNumber}.pdf`,
            fileName: `${drawingNumber}-${revisionNumber}.pdf`,
            published: false,
            uploadedById,
            actualDate: date,
            plannedDate: null,
          },
        });
        revisions += 1;
      }
    }

    const latestActual = revDates.length ? revDates[revDates.length - 1].date : null;
    const existingLine = await prisma.drawingRegisterLine.findUnique({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
    });
    const plannedCopiedFromActual =
      !!existingLine?.plannedSubmissionDate &&
      !!latestActual &&
      existingLine.plannedSubmissionDate.getTime() === latestActual.getTime();

    const line = await prisma.drawingRegisterLine.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        drawingId: drawing.id,
        building: buildingArea,
        discipline,
        drawingNumber,
        drawingTitle: title,
        drawingType: "Good For Construction (GFC)",
        revisionNumber: currentRev,
        latestRevision: "Yes",
        actualSubmissionDate: latestActual,
        revisionDate: latestActual,
        source: sourceName,
      },
      update: {
        drawingId: drawing.id,
        drawingTitle: title,
        building: buildingArea,
        discipline,
        revisionNumber: currentRev,
        actualSubmissionDate: latestActual,
        revisionDate: latestActual,
        ...(plannedCopiedFromActual ? { plannedSubmissionDate: null } : {}),
        source: sourceName,
      },
    });

    const lineDelay = delayDays(line.plannedSubmissionDate, line.actualSubmissionDate);
    if (lineDelay !== line.submissionDelayDays) {
      await prisma.drawingRegisterLine.update({ where: { id: line.id }, data: { submissionDelayDays: lineDelay } });
    }

    if (line.plannedSubmissionDate) {
      await prisma.drawingRevision.updateMany({
        where: { drawingId: drawing.id, revisionNumber: currentRev, plannedDate: null },
        data: { plannedDate: line.plannedSubmissionDate },
      });
    }
  }
  return { drawings, revisions, source: sourceName, skipped };
}

/** One-click UAT: import the bundled Approval & GFC Drawing Log.xlsx from module_prompts. */
export async function importGfcLogFromBundledWorkbook(
  projectId: string,
  uploadedById: string,
): Promise<{ drawings: number; revisions: number; source: string; skipped: number }> {
  const file = findWorkbook([
    "Approval  &  GFC Drawing Log.xlsx",
    "Approval & GFC Drawing Log.xlsx",
    "Approval-GFC-Drawing-Log.xlsx",
  ]);
  if (!file) {
    throw new Error(
      "Approval-GFC-Drawing-Log.xlsx not found on server. Upload the file with Import Approval & GFC Log instead.",
    );
  }
  const fs = await import("fs");
  const buffer = fs.readFileSync(file);
  return importGfcLogFromBuffer(projectId, buffer, uploadedById, path.basename(file));
}

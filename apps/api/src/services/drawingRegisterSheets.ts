/**
 * Parse DRAWING REGISTER - 01.xlsx for dashboard KPIs.
 */
import path from "path";
import XLSX from "../lib/xlsx.js";
import { findWorkbook } from "../lib/excelRoot.js";
import { prisma } from "../prisma.js";

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

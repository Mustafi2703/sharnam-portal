/**
 * Fill CRM vendor BOQ slots from Comparative Statement R2 template (demo / UAT).
 */
import fs from "fs";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import {
  COMPARATIVE_DISCIPLINES,
  importR2WorkbookFromFile,
  parseDisciplineBoqSheet,
  parseDisciplinesJson,
  pickDisciplineWorksheet,
  resolveR2TemplatePath,
  type ImportedSheet,
} from "./comparativeStatement.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { CRM_SHAREPOINT, syncBufferToProjectSharePoint } from "./crmSharePoint.js";
import { recomputeBidPackageComparative } from "./crmBidRecompute.js";

const VENDOR_RATE_FACTOR: Record<string, number> = {
  "M/s Bhavna Infra": 1,
  "TCC Projects PVT. LTD.": 1.04,
  "Pearl Electricals": 1.02,
  "Kalyani Construction Co.": 1.03,
  "Shreeji Infra Projects": 1.05,
  "VoltTech Electricals": 1.01,
  "PowerLine Contractors": 1.06,
  "BuildCraft Interiors": 1.02,
  "SecureGate Systems": 1.03,
  "AquaFlow MEP": 1.04,
  "WeighPro India": 1.01,
  "SteelForm Fabricators": 1.05,
};

function scaleBoqRates(sheet: ImportedSheet, factor: number): ImportedSheet {
  if (factor === 1) return sheet;
  const headers = sheet.headers.map((h) => String(h).toLowerCase());
  const rateCols = headers.map((h, i) => (h.includes("rate") || h === "unit rate" ? i : -1)).filter((i) => i >= 0);
  const amtCols = headers.map((h, i) => (h.includes("amount") || h.includes("total") ? i : -1)).filter((i) => i >= 0);
  const rows: SheetCell[][] = sheet.rows.map((row) =>
    row.map((cell, ci) => {
      if (rateCols.includes(ci) || amtCols.includes(ci)) {
        const n = Number(cell.raw);
        if (Number.isFinite(n) && n > 0) return { raw: String(Math.round(n * factor)) };
      }
      return { ...cell };
    })
  );
  return { headers: sheet.headers, rows: evaluateAllRows(rows), sheetName: sheet.sheetName };
}

function vendorRateFactor(vendorLabel: string, slotIndex: number): number {
  if (VENDOR_RATE_FACTOR[vendorLabel]) return VENDOR_RATE_FACTOR[vendorLabel];
  return 1 + (slotIndex % 5) * 0.02;
}

export async function seedBidPackageR2Boqs(
  prisma: PrismaClient,
  bidPackageId: string,
  officeUserId: string,
  opts?: { force?: boolean }
) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: bidPackageId },
    include: { vendorBoqs: true, project: { select: { id: true, code: true } } },
  });
  if (!pkg) throw new Error("Bid package not found");

  const vendorLabels = [...new Set(pkg.vendorBoqs.map((s) => s.vendorLabel))];
  const r2Path = resolveR2TemplatePath();
  const buffer = fs.readFileSync(r2Path);
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  const imported = importR2WorkbookFromFile(r2Path, vendorLabels.length ? vendorLabels : undefined);
  const disciplines = parseDisciplinesJson(pkg.disciplinesJson);

  if (pkg.project?.id) await mockOneDrive.ensureProjectTree(pkg.project.id);

  let uploaded = 0;
  let slotIndex = 0;
  for (const slot of pkg.vendorBoqs) {
    const existing = await prisma.crmVendorBoq.findUnique({ where: { id: slot.id } });
    if (!opts?.force && existing?.fileName && existing.sheetId) {
      slotIndex++;
      continue;
    }

    const factor = vendorRateFactor(slot.vendorLabel, slotIndex++);
    const disc = COMPARATIVE_DISCIPLINES.find((d) => d.key === slot.discipline);
    const template = imported.disciplineTemplates[slot.discipline];
    let parsed: ImportedSheet;
    if (template?.rows?.length) {
      parsed = scaleBoqRates(template, factor);
    } else {
      const ws = pickDisciplineWorksheet(wb, slot.discipline, disciplines);
      if (!ws) continue;
      parsed = scaleBoqRates(parseDisciplineBoqSheet(ws, slot.discipline, disciplines), factor);
    }

    const sheetPayload = {
      name: `${slot.vendorLabel} — ${disc?.label || slot.discipline} — ${pkg.title}`,
      headersJson: JSON.stringify(parsed.headers),
      rowsJson: JSON.stringify(parsed.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
    };

    let boqSheetId = existing?.sheetId || null;
    if (boqSheetId && opts?.force) {
      await prisma.customSheet.update({ where: { id: boqSheetId }, data: sheetPayload });
    } else if (!boqSheetId) {
      const boqSheet = await prisma.customSheet.create({
        data: { ...sheetPayload, category: "CRM Vendor BOQ", createdById: officeUserId },
      });
      boqSheetId = boqSheet.id;
    }

    const fileName = `R2-${slot.discipline}-${slot.vendorLabel.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
    let storagePath: string | undefined = existing?.storagePath || undefined;
    let sharePointUrl: string | null = existing?.sharePointUrl || null;
    if (pkg.project?.code) {
      const miniWb = XLSX.utils.book_new();
      const aoa = [parsed.headers, ...parsed.rows.map((row) => row.map((c) => c.raw))];
      const wsOut = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(miniWb, wsOut, disc?.sheetName || slot.discipline);
      const out = XLSX.write(miniWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const saved = await syncBufferToProjectSharePoint(
        pkg.project.code,
        CRM_SHAREPOINT.vendorBoqFolder(slot.vendorLabel),
        fileName,
        out
      );
      storagePath = saved.path;
      sharePointUrl = saved.sharePointUrl || null;
    }

    await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: {
        fileName,
        storagePath,
        sharePointUrl,
        sheetId: boqSheetId,
        uploadedById: officeUserId,
        uploadedAt: new Date(),
      },
    });
    uploaded++;
  }

  await prisma.crmBidPackage.update({
    where: { id: bidPackageId },
    data: { status: pkg.status === "Draft" ? "Evaluation" : pkg.status },
  });

  const recomputed = await recomputeBidPackageComparative(prisma, bidPackageId);
  return { uploaded, total: pkg.vendorBoqs.length, recomputed };
}

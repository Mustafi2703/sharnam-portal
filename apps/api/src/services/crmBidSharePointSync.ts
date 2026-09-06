/**
 * CRM bid SharePoint layout — vendor × discipline BOQ folders + live comparative master.
 * ISO 19650: 05.05 Bid receipt (per vendor / discipline) · 05.06 Comparative statement.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import { evaluateAllRows, normalizeCell, type SheetCell } from "@sharnam/shared";
import { mockOneDrive } from "./mockOneDrive.js";
import { CRM_SHAREPOINT, syncBufferToProjectSharePoint } from "./crmSharePoint.js";
import { parseDisciplinesJson } from "./comparativeStatement.js";

export type CrmSharePointNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  url?: string;
  sharePointUrl?: string | null;
  children?: CrmSharePointNode[];
};

function ensureLocalFolder(projectCode: string, relFolder: string) {
  const root = mockOneDrive.projectRoot(projectCode);
  fs.mkdirSync(path.join(root, relFolder), { recursive: true });
}

function sheetToBuffer(headers: string[], rows: SheetCell[][], sheetName: string): Buffer {
  const aoa = [headers, ...rows.map((row) => row.map((c) => c.computed ?? c.raw ?? ""))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function parseRowsJson(json: string): SheetCell[][] {
  try {
    const raw = JSON.parse(json || "[]") as unknown[][];
    return evaluateAllRows(raw.map((row) => (Array.isArray(row) ? row.map((c) => normalizeCell(c)) : [])));
  } catch {
    return [];
  }
}

/** Ensure procurement subfolders for each bidder × discipline on a package. */
export async function ensureCrmBidSharePointTree(
  prisma: PrismaClient,
  projectId: string,
  vendorLabels: string[],
  disciplineKeys: string[]
) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { code: true } });
  await mockOneDrive.ensureProjectTree(projectId);

  const relPaths = new Set<string>([
    CRM_SHAREPOINT.comparative,
    CRM_SHAREPOINT.pmcProposals,
    CRM_SHAREPOINT.vendorBoqRoot,
  ]);

  for (const vendor of vendorLabels) {
    relPaths.add(CRM_SHAREPOINT.vendorBoqVendorRoot(vendor));
    for (const disc of disciplineKeys) {
      relPaths.add(CRM_SHAREPOINT.vendorBoqFolder(vendor, disc));
    }
  }

  for (const rel of relPaths) {
    ensureLocalFolder(project.code, rel);
    await mockOneDrive.touchFolder(projectId, rel);
  }

  return { projectCode: project.code, folders: [...relPaths] };
}

/** Write one vendor discipline BOQ xlsx to SharePoint (replace on save). */
export async function syncVendorBoqSlotToSharePoint(
  prisma: PrismaClient,
  slotId: string,
  opts?: { force?: boolean }
) {
  const slot = await prisma.crmVendorBoq.findUnique({
    where: { id: slotId },
    include: {
      bidPackage: { include: { project: { select: { id: true, code: true } } } },
    },
  });
  if (!slot?.sheetId || !slot.bidPackage.project?.code) return null;

  const sheet = await prisma.customSheet.findUnique({ where: { id: slot.sheetId } });
  if (!sheet) return null;

  const headers = JSON.parse(sheet.headersJson || "[]") as string[];
  const rows = parseRowsJson(sheet.rowsJson);
  const disc = slot.discipline;
  const fileName = `R2-${disc}-${slot.vendorLabel.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
  const relFolder = CRM_SHAREPOINT.vendorBoqFolder(slot.vendorLabel, disc);
  const buffer = sheetToBuffer(headers, rows, disc);

  if (slot.bidPackage.project.id) {
    await ensureCrmBidSharePointTree(prisma, slot.bidPackage.project.id, [slot.vendorLabel], [disc]);
  }

  const saved = await syncBufferToProjectSharePoint(slot.bidPackage.project.code, relFolder, fileName, buffer, {
    replace: true,
  });

  await prisma.crmVendorBoq.update({
    where: { id: slot.id },
    data: {
      storagePath: saved.path,
      sharePointUrl: saved.sharePointUrl || null,
      fileName: fileName,
    },
  });

  return saved;
}

/** Push live summary + master compare sheets to 05.06 Comparative_Statement. */
export async function syncComparativeMasterWorkbook(prisma: PrismaClient, pkgId: string) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    include: { project: { select: { id: true, code: true } } },
  });
  if (!pkg?.project?.code) return null;

  const vendorNames: string[] = (() => {
    try {
      return JSON.parse(pkg.vendorNamesJson || "[]");
    } catch {
      return [];
    }
  })();
  const disciplines = parseDisciplinesJson(pkg.disciplinesJson);
  await ensureCrmBidSharePointTree(
    prisma,
    pkg.project.id,
    vendorNames,
    disciplines.map((d) => d.key)
  );

  const wb = XLSX.utils.book_new();
  if (pkg.summarySheetId) {
    const s = await prisma.customSheet.findUnique({ where: { id: pkg.summarySheetId } });
    if (s) {
      const rows = parseRowsJson(s.rowsJson);
      const aoa = rows.map((row) => row.map((c) => c.computed ?? c.raw ?? ""));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Summary");
    }
  }
  if (pkg.comparativeSheetId) {
    const m = await prisma.customSheet.findUnique({ where: { id: pkg.comparativeSheetId } });
    if (m) {
      const headers = JSON.parse(m.headersJson || "[]") as string[];
      const rows = parseRowsJson(m.rowsJson);
      const aoa = [headers, ...rows.map((row) => row.map((c) => c.computed ?? c.raw ?? ""))];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Master BOQ");
    }
  }

  if (!wb.SheetNames.length) return null;

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `Comparative-Statement-${(pkg.revisionLabel || "R2").replace(/[^a-zA-Z0-9._-]/g, "_")}-live.xlsx`;
  const saved = await syncBufferToProjectSharePoint(pkg.project.code, CRM_SHAREPOINT.comparative, fileName, buffer, {
    replace: true,
  });

  await prisma.crmBidPackage.update({
    where: { id: pkgId },
    data: { comparativeSharePointUrl: saved.sharePointUrl || saved.url },
  });

  return saved;
}

function listTree(projectCode: string, relPath: string, depth = 0, maxDepth = 4): CrmSharePointNode[] {
  if (depth > maxDepth) return [];
  const items = mockOneDrive.listChildren(projectCode, relPath);
  return items.map((item) => {
    const node: CrmSharePointNode = {
      name: item.name,
      path: item.path,
      type: item.type,
      url: item.url,
    };
    if (item.type === "folder") {
      node.children = listTree(projectCode, item.path, depth + 1, maxDepth);
    }
    return node;
  });
}

/** Office / vendor — browse procurement SharePoint tree for a bid package. */
export async function listCrmBidSharePointTree(prisma: PrismaClient, pkgId: string, vendorLabel?: string | null) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    include: { project: { select: { code: true } } },
  });
  if (!pkg?.project?.code) return { roots: [] as CrmSharePointNode[], projectCode: null };

  const vendorRoot = CRM_SHAREPOINT.vendorBoqRoot;
  const roots: CrmSharePointNode[] = [
    {
      name: "05.06 Comparative Statement (master)",
      path: CRM_SHAREPOINT.comparative,
      type: "folder",
      children: listTree(pkg.project.code, CRM_SHAREPOINT.comparative),
    },
    {
      name: "05.05 Vendor BOQs",
      path: vendorRoot,
      type: "folder",
      children: vendorLabel
        ? listTree(pkg.project.code, CRM_SHAREPOINT.vendorBoqVendorRoot(vendorLabel))
        : listTree(pkg.project.code, vendorRoot),
    },
  ];

  return {
    projectCode: pkg.project.code,
    comparativeSharePointUrl: pkg.comparativeSharePointUrl,
    roots,
  };
}

/** After recompute — sync all filled slots + master workbook. */
export async function syncBidPackageToSharePoint(prisma: PrismaClient, pkgId: string) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    include: { vendorBoqs: { where: { sheetId: { not: null } } }, project: { select: { id: true } } },
  });
  if (!pkg?.project?.id) return { vendorSynced: 0, master: null as Awaited<ReturnType<typeof syncComparativeMasterWorkbook>> };

  let vendorSynced = 0;
  for (const slot of pkg.vendorBoqs) {
    try {
      await syncVendorBoqSlotToSharePoint(prisma, slot.id);
      vendorSynced++;
    } catch (err) {
      console.warn("[CRM SharePoint] vendor BOQ sync failed:", slot.id, err instanceof Error ? err.message : err);
    }
  }
  const master = await syncComparativeMasterWorkbook(prisma, pkgId);
  return { vendorSynced, master };
}

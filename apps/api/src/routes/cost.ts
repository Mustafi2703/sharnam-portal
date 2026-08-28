import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import {
  parseBoqBuffer,
  parseBbsBuffer,
  parseMbBuffer,
  parseAllMbSheets,
  parseAllBbsSheets,
  isFullSpdcWorkbook,
} from "../modules/cost/index.js";
import { requireModuleView } from "../modules/_shared/guards.js";
import { userCanAccessProject } from "../modules/_shared/projectAccess.js";
import { audit } from "../services/audit.js";
import { workbookBuffer } from "../services/brandedExport.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function parseBatchMeta(summaryJson: string | null): Record<string, unknown> {
  try {
    return JSON.parse(summaryJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeFolderPart(s: string) {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "General";
}

const BBS_ROW_KINDS = new Set(["section", "subsection", "subheader", "data", "note", "total"]);
const MB_ROW_KINDS = new Set(["item", "description", "subsection", "subitem", "data", "total", "note"]);

function numOr(v: unknown, fallback: number) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** SPDC BBS: total length = cutting × nos; weight kg = d²/162 × length (m). */
function bbsLineCompute(
  body: Record<string, unknown>,
  existing?: {
    nos?: number;
    nosPerMember?: number;
    nosOfMember?: number;
    diameterMm?: number;
    lengthMm?: number;
    shapeLenA?: number;
    shapeLenB?: number;
    shapeLenC?: number;
    shapeLenD?: number;
    shapeLenE?: number;
    totalLength?: number;
    weightKg?: number;
    rowKind?: string | null;
  }
) {
  const nosPerMember = numOr(body.nosPerMember, existing?.nosPerMember || 0);
  const nosOfMember = numOr(body.nosOfMember, existing?.nosOfMember || 0);
  const nos =
    body.nos != null && body.nos !== ""
      ? numOr(body.nos, 0)
      : nosPerMember * nosOfMember || existing?.nos || 0;
  const shapeLenA = numOr(body.shapeLenA, existing?.shapeLenA || 0);
  const shapeLenB = numOr(body.shapeLenB, existing?.shapeLenB || 0);
  const shapeLenC = numOr(body.shapeLenC, existing?.shapeLenC || 0);
  const shapeLenD = numOr(body.shapeLenD, existing?.shapeLenD || 0);
  const shapeLenE = numOr(body.shapeLenE, existing?.shapeLenE || 0);
  const shapeSum = shapeLenA + shapeLenB + shapeLenC + shapeLenD + shapeLenE;
  const lengthMm =
    body.lengthMm != null && body.lengthMm !== ""
      ? numOr(body.lengthMm, 0)
      : shapeSum || existing?.lengthMm || 0;
  const totalLength =
    body.totalLength != null && body.totalLength !== ""
      ? numOr(body.totalLength, 0)
      : Number(((lengthMm || 0) * (nos || 0)).toFixed(4));
  const diameterMm = numOr(body.diameterMm, existing?.diameterMm || 0);
  const weightKg =
    body.weightKg != null && body.weightKg !== ""
      ? numOr(body.weightKg, 0)
      : diameterMm >= 6 && totalLength > 0
        ? Math.round(((diameterMm * diameterMm * totalLength) / 162) * 100) / 100
        : existing?.weightKg || 0;
  const rowKindRaw =
    body.rowKind != null
      ? String(body.rowKind).trim().toLowerCase()
      : String(existing?.rowKind || "");
  const rowKind = BBS_ROW_KINDS.has(rowKindRaw) ? rowKindRaw : undefined;
  if (rowKind && rowKind !== "data") {
    return {
      nosPerMember: 0,
      nosOfMember: 0,
      nos: 0,
      shapeLenA: 0,
      shapeLenB: 0,
      shapeLenC: 0,
      shapeLenD: 0,
      shapeLenE: 0,
      lengthMm: 0,
      totalLength: 0,
      diameterMm: 0,
      weightKg: 0,
      rowKind,
    };
  }
  return {
    nosPerMember,
    nosOfMember,
    nos,
    shapeLenA,
    shapeLenB,
    shapeLenC,
    shapeLenD,
    shapeLenE,
    lengthMm,
    totalLength,
    diameterMm,
    weightKg,
    rowKind,
  };
}

async function nextBbsLineIndex(projectId: string, packageName: string) {
  const last = await prisma.costBbsLine.findFirst({
    where: { projectId, packageName },
    orderBy: { lineIndex: "desc" },
    select: { lineIndex: true },
  });
  return (last?.lineIndex || 0) + 1;
}

async function nextMbLineIndex(projectId: string, packageName: string) {
  const last = await prisma.costMbLine.findFirst({
    where: { projectId, packageName },
    orderBy: { lineIndex: "desc" },
    select: { lineIndex: true },
  });
  return (last?.lineIndex || 0) + 1;
}

const CASHFLOW_SHEET_TOOLS = [
  { id: "chart", label: "Cash Flow Chart", source: "Cashflow - Dashboard.xlsx" },
  { id: "forecast", label: "Cash Flow Forecast", source: "Cashflow - Dashboard.xlsx" },
  { id: "tracking", label: "Tracking", source: "Cashflow - Dashboard.xlsx" },
];

export const costRouter = Router();
costRouter.use(requireAuth);
costRouter.use(requireModuleView("cost"));
costRouter.param("projectId", async (req: AuthedRequest, res, next, projectId) => {
  try {
    const ok = await userCanAccessProject(req, String(projectId));
    if (!ok) return res.status(404).json({ error: "Not found" });
    next();
  } catch (err) {
    next(err);
  }
});

/** Global BBS shape code master — must register before /:projectId routes */
costRouter.get("/shape-masters", async (_req, res) => {
  const rows = await prisma.bbsShapeMaster.findMany({ orderBy: [{ shapeCode: "asc" }] });
  res.json(rows);
});

costRouter.post("/shape-masters", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const body = req.body || {};
  const shapeCode = String(body.shapeCode || "").trim().toUpperCase();
  if (!shapeCode) return res.status(400).json({ error: "shapeCode required" });
  const row = await prisma.bbsShapeMaster.create({
    data: {
      shapeCode,
      name: body.name ? String(body.name) : null,
      description: body.description ? String(body.description) : null,
      bendInfo: body.bendInfo ? String(body.bendInfo) : null,
      packageHint: body.packageHint ? String(body.packageHint) : null,
    },
  });
  res.status(201).json(row);
});

costRouter.patch("/shape-masters/:id", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const body = req.body || {};
  const row = await prisma.bbsShapeMaster.update({
    where: { id: req.params.id },
    data: {
      ...(body.shapeCode != null ? { shapeCode: String(body.shapeCode).trim().toUpperCase() } : {}),
      ...(body.name !== undefined ? { name: body.name ? String(body.name) : null } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.bendInfo !== undefined ? { bendInfo: body.bendInfo ? String(body.bendInfo) : null } : {}),
      ...(body.packageHint !== undefined ? { packageHint: body.packageHint ? String(body.packageHint) : null } : {}),
    },
  });
  res.json(row);
});

costRouter.delete("/shape-masters/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.bbsShapeMaster.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

costRouter.post(
  "/shape-masters/:id/diagram",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const master = await prisma.bbsShapeMaster.findUnique({ where: { id: req.params.id } });
    if (!master) return res.status(404).json({ error: "Not found" });
    const saved = await mockOneDrive.upload(
      "MASTER",
      "07_EXECUTION_AND_DELIVERY/07.06_Method_Statements_and_Temporary_Works/bbs/shape-library",
      `${master.shapeCode}-${Date.now()}-${req.file.originalname}`,
      req.file.buffer
    );
    const row = await prisma.bbsShapeMaster.update({
      where: { id: master.id },
      data: { diagramPath: saved.path, diagramUrl: saved.url || saved.sharePointUrl || null },
    });
    res.json(row);
  }
);

function csvEscape(v: unknown) {
  const t = String(v ?? "");
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

function isMonitoringHeadingRow(r: {
  itemNo?: string | null;
  uom?: string | null;
  rate?: number | null;
  boqQty?: number | null;
  extraQty?: number | null;
  gfcQty?: number | null;
  achievedQty?: number | null;
}) {
  return (
    !String(r.itemNo || "").trim() &&
    !String(r.uom || "").trim() &&
    !(Number(r.rate) || 0) &&
    !(Number(r.boqQty) || 0) &&
    !(Number(r.extraQty) || 0) &&
    !(Number(r.gfcQty) || 0) &&
    !(Number(r.achievedQty) || 0)
  );
}

function monitoringExportKind(r: {
  itemNo?: string | null;
  uom?: string | null;
  rate?: number | null;
  boqQty?: number | null;
  extraQty?: number | null;
  gfcQty?: number | null;
  achievedQty?: number | null;
  section?: string | null;
  description?: string;
}) {
  if (!isMonitoringHeadingRow(r)) return "item";
  const sec = String(r.section || "").trim();
  const desc = String(r.description || "").trim();
  if (sec.includes(" › ") || (sec && desc && sec !== desc)) return "subsection";
  return "section";
}

function cashflowExportKind(packageName: string | null | undefined) {
  if (/^Forecast/i.test(packageName || "")) return "forecast";
  if (/^Tracking/i.test(packageName || "")) return "tracking";
  return "chart";
}

function budgetExportKind(r: {
  remarks?: string | null;
  budgetedAmount?: number | null;
  workOrderAmount?: number | null;
  certifiedAmount?: number | null;
  grossTotal?: number | null;
}) {
  const emptyAmt =
    !(Number(r.budgetedAmount) || 0) &&
    !(Number(r.workOrderAmount) || 0) &&
    !(Number(r.certifiedAmount) || 0) &&
    !(Number(r.grossTotal) || 0);
  if (emptyAmt && /heading/i.test(String(r.remarks || ""))) return "heading";
  return "item";
}

async function buildCostDownload(kind: string, projectId: string, pkg: string) {
  const where = { projectId, ...(pkg ? { packageName: pkg } : {}) };

  if (kind === "monitoring" || kind === "boq") {
    const rows = await prisma.costMonitoringLine.findMany({
      where,
      orderBy: [{ packageName: "asc" }, { section: "asc" }, { itemNo: "asc" }],
    });
    return {
      title: "BOQ / Monitoring",
      filename: `BOQ-${pkg || "all"}`,
      headers: [
        "Package",
        "Row kind",
        "Section",
        "ITEM NO.",
        "Item of Work",
        "UOM",
        "RATE",
        "BOQ Qty",
        "Extra Items Qty",
        "GFC Qty",
        "Achieved Qty",
        "Excess Qty",
        "Saving Qty",
        "Certified Qty",
        "BOQ Cost",
        "Extra Item Cost",
        "GFC Cost",
        "Achieved Cost",
        "Excess Cost",
        "Saving Cost",
        "Certified Invoice Cost",
        "% Progress BOQ",
        "% Progress GFC",
        "% Progress Achieved",
        "% Progress Certified",
        "EV BOQ",
        "EV GFC",
        "EV Certified",
        "AC",
        "CPI",
        "CPI Status",
        "ETC BOQ",
        "ETC GFC",
        "ETC Certified",
        "EAC",
        "VAC",
        "Var BOQ vs GFC",
        "Var GFC vs Achieved",
        "Var GFC vs Certified",
        "Overrun BOQ",
        "Overrun GFC",
        "Overrun Certified",
      ],
      rows: rows.map((r) => [
        r.packageName,
        monitoringExportKind(r),
        r.section,
        r.itemNo,
        r.description,
        r.uom,
        r.rate,
        r.boqQty,
        r.extraQty,
        r.gfcQty,
        r.achievedQty,
        r.excessQty,
        r.savingQty,
        r.certifiedQty,
        r.boqCost,
        r.extraItemCost,
        r.gfcCost,
        r.achievedCost,
        r.excessCost,
        r.savingCost,
        r.certifiedInvoiceCost,
        r.pctBoq,
        r.pctGfc,
        r.pctAchieved,
        r.pctCertified,
        r.evBoq,
        r.evGfc,
        r.evCertified,
        r.actualCost,
        r.cpi,
        r.cpiStatus,
        r.etcBoq,
        r.etcGfc,
        r.etcCertified,
        r.eac,
        r.vac,
        r.varBoqGfc,
        r.varGfcAchieved,
        r.varGfcCertified,
        r.overrunBoq,
        r.overrunGfc,
        r.overrunCertified,
      ]),
    };
  }

  if (kind === "mb") {
    const rows = await prisma.costMbLine.findMany({
      where,
      orderBy: [{ packageName: "asc" }, { lineIndex: "asc" }, { srNo: "asc" }],
    });
    return {
      title: "Measurement Book",
      filename: `MB-${pkg || "all"}`,
      headers: ["Package", "Row kind", "Sr No.", "Description", "No", "No", "Length", "Width", "Height", "Qty.", "UoM.", "RA Bill", "Remark"],
      rows: rows.map((r) => [
        r.packageName,
        r.rowKind,
        r.srNo,
        r.description,
        r.nos1,
        r.nos2,
        r.length,
        r.width,
        r.height,
        r.qty,
        r.unit,
        r.raBill,
        r.remark,
      ]),
    };
  }

  if (kind === "bbs") {
    const rows = await prisma.costBbsLine.findMany({
      where,
      orderBy: [{ packageName: "asc" }, { lineIndex: "asc" }, { barMark: "asc" }],
    });
    return {
      title: "Bar Bending Schedule",
      filename: `BBS-${pkg || "all"}`,
      headers: [
        "Package",
        "Row kind",
        "SR NO",
        "Description",
        "Shape of bar (diagram URL)",
        "DIA",
        "No per member",
        "No of member",
        "Total nos",
        "Shape A",
        "Shape B",
        "Shape C",
        "Shape D",
        "Shape E",
        "Cutting Length",
        "Total LENGTH",
        "Weight kg",
      ],
      rows: rows.map((r) => [
        r.packageName,
        r.rowKind,
        r.barMark,
        r.location,
        r.shapeDiagramUrl || r.shapeDiagramPath || "",
        r.diameterMm,
        r.nosPerMember,
        r.nosOfMember,
        r.nos,
        r.shapeLenA,
        r.shapeLenB,
        r.shapeLenC,
        r.shapeLenD,
        r.shapeLenE,
        r.lengthMm,
        r.totalLength,
        r.weightKg,
      ]),
    };
  }

  if (kind === "budget") {
    const rows = await prisma.costBudgetLine.findMany({ where: { projectId } });
    return {
      title: "Budget WBS",
      filename: "Budget-WBS",
      headers: [
        "Sr",
        "Row kind",
        "Description",
        "Stakeholder",
        "Budgeted",
        "WO",
        "Certified",
        "Forecast Addition",
        "Forecast Reduction",
        "Non-tendered",
        "Steel Excess",
        "Steel Saving",
        "Cement Excess",
        "Cement Saving",
        "Tiles Excess",
        "Tiles Saving",
        "Gross Total",
        "Remarks",
      ],
      rows: rows.map((r) => [
        r.srNo,
        budgetExportKind(r),
        r.description,
        r.stakeholder,
        r.budgetedAmount,
        r.workOrderAmount,
        r.certifiedAmount,
        r.forecastedAmount,
        r.forecastReduction,
        r.nonTendered,
        r.steelExcess,
        r.steelSaving,
        r.cementExcess,
        r.cementSaving,
        r.tilesExcess,
        r.tilesSaving,
        r.grossTotal,
        r.remarks,
      ]),
    };
  }

  if (kind === "cashflow") {
    const rows = await prisma.costCashflowPeriod.findMany({ where: { projectId } });
    return {
      title: "Cashflow Dashboard",
      filename: "Cashflow",
      headers: ["Period", "Sheet kind", "Package / sheet", "Planned", "Actual", "Variance", "Progress"],
      rows: rows.map((r) => [
        r.periodLabel,
        cashflowExportKind(r.packageName),
        r.packageName,
        r.plannedAmount,
        r.actualAmount,
        (r.actualAmount || 0) - (r.plannedAmount || 0),
        r.progressPct,
      ]),
    };
  }

  if (kind === "rates") {
    const rows = await prisma.costRateDifference.findMany({ where: { projectId } });
    return {
      title: "Rate difference",
      filename: "Rate-difference",
      headers: ["Material", "Description", "Vendor", "Purchase No", "Qty", "Basic", "Purchase", "Excess", "Saving"],
      rows: rows.map((r) => [
        r.materialType,
        r.description,
        r.vendorName,
        r.purchaseNo,
        r.qty,
        r.basicRate,
        r.purchaseRate,
        r.excessAmount,
        r.savingAmount,
      ]),
    };
  }

  return null;
}

costRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const pkg = String(req.query.package || "").trim();
  const monWhere = { projectId, ...(pkg ? { packageName: pkg } : {}) };
  const mbWhere = { projectId, ...(pkg ? { packageName: pkg } : {}) };
  const bbsWhere = { projectId, ...(pkg ? { packageName: pkg } : {}) };

  const [budget, monitoring, cashflow, rateDiffs, boqBatches, mbLines, bbsLines, monPkgs, mbPkgs, bbsPkgs] =
    await Promise.all([
      prisma.costBudgetLine.findMany({ where: { projectId } }),
      prisma.costMonitoringLine.findMany({
        where: monWhere,
        take: 8000,
        orderBy: [{ packageName: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.costCashflowPeriod.findMany({ where: { projectId }, orderBy: { periodLabel: "asc" } }),
      prisma.costRateDifference.findMany({ where: { projectId } }),
      prisma.boqImportBatch.findMany({
        where: { projectId },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.costMbLine.findMany({
        where: mbWhere,
        take: 8000,
        orderBy: [{ packageName: "asc" }, { lineIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.costBbsLine.findMany({
        where: bbsWhere,
        take: 8000,
        orderBy: [{ packageName: "asc" }, { lineIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.costMonitoringLine.groupBy({ by: ["packageName"], where: { projectId }, _count: true }),
      prisma.costMbLine.groupBy({ by: ["packageName"], where: { projectId }, _count: true }),
      prisma.costBbsLine.groupBy({ by: ["packageName"], where: { projectId }, _count: true }),
    ]);

  const budgeted = budget.reduce((s, b) => s + b.budgetedAmount, 0);
  const certified = budget.reduce((s, b) => s + b.certifiedAmount, 0);
  const workOrder = budget.reduce((s, b) => s + b.workOrderAmount, 0);
  const chartCf = cashflow.filter((c) => /chart|project cashflow/i.test(c.packageName || ""));
  const planned = (chartCf.length ? chartCf : cashflow).reduce((s, c) => s + c.plannedAmount, 0);
  const actual = (chartCf.length ? chartCf : cashflow).reduce((s, c) => s + c.actualAmount, 0);

  const mbByPackage: Record<string, { lines: number; qty: number }> = {};
  for (const m of mbLines) {
    const k = m.packageName || "Other";
    if (!mbByPackage[k]) mbByPackage[k] = { lines: 0, qty: 0 };
    mbByPackage[k].lines += 1;
    mbByPackage[k].qty += m.qty || 0;
  }
  const bbsByPackage: Record<string, { lines: number; weightKg: number }> = {};
  for (const b of bbsLines) {
    const k = b.packageName || "Other";
    if (!bbsByPackage[k]) bbsByPackage[k] = { lines: 0, weightKg: 0 };
    bbsByPackage[k].lines += 1;
    bbsByPackage[k].weightKg += b.weightKg || 0;
  }
  const monByPackage: Record<string, number> = {};
  for (const g of monPkgs) monByPackage[g.packageName] = g._count;
  for (const g of mbPkgs) {
    if (!mbByPackage[g.packageName]) mbByPackage[g.packageName] = { lines: g._count, qty: 0 };
  }
  for (const g of bbsPkgs) {
    if (!bbsByPackage[g.packageName]) bbsByPackage[g.packageName] = { lines: g._count, weightKg: 0 };
  }

  const packages = [
    ...new Set([
      ...monPkgs.map((m) => m.packageName),
      ...mbPkgs.map((m) => m.packageName),
      ...bbsPkgs.map((b) => b.packageName),
    ]),
  ].filter(Boolean);

  const { getFinanceCostBridge } = await import("../modules/finance/costBridge.js");
  const financeBridge = await getFinanceCostBridge(projectId);

  const sheetTools = {
    sources: ["Cashflow - Dashboard.xlsx", "SPDC_Budget_Arvind 49.xls", "Payment Summary - VIATRIX - Copy.xlsx"],
    cashflow: CASHFLOW_SHEET_TOOLS,
    budget: { label: "Budget WBS", rows: budget.length },
    monitoring: monPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    mb: mbPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    bbs: bbsPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    rates: { rows: rateDiffs.length },
  };

  const structureNames = new Set<string>();
  for (const p of packages) structureNames.add(p);
  for (const m of sheetTools.monitoring) if (m.packageName) structureNames.add(m.packageName);
  const structures = [...structureNames].sort().map((name) => ({
    packageName: name,
    monitoringRows: monByPackage[name] || 0,
    mbRows: mbByPackage[name]?.lines || 0,
    mbQty: mbByPackage[name]?.qty || 0,
    bbsRows: bbsByPackage[name]?.lines || 0,
    bbsWeightKg: bbsByPackage[name]?.weightKg || 0,
  }));

  res.json({
    totals: {
      budgeted,
      certified,
      workOrder,
      planned,
      actual,
      variance: planned - actual,
      mbLines: mbPkgs.reduce((s, g) => s + g._count, 0),
      bbsLines: bbsPkgs.reduce((s, g) => s + g._count, 0),
      mbQty: mbLines.reduce((s, m) => s + (m.qty || 0), 0),
      bbsWeightKg: bbsLines.reduce((s, b) => s + (b.weightKg || 0), 0),
      monitoringLines: monPkgs.reduce((s, g) => s + g._count, 0),
      financeCopPayable: financeBridge.finance.copPayable,
      financeCopCertified: financeBridge.finance.copCertified,
    },
    financeBridge,
    packages,
    monByPackage,
    mbByPackage,
    bbsByPackage,
    sheetTools,
    structures,
    activePackage: pkg || null,
    budget,
    monitoring,
    cashflow,
    cashflowChart: cashflow.filter(
      (c) => /chart|project cashflow \(chart\)|^COP/i.test(c.packageName || "")
    ),
    cashflowForecast: cashflow.filter((c) => /^Forecast/i.test(c.packageName || "")),
    cashflowTracking: cashflow.filter((c) => /^Tracking/i.test(c.packageName || "")),
    rateDiffs,
    boqBatches: boqBatches.map((b) => ({
      ...b,
      meta: parseBatchMeta(b.summaryJson),
    })),
    sheetFiles: boqBatches
      .map((b) => ({ ...b, meta: parseBatchMeta(b.summaryJson) }))
      .filter((b) => ["bbs", "mb", "bbs_shape"].includes(String(b.meta.kind || "")))
      .map((b) => ({
        id: b.id,
        kind: b.meta.kind,
        packageName: b.meta.packageName,
        fileName: b.fileName,
        rowCount: b.rowCount,
        storagePath: b.meta.storagePath,
        shareUrl: b.meta.shareUrl,
        provider: b.meta.provider,
        barMark: b.meta.barMark,
        createdAt: b.createdAt,
      })),
    mbLines,
    bbsLines,
  });
});

/** Download BOQ / monitoring / MB / BBS / cashflow — CSV or XLSX, scoped to projectId (+ optional package). */
async function sendCostDownload(req: AuthedRequest, res: import("express").Response, fmt: "csv" | "xlsx") {
  const projectId = req.params.projectId;
  const kind = req.params.kind;
  const pkg = String(req.query.package || "").trim();
  const pack = await buildCostDownload(kind, projectId, pkg);
  if (!pack) {
    return res.status(400).json({ error: "Unknown kind — use monitoring|boq|mb|bbs|budget|cashflow|rates" });
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (fmt === "xlsx") {
    const buf = workbookBuffer([{ name: pack.title.slice(0, 31), rows: [pack.headers, ...pack.rows] }], {
      title: pack.title,
      projectCode: project?.code || projectId,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${pack.filename}.xlsx"`);
    return res.send(buf);
  }
  const csv = toCsv(pack.headers, pack.rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${pack.filename}.csv"`);
  return res.send(csv);
}

costRouter.get("/:projectId/download/:kind.csv", async (req: AuthedRequest, res) => {
  await sendCostDownload(req, res, "csv");
});

costRouter.get("/:projectId/download/:kind.xlsx", async (req: AuthedRequest, res) => {
  await sendCostDownload(req, res, "xlsx");
});

costRouter.post(
  "/:projectId/boq/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const { isFullSpdcWorkbook } = await import("../services/costSheetParser.js");
    const { syncBudgetWorkbookFromBuffer } = await import("../services/budgetWorkbookImport.js");
    if (
      isFullSpdcWorkbook(req.file.buffer) ||
      /spdc_budget|budget_arvind|arvind.*49/i.test(req.file.originalname || "")
    ) {
      try {
        const out = await syncBudgetWorkbookFromBuffer(req.params.projectId, req.file.buffer, req.file.originalname);
        await audit("cost.boq_import.full_workbook", {
          userId: req.user!.id,
          entity: "Project",
          entityId: req.params.projectId,
          meta: out,
        });
        return res.status(201).json({
          ...out,
          rowCount: out.monitoring,
          openTab: "monitoring",
          openPackage: "Civil Dormitory",
        });
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : "Full workbook import failed" });
      }
    }
    const rows = parseBoqBuffer(req.file.buffer);
    const batch = await prisma.boqImportBatch.create({
      data: {
        projectId: req.params.projectId,
        fileName: req.file.originalname,
        rowCount: rows.length,
        summaryJson: JSON.stringify({
          items: rows.filter((r) => r.rowKind === "item").length,
          sections: rows.filter((r) => r.rowKind === "section").length,
          totalAmount: rows.reduce((s, r) => s + r.amount, 0),
        }),
        items: {
          create: rows.map((r) => ({
            srNo: r.srNo,
            description: r.description,
            section: r.section,
            qty: r.qty,
            rate: r.rate,
            unit: r.unit,
            amount: r.amount,
            costCode: r.costCode,
            rowKind: r.rowKind,
          })),
        },
      },
      include: { items: true },
    });

    // Also push item rows into monitoring if empty-ish
    for (const r of rows.filter((x) => x.rowKind === "item").slice(0, 200)) {
      await prisma.costMonitoringLine.create({
        data: {
          projectId: req.params.projectId,
          section: r.section || null,
          itemNo: r.srNo,
          description: r.description,
          uom: r.unit,
          rate: r.rate,
          boqQty: r.qty,
          boqCost: r.amount,
        },
      });
    }

    await audit("cost.boq_import", {
      userId: req.user!.id,
      entity: "BoqImportBatch",
      entityId: batch.id,
      meta: { rowCount: rows.length },
    });
    res.status(201).json(batch);
  }
);

costRouter.get("/:projectId/boq/:batchId", async (req, res) => {
  const batch = await prisma.boqImportBatch.findFirst({
    where: { id: req.params.batchId, projectId: req.params.projectId },
    include: { items: true },
  });
  if (!batch) return res.status(404).json({ error: "Not found" });
  res.json(batch);
});

costRouter.post("/:projectId/budget", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const body = req.body || {};
  const line = await prisma.costBudgetLine.create({
    data: {
      projectId: req.params.projectId,
      srNo: body.srNo ? String(body.srNo) : null,
      description: String(body.description || "New budget line"),
      stakeholder: body.stakeholder ? String(body.stakeholder) : null,
      budgetedAmount: Number(body.budgetedAmount || 0),
      workOrderAmount: Number(body.workOrderAmount || 0),
      certifiedAmount: Number(body.certifiedAmount || 0),
      forecastedAmount: Number(body.forecastedAmount || 0),
      forecastReduction: Number(body.forecastReduction || 0),
      nonTendered: Number(body.nonTendered || 0),
      steelExcess: Number(body.steelExcess || 0),
      steelSaving: Number(body.steelSaving || 0),
      cementExcess: Number(body.cementExcess || 0),
      cementSaving: Number(body.cementSaving || 0),
      tilesExcess: Number(body.tilesExcess || 0),
      tilesSaving: Number(body.tilesSaving || 0),
      grossTotal: Number(body.grossTotal || 0),
      remarks: body.remarks ? String(body.remarks) : null,
    },
  });
  res.status(201).json(line);
});

costRouter.patch("/:projectId/budget/:lineId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costBudgetLine.findFirst({
    where: { id: req.params.lineId, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  const num = (k: string) => (body[k] != null ? Number(body[k]) : undefined);
  const line = await prisma.costBudgetLine.update({
    where: { id: existing.id },
    data: {
      ...(body.srNo !== undefined ? { srNo: body.srNo ? String(body.srNo) : null } : {}),
      ...(body.description != null ? { description: String(body.description) } : {}),
      ...(body.stakeholder !== undefined ? { stakeholder: body.stakeholder ? String(body.stakeholder) : null } : {}),
      ...(num("budgetedAmount") != null ? { budgetedAmount: num("budgetedAmount")! } : {}),
      ...(num("workOrderAmount") != null ? { workOrderAmount: num("workOrderAmount")! } : {}),
      ...(num("certifiedAmount") != null ? { certifiedAmount: num("certifiedAmount")! } : {}),
      ...(num("forecastedAmount") != null ? { forecastedAmount: num("forecastedAmount")! } : {}),
      ...(num("forecastReduction") != null ? { forecastReduction: num("forecastReduction")! } : {}),
      ...(num("nonTendered") != null ? { nonTendered: num("nonTendered")! } : {}),
      ...(num("steelExcess") != null ? { steelExcess: num("steelExcess")! } : {}),
      ...(num("steelSaving") != null ? { steelSaving: num("steelSaving")! } : {}),
      ...(num("cementExcess") != null ? { cementExcess: num("cementExcess")! } : {}),
      ...(num("cementSaving") != null ? { cementSaving: num("cementSaving")! } : {}),
      ...(num("tilesExcess") != null ? { tilesExcess: num("tilesExcess")! } : {}),
      ...(num("tilesSaving") != null ? { tilesSaving: num("tilesSaving")! } : {}),
      ...(num("grossTotal") != null ? { grossTotal: num("grossTotal")! } : {}),
      ...(body.remarks !== undefined ? { remarks: body.remarks ? String(body.remarks) : null } : {}),
    },
  });
  res.json(line);
});

costRouter.delete("/:projectId/budget/:lineId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costBudgetLine.findFirst({
    where: { id: req.params.lineId, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.costBudgetLine.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

/** Load full SPDC_Budget_Arvind workbook (Budget + Monitoring + MB + BBS + rates) like QAP/Cube sync-template. */
costRouter.get("/:projectId/verify", requireRoles("admin", "office", "employee"), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const { verifyCostProject } = await import("../services/costWorkbookVerify.js");
  const report = await verifyCostProject(project.id);
  res.json(report);
});

costRouter.post(
  "/:projectId/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    try {
      const { syncBudgetWorkbookTemplate } = await import("../services/budgetWorkbookImport.js");
      const out = await syncBudgetWorkbookTemplate(req.params.projectId);
      res.json(out);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Budget sync failed" });
    }
  }
);

/** Import all MB and/or BBS sheets from SPDC_Budget_Arvind workbook (multi-tab). */
costRouter.post(
  "/:projectId/workbook/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "project not found" });
    if (!req.file) return res.status(400).json({ error: "file required (.xlsx / .xls)" });

    const kind = String(req.body.kind || "all").toLowerCase();
    const replace = String(req.body.replace || "") === "1" || req.body.replace === true;
    const importMb = kind === "all" || kind === "mb";
    const importBbs = kind === "all" || kind === "bbs";

    if (!isFullSpdcWorkbook(req.file.buffer) && kind === "all") {
      return res.status(400).json({
        error: "Upload SPDC_Budget_Arvind 49.xls (Budget + Monitoring + MB + BBS tabs), or use MB/BBS tab upload for a single sheet.",
      });
    }

    if (isFullSpdcWorkbook(req.file.buffer) && kind === "all") {
      const { syncBudgetWorkbookFromBuffer } = await import("../services/budgetWorkbookImport.js");
      const out = await syncBudgetWorkbookFromBuffer(req.params.projectId, req.file.buffer, req.file.originalname);
      return res.status(201).json({
        ...out,
        mbImported: out.mb,
        bbsImported: out.bbs,
        openTab: "monitoring",
        openPackage: "Civil Dormitory",
      });
    }

    const mbSheets = importMb ? parseAllMbSheets(req.file.buffer) : [];
    const bbsSheets = importBbs ? parseAllBbsSheets(req.file.buffer) : [];
    if (!mbSheets.length && !bbsSheets.length) {
      return res.status(400).json({ error: "No MB/BBS sheets found — check SPDC workbook tab names." });
    }

    if (replace) {
      if (importMb) await prisma.costMbLine.deleteMany({ where: { projectId: project.id } });
      if (importBbs) await prisma.costBbsLine.deleteMany({ where: { projectId: project.id } });
    }

    let mbImported = 0;
    let bbsImported = 0;
    const packagesImported: string[] = [];

    for (const batch of mbSheets) {
      if (!replace) {
        await prisma.costMbLine.deleteMany({ where: { projectId: project.id, packageName: batch.packageName } });
      }
      await prisma.costMbLine.createMany({
        data: batch.lines.map((r, lineIndex) => ({
          projectId: project.id,
          packageName: batch.packageName,
          srNo: r.srNo || null,
          itemCode: r.itemCode || r.srNo || null,
          description: r.description,
          nos1: r.nos1,
          nos2: r.nos2,
          length: r.length,
          width: r.width,
          height: r.height,
          qty: r.qty,
          unit: r.unit || null,
          raBill: r.raBill || null,
          remark: r.remark || null,
          rowKind: r.rowKind || "data",
          lineIndex,
        })),
      });
      mbImported += batch.lines.length;
      packagesImported.push(batch.packageName);
      const { syncAchievedFromMb } = await import("../services/costQuantitySync.js");
      await syncAchievedFromMb(project.id, batch.packageName);
    }

    for (const batch of bbsSheets) {
      const linesToImport = batch.lines.filter(
        (r) =>
          (r.rowKind && r.rowKind !== "data") ||
          r.diameterMm >= 6 ||
          r.totalLength > 0 ||
          r.weightKg > 0 ||
          (r.nos ?? 0) > 0
      );
      if (!linesToImport.length) continue;
      if (!replace) {
        await prisma.costBbsLine.deleteMany({ where: { projectId: project.id, packageName: batch.packageName } });
      }
      await prisma.costBbsLine.createMany({
        data: linesToImport.map((r, lineIndex) => ({
          projectId: project.id,
          packageName: batch.packageName,
          barMark: r.barMark || null,
          shapeCode: r.shapeCode || null,
          itemCode: r.itemCode || null,
          sectionMark: r.sectionMark || null,
          diameterMm: r.diameterMm || 0,
          shape: r.shape || null,
          lengthMm: r.lengthMm || 0,
          nos: r.nos || 0,
          nosPerMember: r.nosPerMember || 0,
          nosOfMember: r.nosOfMember || 0,
          shapeLenA: r.shapeLenA || 0,
          shapeLenB: r.shapeLenB || 0,
          shapeLenC: r.shapeLenC || 0,
          shapeLenD: r.shapeLenD || 0,
          shapeLenE: r.shapeLenE || 0,
          totalLength: r.totalLength || 0,
          weightKg: r.weightKg || 0,
          location: r.location || null,
          rowKind: r.rowKind || "data",
          lineIndex,
        })),
      });
      bbsImported += linesToImport.length;
      packagesImported.push(batch.packageName);
      const { applyShapeMastersToBbs } = await import("../services/costQuantitySync.js");
      await applyShapeMastersToBbs(project.id, batch.packageName);
    }

    const saved = await mockOneDrive.upload(
      project.code,
      `${MODULE_TO_ISO_FOLDER.boq}/workbooks`,
      `${Date.now()}-${req.file.originalname}`,
      req.file.buffer
    );

    const batch = await prisma.boqImportBatch.create({
      data: {
        projectId: project.id,
        fileName: req.file.originalname,
        rowCount: mbImported + bbsImported,
        summaryJson: JSON.stringify({
          kind: "workbook_mb_bbs",
          mbSheets: mbSheets.map((s) => ({ sheet: s.sheetName, package: s.packageName, rows: s.lines.length })),
          bbsSheets: bbsSheets.map((s) => ({ sheet: s.sheetName, package: s.packageName, rows: s.lines.length })),
          storagePath: saved.path,
          replace,
        }),
      },
    });

    await audit("cost.workbook_import", {
      userId: req.user!.id,
      entity: "BoqImportBatch",
      entityId: batch.id,
      meta: { mbImported, bbsImported, packages: packagesImported },
    });

    res.status(201).json({
      ok: true,
      mbImported,
      bbsImported,
      mbSheets: mbSheets.length,
      bbsSheets: bbsSheets.length,
      packages: [...new Set(packagesImported)],
    });
  }
);

costRouter.post("/:projectId/cashflow", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const sheet = String(req.body.sheetKind || req.body.packageName || "chart").trim();
  const extra = req.body.structure ? String(req.body.structure) : "";
  const packageName = /^Forecast/i.test(sheet)
    ? sheet.startsWith("Forecast")
      ? sheet
      : `Forecast · ${extra || "Structure"}`
    : /^Tracking/i.test(sheet)
      ? sheet.startsWith("Tracking")
        ? sheet
        : `Tracking · ${extra || "Work"}`
      : sheet === "forecast"
        ? `Forecast · ${extra || "Structure"}`
        : sheet === "tracking"
          ? `Tracking · ${extra || "Work"}`
          : extra || String(req.body.packageName || "Project cashflow (Chart)");
  const row = await prisma.costCashflowPeriod.create({
    data: {
      projectId: req.params.projectId,
      periodLabel: String(req.body.periodLabel || "New period"),
      periodDate: req.body.periodDate ? new Date(req.body.periodDate) : null,
      packageName,
      plannedAmount: Number(req.body.plannedAmount || 0),
      actualAmount: Number(req.body.actualAmount || 0),
      progressPct: Number(req.body.progressPct || 0),
    },
  });
  res.status(201).json(row);
});

costRouter.post("/:projectId/rate-diff", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const basic = Number(req.body.basicRate || 0);
  const purchase = Number(req.body.purchaseRate || 0);
  const qty = Number(req.body.qty || 0);
  const basicAmt = basic * qty;
  const purchaseAmt = purchase * qty;
  const diff = purchaseAmt - basicAmt;
  const row = await prisma.costRateDifference.create({
    data: {
      projectId: req.params.projectId,
      materialType: req.body.materialType || "Steel",
      description: req.body.description,
      vendorName: req.body.vendorName,
      purchaseNo: req.body.purchaseNo,
      qty,
      basicRate: basic,
      purchaseRate: purchase,
      excessAmount: diff > 0 ? diff : 0,
      savingAmount: diff < 0 ? Math.abs(diff) : 0,
    },
  });
  res.status(201).json(row);
});

/** COP / bill tracker — vendor bill entries (client video) */
costRouter.get("/:projectId/bills", async (req, res) => {
  const bills = await prisma.vendorBill.findMany({
    where: { projectId: req.params.projectId },
    include: { vendor: { select: { id: true, name: true, trade: true } } },
    orderBy: { billDate: "desc" },
  });
  const totals = {
    count: bills.length,
    amount: bills.reduce((s, b) => s + b.amount, 0),
    certified: bills.filter((b) => b.status === "Certified" || b.status === "Paid").reduce((s, b) => s + b.amount, 0),
    pending: bills
      .filter((b) => ["Draft", "Submitted", "Under review"].includes(b.status))
      .reduce((s, b) => s + b.amount, 0),
  };
  res.json({ bills, totals });
});

costRouter.post("/:projectId/bills", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const bill = await prisma.vendorBill.create({
    data: {
      projectId: req.params.projectId,
      vendorId: req.body.vendorId || null,
      vendorName: req.body.vendorName || "Vendor",
      billNo: req.body.billNo,
      billDate: req.body.billDate ? new Date(req.body.billDate) : new Date(),
      amount: Number(req.body.amount || 0),
      gstAmount: Number(req.body.gstAmount || 0),
      status: req.body.status || "Draft",
      copNo: req.body.copNo || null,
      description: req.body.description || null,
      attachmentUrl: req.body.attachmentUrl || null,
      createdById: req.user!.id,
    },
  });
  await audit("cost.bill.create", { userId: req.user!.id, entity: "VendorBill", entityId: bill.id });
  res.status(201).json(bill);
});

costRouter.patch("/:projectId/bills/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.vendorBill.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const bill = await prisma.vendorBill.update({
    where: { id: existing.id },
    data: {
      status: req.body.status,
      copNo: req.body.copNo,
      amount: req.body.amount != null ? Number(req.body.amount) : undefined,
      description: req.body.description,
    },
  });
  res.json(bill);
});

costRouter.delete("/:projectId/bills/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.vendorBill.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.vendorBill.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

costRouter.patch("/:projectId/cashflow/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costCashflowPeriod.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  const row = await prisma.costCashflowPeriod.update({
    where: { id: existing.id },
    data: {
      ...(body.periodLabel != null ? { periodLabel: String(body.periodLabel) } : {}),
      ...(body.periodDate !== undefined ? { periodDate: body.periodDate ? new Date(body.periodDate) : null } : {}),
      ...(body.packageName != null ? { packageName: String(body.packageName) } : {}),
      ...(body.plannedAmount != null ? { plannedAmount: Number(body.plannedAmount) } : {}),
      ...(body.actualAmount != null ? { actualAmount: Number(body.actualAmount) } : {}),
      ...(body.progressPct != null ? { progressPct: Number(body.progressPct) } : {}),
    },
  });
  res.json(row);
});

costRouter.delete("/:projectId/cashflow/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costCashflowPeriod.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.costCashflowPeriod.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

costRouter.patch("/:projectId/rate-diff/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costRateDifference.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  const qty = body.qty != null ? Number(body.qty) : existing.qty;
  const basic = body.basicRate != null ? Number(body.basicRate) : existing.basicRate;
  const purchase = body.purchaseRate != null ? Number(body.purchaseRate) : existing.purchaseRate;
  const basicAmt = basic * qty;
  const purchaseAmt = purchase * qty;
  const diff = purchaseAmt - basicAmt;
  const row = await prisma.costRateDifference.update({
    where: { id: existing.id },
    data: {
      ...(body.materialType != null ? { materialType: String(body.materialType) } : {}),
      ...(body.description != null ? { description: String(body.description) } : {}),
      ...(body.vendorName !== undefined ? { vendorName: body.vendorName ? String(body.vendorName) : null } : {}),
      ...(body.purchaseNo !== undefined ? { purchaseNo: body.purchaseNo ? String(body.purchaseNo) : null } : {}),
      qty,
      basicRate: basic,
      purchaseRate: purchase,
      excessAmount: diff > 0 ? diff : 0,
      savingAmount: diff < 0 ? Math.abs(diff) : 0,
    },
  });
  res.json(row);
});

costRouter.delete("/:projectId/rate-diff/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costRateDifference.findFirst({
    where: { id: req.params.id, projectId: req.params.projectId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.costRateDifference.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

costRouter.post("/:projectId/mb", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const rowKindRaw = String(req.body.rowKind || "data").trim().toLowerCase();
  const rowKind = MB_ROW_KINDS.has(rowKindRaw) ? rowKindRaw : "data";
  const isMeasure = rowKind === "data";
  const nos1 = isMeasure ? Number(req.body.nos1 || 0) : 0;
  const nos2 = isMeasure ? Number(req.body.nos2 || 1) || 1 : 0;
  const length = isMeasure ? Number(req.body.length || 0) : 0;
  const width = isMeasure ? Number(req.body.width || 0) : 0;
  const height = isMeasure ? Number(req.body.height || 0) : 0;
  const qty = isMeasure
    ? Number(req.body.qty || nos1 * nos2 * (length || 1) * (width || 1) * (height || 1))
    : Number(req.body.qty || 0);
  const packageName = String(req.body.packageName || "Civil");
  const lineIndex = await nextMbLineIndex(req.params.projectId, packageName);
  const row = await prisma.costMbLine.create({
    data: {
      projectId: req.params.projectId,
      packageName,
      srNo: req.body.srNo || null,
      description: String(req.body.description || (rowKind === "data" ? "MB line" : "New heading")),
      nos1,
      nos2,
      length,
      width,
      height,
      qty,
      unit: req.body.unit || null,
      raBill: req.body.raBill || null,
      remark: req.body.remark || null,
      rowKind,
      lineIndex,
    },
  });
  res.status(201).json(row);
});

costRouter.post("/:projectId/bbs", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const packageName = String(req.body.packageName || "BBS");
  const computed = bbsLineCompute(req.body || {});
  const rowKind = computed.rowKind || "data";
  const lineIndex = await nextBbsLineIndex(req.params.projectId, packageName);
  const row = await prisma.costBbsLine.create({
    data: {
      projectId: req.params.projectId,
      packageName,
      barMark: req.body.barMark ? String(req.body.barMark) : null,
      shapeCode: req.body.shapeCode ? String(req.body.shapeCode).toUpperCase() : req.body.shape ? String(req.body.shape).toUpperCase() : null,
      itemCode: req.body.itemCode ? String(req.body.itemCode) : null,
      sectionMark: req.body.sectionMark ? String(req.body.sectionMark) : null,
      diameterMm: computed.diameterMm,
      shape: req.body.shape ? String(req.body.shape) : null,
      lengthMm: computed.lengthMm,
      nos: computed.nos,
      nosPerMember: computed.nosPerMember,
      nosOfMember: computed.nosOfMember,
      shapeLenA: computed.shapeLenA,
      shapeLenB: computed.shapeLenB,
      shapeLenC: computed.shapeLenC,
      shapeLenD: computed.shapeLenD,
      shapeLenE: computed.shapeLenE,
      totalLength: computed.totalLength,
      weightKg: computed.weightKg,
      location: req.body.location ? String(req.body.location) : null,
      rowKind,
      lineIndex,
    },
  });
  res.status(201).json(row);
});

costRouter.patch(
  "/:projectId/mb/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMbLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const nos1 = body.nos1 != null ? Number(body.nos1) : existing.nos1;
    const nos2 = body.nos2 != null ? Number(body.nos2) : existing.nos2;
    const length = body.length != null ? Number(body.length) : existing.length;
    const width = body.width != null ? Number(body.width) : existing.width;
    const height = body.height != null ? Number(body.height) : existing.height;
    const rowKindRaw = body.rowKind != null ? String(body.rowKind).trim().toLowerCase() : existing.rowKind;
    const rowKind = MB_ROW_KINDS.has(rowKindRaw) ? rowKindRaw : existing.rowKind;
    const isMeasure = rowKind === "data";
    const qty =
      body.qty != null
        ? Number(body.qty)
        : isMeasure
          ? nos1 * nos2 * (length || 1) * (width || 1) * (height || 1)
          : existing.qty;
    const row = await prisma.costMbLine.update({
      where: { id: existing.id },
      data: {
        ...(body.packageName != null ? { packageName: String(body.packageName) } : {}),
        ...(body.srNo !== undefined ? { srNo: body.srNo ? String(body.srNo) : null } : {}),
        ...(body.description != null ? { description: String(body.description) } : {}),
        nos1,
        nos2,
        length,
        width,
        height,
        qty,
        rowKind,
        ...(body.unit !== undefined ? { unit: body.unit ? String(body.unit) : null } : {}),
        ...(body.raBill !== undefined ? { raBill: body.raBill ? String(body.raBill) : null } : {}),
        ...(body.remark !== undefined ? { remark: body.remark ? String(body.remark) : null } : {}),
        ...(body.itemCode !== undefined ? { itemCode: body.itemCode ? String(body.itemCode) : null } : {}),
      },
    });
    res.json(row);
  }
);

costRouter.delete(
  "/:projectId/mb/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMbLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.costMbLine.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }
);

costRouter.patch(
  "/:projectId/bbs/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costBbsLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const computed = bbsLineCompute(body, existing);
    const row = await prisma.costBbsLine.update({
      where: { id: existing.id },
      data: {
        ...(body.packageName != null ? { packageName: String(body.packageName) } : {}),
        ...(body.barMark !== undefined ? { barMark: body.barMark ? String(body.barMark) : null } : {}),
        ...(body.shapeCode !== undefined ? { shapeCode: body.shapeCode ? String(body.shapeCode).toUpperCase() : null } : {}),
        ...(body.shape !== undefined ? { shape: body.shape ? String(body.shape) : null } : {}),
        ...(body.itemCode !== undefined ? { itemCode: body.itemCode ? String(body.itemCode) : null } : {}),
        ...(body.sectionMark !== undefined ? { sectionMark: body.sectionMark ? String(body.sectionMark) : null } : {}),
        ...(body.location !== undefined ? { location: body.location ? String(body.location) : null } : {}),
        ...(computed.rowKind ? { rowKind: computed.rowKind } : {}),
        diameterMm: computed.diameterMm,
        nos: computed.nos,
        nosPerMember: computed.nosPerMember,
        nosOfMember: computed.nosOfMember,
        lengthMm: computed.lengthMm,
        shapeLenA: computed.shapeLenA,
        shapeLenB: computed.shapeLenB,
        shapeLenC: computed.shapeLenC,
        shapeLenD: computed.shapeLenD,
        shapeLenE: computed.shapeLenE,
        totalLength: computed.totalLength,
        weightKg: computed.weightKg,
      },
    });

    if (body.shapeCode) {
      const master = await prisma.bbsShapeMaster.findUnique({
        where: { shapeCode: String(body.shapeCode).trim().toUpperCase() },
      });
      if (master?.diagramPath || master?.diagramUrl) {
        const linked = await prisma.costBbsLine.update({
          where: { id: row.id },
          data: {
            shapeDiagramPath: master.diagramPath,
            shapeDiagramUrl: master.diagramUrl,
            shape: master.name || row.shape,
          },
        });
        return res.json(linked);
      }
    }

    res.json(row);
  }
);

costRouter.delete(
  "/:projectId/bbs/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costBbsLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.costBbsLine.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }
);

costRouter.post(
  "/:projectId/import-master",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const masterId = String(req.body.masterId || "");
    const kind = String(req.body.kind || "mb") as "mb" | "bbs" | "monitoring";
    const packageName = String(req.body.packageName || "Civil");
    const rowIndexes = Array.isArray(req.body.rowIndexes)
      ? (req.body.rowIndexes as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];

    if (kind === "monitoring") {
      return res.status(400).json({
        error: "BOQ is per-project — use Cost → BOQ tab to upload each structure/package for this project.",
      });
    }

    if (!masterId) return res.status(400).json({ error: "masterId required" });
    if (!rowIndexes.length) return res.status(400).json({ error: "Select at least one line" });

    const master = await prisma.customSheet.findFirst({ where: { id: masterId, projectId: null } });
    if (!master) return res.status(404).json({ error: "Master sheet not found" });

    const headers = JSON.parse(master.headersJson || "[]");
    let rows: import("@sharnam/shared").SheetCell[][] = [];
    try {
      rows = JSON.parse(master.rowsJson || "[]");
    } catch {
      rows = [];
    }

    const { mapMbRow, mapBbsRow, mapMonitoringRow } = await import("../services/costMasterLines.js");
    const picked = rowIndexes.filter((i) => i >= 0 && i < rows.length);
    let imported = 0;

    if (kind === "mb") {
      const lines = picked.map((i) => mapMbRow(headers, rows[i], packageName));
      await prisma.costMbLine.createMany({ data: lines.map((m) => ({ ...m, projectId })) });
      imported = lines.length;
      const { syncAchievedFromMb } = await import("../services/costQuantitySync.js");
      await syncAchievedFromMb(projectId, packageName);
    } else if (kind === "bbs") {
      const lines = picked.map((i) => mapBbsRow(headers, rows[i], packageName));
      await prisma.costBbsLine.createMany({ data: lines.map((m) => ({ ...m, projectId })) });
      imported = lines.length;
      const { applyShapeMastersToBbs } = await import("../services/costQuantitySync.js");
      await applyShapeMastersToBbs(projectId, packageName);
    } else {
      for (const i of picked) {
        await prisma.costMonitoringLine.create({
          data: { ...mapMonitoringRow(headers, rows[i], packageName), projectId },
        });
      }
      imported = picked.length;
    }

    await audit("cost.import_master", {
      userId: req.user!.id,
      entity: "CustomSheet",
      entityId: masterId,
      meta: { projectId, kind, packageName, lines: imported },
    });

    res.status(201).json({ ok: true, imported, kind, packageName });
  }
);

/** Roll up MB qty → monitoring achievedQty (GFC untouched). Optionally apply BBS shape masters. */
costRouter.post(
  "/:projectId/sync-from-sheets",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const packageName = req.body?.packageName ? String(req.body.packageName) : undefined;
    const applyShapes = req.body?.applyShapes !== false;

    const { syncAchievedFromMb, applyShapeMastersToBbs } = await import("../services/costQuantitySync.js");
    const mbSync = await syncAchievedFromMb(projectId, packageName);
    const shapesApplied = applyShapes ? await applyShapeMastersToBbs(projectId, packageName) : 0;

    await audit("cost.sync_from_sheets", {
      userId: req.user!.id,
      entity: "Project",
      entityId: projectId,
      meta: { packageName, mbSync, shapesApplied },
    });

    res.json({ ok: true, mbSync, shapesApplied });
  }
);

costRouter.post(
  "/:projectId/cashflow/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const replace = String(req.body.replace || "") === "1";
    const { parseCashflowBuffer } = await import("../services/cashflowParser.js");
    const parsed = parseCashflowBuffer(req.file.buffer);
    if (!parsed.length) return res.status(400).json({ error: "No cashflow rows parsed" });
    const projectId = req.params.projectId;
    if (replace) await prisma.costCashflowPeriod.deleteMany({ where: { projectId } });
    await prisma.costCashflowPeriod.createMany({
      data: parsed.map((p) => ({ ...p, projectId })),
    });
    res.status(201).json({ ok: true, imported: parsed.length, replace });
  }
);

costRouter.post(
  "/:projectId/budget/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const replace = String(req.body.replace || "") === "1";
    const { parseBudgetBuffer } = await import("../services/cashflowParser.js");
    const parsed = parseBudgetBuffer(req.file.buffer);
    if (!parsed.length) return res.status(400).json({ error: "No budget rows parsed" });
    const projectId = req.params.projectId;
    if (replace) await prisma.costBudgetLine.deleteMany({ where: { projectId } });
    await prisma.costBudgetLine.createMany({
      data: parsed.map((p) => ({ ...p, projectId })),
    });
    res.status(201).json({ ok: true, imported: parsed.length, replace });
  }
);

costRouter.patch(
  "/:projectId/monitoring/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMonitoringLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const body = req.body || {};
    const nextBoq = body.boqQty != null ? Number(body.boqQty) : existing.boqQty;
    const nextGfc = body.gfcQty != null ? Number(body.gfcQty) : existing.gfcQty;
    const nextRate = body.rate != null ? Number(body.rate) : existing.rate;
    const nextExtra = body.extraQty != null ? Number(body.extraQty) : existing.extraQty;
    const nextAchieved = body.achievedQty != null ? Number(body.achievedQty) : existing.achievedQty;
    const nextCertified = body.certifiedQty != null ? Number(body.certifiedQty) : existing.certifiedQty;
    const { deriveMonitoringMetrics } = await import("../services/monitoringMetrics.js");
    const metrics = deriveMonitoringMetrics({
      rate: nextRate,
      boqQty: nextBoq,
      extraQty: nextExtra,
      gfcQty: nextGfc,
      achievedQty: nextAchieved,
      certifiedQty: nextCertified,
    });

    const row = await prisma.costMonitoringLine.update({
      where: { id: existing.id },
      data: {
        ...(body.packageName != null ? { packageName: String(body.packageName) } : {}),
        ...(body.section !== undefined ? { section: body.section ? String(body.section) : null } : {}),
        ...(body.itemNo !== undefined ? { itemNo: body.itemNo ? String(body.itemNo) : null } : {}),
        ...(body.description != null ? { description: String(body.description) } : {}),
        ...(body.uom !== undefined ? { uom: body.uom ? String(body.uom) : null } : {}),
        ...(body.rate != null ? { rate: nextRate } : {}),
        ...(body.boqQty != null ? { boqQty: nextBoq } : {}),
        ...(body.extraQty != null ? { extraQty: nextExtra } : {}),
        ...(body.gfcQty != null ? { gfcQty: nextGfc } : {}),
        ...(body.achievedQty != null ? { achievedQty: nextAchieved } : {}),
        ...(body.certifiedQty != null ? { certifiedQty: nextCertified } : {}),
        ...metrics,
      },
    });
    await audit("cost.monitoring.update", {
      userId: req.user!.id,
      entity: "CostMonitoringLine",
      entityId: row.id,
      meta: { projectId: row.projectId },
    });
    const achieved = row.achievedQty;
    const gfc = row.gfcQty;
    await prisma.progressActivityLine.updateMany({
      where: { projectId: row.projectId, activity: row.description },
      data: {
        executedQty: achieved,
        gfcQty: gfc,
        boqQty: row.boqQty,
        balanceQty: Math.max(0, (gfc || row.boqQty) - achieved),
        pctComplete: gfc > 0 ? Math.min(1.2, achieved / gfc) : 0,
      },
    });
    res.json(row);
  }
);

costRouter.post(
  "/:projectId/monitoring",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const boqQty = Number(body.boqQty || 0);
    const rate = Number(body.rate || 0);
    const gfcQty = Number(body.gfcQty || 0);
    const extraQty = Number(body.extraQty || 0);
    const achievedQty = Number(body.achievedQty || 0);
    const certifiedQty = Number(body.certifiedQty || 0);
    const { deriveMonitoringMetrics } = await import("../services/monitoringMetrics.js");
    const metrics = deriveMonitoringMetrics({ rate, boqQty, extraQty, gfcQty, achievedQty, certifiedQty });
    const row = await prisma.costMonitoringLine.create({
      data: {
        projectId: req.params.projectId,
        packageName: String(body.packageName || "Civil"),
        section: body.section ? String(body.section) : null,
        itemNo: body.itemNo ? String(body.itemNo) : null,
        description: String(body.description || "New line"),
        uom: body.uom ? String(body.uom) : null,
        rate,
        boqQty,
        extraQty,
        gfcQty,
        achievedQty,
        certifiedQty,
        ...metrics,
      },
    });
    await audit("cost.monitoring.create", {
      userId: req.user!.id,
      entity: "CostMonitoringLine",
      entityId: row.id,
      meta: { projectId: row.projectId },
    });
    res.status(201).json(row);
  }
);

costRouter.delete(
  "/:projectId/monitoring/:lineId",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMonitoringLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.costMonitoringLine.delete({ where: { id: existing.id } });
    await audit("cost.monitoring.delete", {
      userId: req.user!.id,
      entity: "CostMonitoringLine",
      entityId: req.params.lineId,
      meta: { projectId: existing.projectId },
    });
    res.json({ ok: true });
  }
);

/** Multi-structure BOQ / Monitoring import — SPDC Monitoring* layout or generic BOQ */
costRouter.post(
  "/:projectId/structure/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const { isFullSpdcWorkbook } = await import("../services/costSheetParser.js");
    const { syncBudgetWorkbookFromBuffer } = await import("../services/budgetWorkbookImport.js");
    if (
      isFullSpdcWorkbook(req.file.buffer) ||
      /spdc_budget|budget_arvind|arvind.*49/i.test(req.file.originalname || "")
    ) {
      const out = await syncBudgetWorkbookFromBuffer(req.params.projectId, req.file.buffer, req.file.originalname);
      return res.status(201).json({ ...out, openTab: "monitoring", openPackage: "Civil Dormitory" });
    }
    const packageName = String(req.body.packageName || "Imported structure").trim();
    const replace = String(req.body.replace || "1") !== "0";

    const XLSX = (await import("../lib/xlsx.js")).default;
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName =
      wb.SheetNames.find((n) => /monitoring/i.test(n)) ||
      wb.SheetNames.find((n) => !/\b(MB|BBS|Budget|RATE|Steel|Cement|Tiles)\b/i.test(n)) ||
      wb.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName!], {
      header: 1,
      defval: "",
    }) as unknown[][];

    const { isSpdcMonitoringSheet, monitoringItemRows, monitoringLineToDb, parseSpdcMonitoringRows } = await import(
      "../services/spdcMonitoringParser.js"
    );

    if (isSpdcMonitoringSheet(rawRows)) {
      const lines = monitoringItemRows(parseSpdcMonitoringRows(rawRows, packageName));
      if (!lines.length) return res.status(400).json({ error: "No monitoring BOQ rows parsed — check SPDC Monitoring layout" });
      if (replace) {
        await prisma.costMonitoringLine.deleteMany({ where: { projectId: req.params.projectId, packageName } });
      }
      const chunk = 100;
      for (let i = 0; i < lines.length; i += chunk) {
        await prisma.costMonitoringLine.createMany({
          data: lines.slice(i, i + chunk).map((line) => ({
            projectId: req.params.projectId,
            ...monitoringLineToDb(line),
          })),
        });
      }
      const batch = await prisma.boqImportBatch.create({
        data: {
          projectId: req.params.projectId,
          fileName: `${packageName} · ${req.file.originalname}`,
          rowCount: lines.length,
          summaryJson: JSON.stringify({ packageName, kind: "monitoring", spdc: true, items: lines.length }),
        },
      });
      return res.status(201).json({
        ...batch,
        packageName,
        rowCount: lines.length,
        openTab: "monitoring",
        openPackage: packageName,
      });
    }

    const rows = parseBoqBuffer(req.file.buffer);
    const items = rows.filter((r) => r.rowKind === "item");
    if (!items.length) return res.status(400).json({ error: "No BOQ rows parsed" });
    if (replace) {
      await prisma.costMonitoringLine.deleteMany({ where: { projectId: req.params.projectId, packageName } });
    }
    const batch = await prisma.boqImportBatch.create({
      data: {
        projectId: req.params.projectId,
        fileName: `${packageName} · ${req.file.originalname}`,
        rowCount: rows.length,
        summaryJson: JSON.stringify({ packageName, items: items.length }),
        items: {
          create: rows.map((r) => ({
            srNo: r.srNo,
            description: r.description,
            section: r.section || packageName,
            qty: r.qty,
            rate: r.rate,
            unit: r.unit,
            amount: r.amount,
            costCode: r.costCode,
            rowKind: r.rowKind,
          })),
        },
      },
    });
    await prisma.costMonitoringLine.createMany({
      data: items.map((r) => ({
        projectId: req.params.projectId,
        packageName,
        section: r.section || packageName,
        itemNo: r.srNo,
        description: r.description,
        uom: r.unit,
        rate: r.rate,
        boqQty: r.qty,
        boqCost: r.amount,
      })),
    });
    res.status(201).json({ ...batch, packageName, rowCount: items.length, openTab: "monitoring", openPackage: packageName });
  }
);

/** List uploaded BBS / MB / shape files for a package */
costRouter.get("/:projectId/sheets", async (req, res) => {
  const projectId = req.params.projectId;
  const kind = String(req.query.kind || "").trim();
  const pkg = String(req.query.package || "").trim();
  const batches = await prisma.boqImportBatch.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const files = batches
    .map((b) => ({ ...b, meta: parseBatchMeta(b.summaryJson) }))
    .filter((b) => {
      const k = String(b.meta.kind || "");
      if (!["bbs", "mb", "bbs_shape"].includes(k)) return false;
      if (kind && k !== kind) return false;
      if (pkg && String(b.meta.packageName || "") !== pkg) return false;
      return true;
    })
    .map((b) => ({
      id: b.id,
      kind: b.meta.kind,
      packageName: b.meta.packageName,
      fileName: b.fileName,
      rowCount: b.rowCount,
      storagePath: b.meta.storagePath,
      shareUrl: b.meta.shareUrl,
      provider: b.meta.provider,
      barMark: b.meta.barMark,
      createdAt: b.createdAt,
    }));
  res.json(files);
});

async function importCostSheet(
  req: AuthedRequest,
  kind: "bbs" | "mb",
  parse: (buf: Buffer) => Array<Record<string, unknown>>
) {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return { status: 404, body: { error: "project not found" } };
  if (!req.file) return { status: 400, body: { error: "file required (.xlsx / .xls / .csv)" } };

  const packageName = String(req.body.packageName || "Imported").trim();
  const replace = String(req.body.replace || "") === "1" || req.body.replace === true;
  const parsed = parse(req.file.buffer);
  if (!parsed.length) return { status: 400, body: { error: "No rows parsed — check sheet layout (SPDC BBS/MB format)" } };

  if (replace) {
    if (kind === "bbs") {
      await prisma.costBbsLine.deleteMany({ where: { projectId: project.id, packageName } });
    } else {
      await prisma.costMbLine.deleteMany({ where: { projectId: project.id, packageName } });
    }
  }

  const folderKey = kind === "bbs" ? "bbs" : "mb";
  const relFolder = `${MODULE_TO_ISO_FOLDER[folderKey]}/${safeFolderPart(packageName)}/sheets`;
  const saved = await mockOneDrive.upload(
    project.code,
    relFolder,
    `${Date.now()}-${req.file.originalname}`,
    req.file.buffer
  );

  if (kind === "bbs") {
    await prisma.costBbsLine.createMany({
      data: parsed.map((r, lineIndex) => ({
        projectId: project.id,
        packageName,
        barMark: (r.barMark as string) || null,
        shapeCode: (r.shapeCode as string) || null,
        itemCode: (r.itemCode as string) || null,
        sectionMark: (r.sectionMark as string) || null,
        diameterMm: Number(r.diameterMm) || 0,
        shape: (r.shape as string) || null,
        lengthMm: Number(r.lengthMm) || 0,
        nos: Number(r.nos) || 0,
        nosPerMember: Number(r.nosPerMember) || 0,
        nosOfMember: Number(r.nosOfMember) || 0,
        shapeLenA: Number(r.shapeLenA) || 0,
        shapeLenB: Number(r.shapeLenB) || 0,
        shapeLenC: Number(r.shapeLenC) || 0,
        shapeLenD: Number(r.shapeLenD) || 0,
        shapeLenE: Number(r.shapeLenE) || 0,
        totalLength: Number(r.totalLength) || 0,
        weightKg: Number(r.weightKg) || 0,
        location: (r.location as string) || null,
        rowKind: (r.rowKind as string) || "data",
        lineIndex,
      })),
    });
    const { applyShapeMastersToBbs } = await import("../services/costQuantitySync.js");
    await applyShapeMastersToBbs(project.id, packageName);
  } else {
    await prisma.costMbLine.createMany({
      data: parsed.map((r, lineIndex) => ({
        projectId: project.id,
        packageName,
        srNo: (r.srNo as string) || null,
        itemCode: (r.itemCode as string) || (r.srNo as string) || null,
        description: String(r.description || "MB line"),
        nos1: Number(r.nos1) || 0,
        nos2: Number(r.nos2) || 1,
        length: Number(r.length) || 0,
        width: Number(r.width) || 0,
        height: Number(r.height) || 0,
        qty: Number(r.qty) || 0,
        unit: (r.unit as string) || null,
        raBill: (r.raBill as string) || null,
        remark: (r.remark as string) || null,
        rowKind: (r.rowKind as string) || "data",
        lineIndex,
      })),
    });
    const { syncAchievedFromMb } = await import("../services/costQuantitySync.js");
    await syncAchievedFromMb(project.id, packageName);
  }

  const batch = await prisma.boqImportBatch.create({
    data: {
      projectId: project.id,
      fileName: `${packageName} · ${req.file.originalname}`,
      rowCount: parsed.length,
      summaryJson: JSON.stringify({
        kind,
        packageName,
        storagePath: saved.path,
        shareUrl: saved.url,
        sharePointUrl: saved.sharePointUrl,
        provider: saved.provider,
        replace,
      }),
    },
  });

  await audit(`cost.${kind}_import`, {
    userId: req.user!.id,
    entity: "BoqImportBatch",
    entityId: batch.id,
    meta: { packageName, rows: parsed.length, path: saved.path },
  });

  return {
    status: 201,
    body: {
      ok: true,
      id: batch.id,
      kind,
      packageName,
      rowsImported: parsed.length,
      replace,
      file: {
        path: saved.path,
        url: saved.url,
        sharePointUrl: saved.sharePointUrl,
        provider: saved.provider,
      },
    },
  };
}

costRouter.post(
  "/:projectId/bbs/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const result = await importCostSheet(req, "bbs", (buf) => parseBbsBuffer(buf) as Array<Record<string, unknown>>);
    return res.status(result.status).json(result.body);
  }
);

costRouter.post(
  "/:projectId/mb/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const result = await importCostSheet(req, "mb", (buf) => parseMbBuffer(buf) as Array<Record<string, unknown>>);
    return res.status(result.status).json(result.body);
  }
);

costRouter.post(
  "/:projectId/bbs/shape",
  requireRoles("admin", "office", "employee", "site_employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required (PDF or image)" });
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "project not found" });

    const packageName = String(req.body.packageName || "BBS").trim();
    const barMark = String(req.body.barMark || "").trim();
    const bbsLineId = String(req.body.bbsLineId || "").trim();
    const relFolder = `${MODULE_TO_ISO_FOLDER.bbs}/${safeFolderPart(packageName)}/shapes`;
    const prefix = barMark ? `${safeFolderPart(barMark)}-` : bbsLineId ? `line-${bbsLineId.slice(0, 8)}-` : "";
    const saved = await mockOneDrive.upload(
      project.code,
      relFolder,
      `${prefix}${Date.now()}-${req.file.originalname}`,
      req.file.buffer
    );

    const shareUrl = saved.sharePointUrl || saved.url;

    if (bbsLineId) {
      const line = await prisma.costBbsLine.findFirst({
        where: { id: bbsLineId, projectId: project.id },
      });
      if (!line) return res.status(404).json({ error: "BBS line not found" });
      await prisma.costBbsLine.update({
        where: { id: line.id },
        data: { shapeDiagramPath: saved.path, shapeDiagramUrl: shareUrl },
      });
    } else if (barMark && packageName) {
      await prisma.costBbsLine.updateMany({
        where: { projectId: project.id, packageName, barMark },
        data: { shapeDiagramPath: saved.path, shapeDiagramUrl: shareUrl },
      });
    }

    const batch = await prisma.boqImportBatch.create({
      data: {
        projectId: project.id,
        fileName: `${packageName}${barMark ? ` · mark ${barMark}` : ""} · ${req.file.originalname}`,
        rowCount: 0,
        summaryJson: JSON.stringify({
          kind: "bbs_shape",
          packageName,
          barMark: barMark || null,
          storagePath: saved.path,
          shareUrl: saved.url,
          sharePointUrl: saved.sharePointUrl,
          provider: saved.provider,
          mime: req.file.mimetype,
        }),
      },
    });

    await audit("cost.bbs_shape.upload", {
      userId: req.user!.id,
      entity: "BoqImportBatch",
      entityId: batch.id,
      meta: { packageName, barMark, bbsLineId: bbsLineId || null, path: saved.path },
    });

    res.status(201).json({
      ok: true,
      id: batch.id,
      bbsLineId: bbsLineId || null,
      packageName,
      barMark: barMark || null,
      file: {
        path: saved.path,
        url: saved.url,
        sharePointUrl: saved.sharePointUrl,
        provider: saved.provider,
      },
    });
  }
);

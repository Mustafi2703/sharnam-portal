import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { parseBoqBuffer } from "../services/boqParser.js";
import { parseBbsBuffer, parseMbBuffer, parseAllMbSheets, parseAllBbsSheets, isFullSpdcWorkbook } from "../services/costSheetParser.js";
import { audit } from "../services/audit.js";
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

const CASHFLOW_SHEET_TOOLS = [
  { id: "chart", label: "Cash Flow Chart", source: "Cashflow - Dashboard.xlsx" },
  { id: "forecast", label: "Cash Flow Forecast", source: "Cashflow - Dashboard.xlsx" },
  { id: "tracking", label: "Tracking", source: "Cashflow - Dashboard.xlsx" },
];

export const costRouter = Router();
costRouter.use(requireAuth);

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
        take: pkg ? 2000 : 800,
        orderBy: [{ packageName: "asc" }, { section: "asc" }, { itemNo: "asc" }],
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
        take: pkg ? 2000 : 800,
        orderBy: [{ packageName: "asc" }, { srNo: "asc" }],
      }),
      prisma.costBbsLine.findMany({
        where: bbsWhere,
        take: pkg ? 2000 : 800,
        orderBy: [{ packageName: "asc" }, { barMark: "asc" }],
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

/** Download BOQ / monitoring / MB / BBS as CSV (Excel-openable) */
costRouter.get("/:projectId/download/:kind.csv", async (req, res) => {
  const projectId = req.params.projectId;
  const kind = req.params.kind;
  const pkg = String(req.query.package || "").trim();
  const where = { projectId, ...(pkg ? { packageName: pkg } : {}) };

  if (kind === "monitoring" || kind === "boq") {
    const rows = await prisma.costMonitoringLine.findMany({
      where,
      orderBy: [{ packageName: "asc" }, { section: "asc" }, { itemNo: "asc" }],
    });
    const csv = toCsv(
      [
        "Package",
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
      rows.map((r) => [
        r.packageName,
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
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="BOQ-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "mb") {
    const rows = await prisma.costMbLine.findMany({ where, orderBy: [{ packageName: "asc" }, { srNo: "asc" }] });
    const csv = toCsv(
      ["Package", "Sr No.", "Description", "No", "No", "Length", "Width", "Height", "Qty.", "UoM.", "RA Bill", "Remark"],
      rows.map((r) => [
        r.packageName,
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
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="MB-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "bbs") {
    const rows = await prisma.costBbsLine.findMany({ where, orderBy: [{ packageName: "asc" }, { barMark: "asc" }] });
    const csv = toCsv(
      [
        "Package",
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
      rows.map((r) => [
        r.packageName,
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
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="BBS-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "budget") {
    const rows = await prisma.costBudgetLine.findMany({ where: { projectId } });
    const csv = toCsv(
      [
        "Sr",
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
      rows.map((r) => [
        r.srNo,
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
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Budget-WBS.csv"`);
    return res.send(csv);
  }

  if (kind === "cashflow") {
    const rows = await prisma.costCashflowPeriod.findMany({ where: { projectId } });
    const csv = toCsv(
      ["Period", "Package / sheet", "Planned", "Actual", "Progress"],
      rows.map((r) => [r.periodLabel, r.packageName, r.plannedAmount, r.actualAmount, r.progressPct])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Cashflow.csv"`);
    return res.send(csv);
  }

  if (kind === "rates") {
    const rows = await prisma.costRateDifference.findMany({ where: { projectId } });
    const csv = toCsv(
      ["Material", "Description", "Vendor", "Purchase No", "Qty", "Basic", "Purchase", "Excess", "Saving"],
      rows.map((r) => [
        r.materialType,
        r.description,
        r.vendorName,
        r.purchaseNo,
        r.qty,
        r.basicRate,
        r.purchaseRate,
        r.excessAmount,
        r.savingAmount,
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Rate-difference.csv"`);
    return res.send(csv);
  }

  return res.status(400).json({ error: "Unknown kind — use monitoring|boq|mb|bbs|budget|cashflow|rates" });
});

costRouter.post(
  "/:projectId/boq/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
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
  const batch = await prisma.boqImportBatch.findUnique({
    where: { id: req.params.batchId },
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

costRouter.patch("/budget/:lineId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costBudgetLine.findUnique({ where: { id: req.params.lineId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  const num = (k: string) => (body[k] != null ? Number(body[k]) : undefined);
  const line = await prisma.costBudgetLine.update({
    where: { id: req.params.lineId },
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

costRouter.delete("/budget/:lineId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.costBudgetLine.findUnique({ where: { id: req.params.lineId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.costBudgetLine.delete({ where: { id: req.params.lineId } });
  res.json({ ok: true });
});

/** Load full SPDC_Budget_Arvind workbook (Budget + Monitoring + MB + BBS + rates) like QAP/Cube sync-template. */
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
        data: batch.lines.map((r) => ({
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
        })),
      });
      mbImported += batch.lines.length;
      packagesImported.push(batch.packageName);
      const { syncAchievedFromMb } = await import("../services/costQuantitySync.js");
      await syncAchievedFromMb(project.id, batch.packageName);
    }

    for (const batch of bbsSheets) {
      const dataLines = batch.lines.filter((r) => r.rowKind !== "header" && (r.diameterMm || r.totalLength || r.weightKg || r.location));
      if (!dataLines.length) continue;
      if (!replace) {
        await prisma.costBbsLine.deleteMany({ where: { projectId: project.id, packageName: batch.packageName } });
      }
      await prisma.costBbsLine.createMany({
        data: dataLines.map((r) => ({
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
        })),
      });
      bbsImported += dataLines.length;
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
  const row = await prisma.costCashflowPeriod.create({
    data: {
      projectId: req.params.projectId,
      periodLabel: req.body.periodLabel,
      periodDate: req.body.periodDate ? new Date(req.body.periodDate) : null,
      packageName: req.body.packageName,
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

costRouter.patch("/bills/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const bill = await prisma.vendorBill.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      copNo: req.body.copNo,
      amount: req.body.amount != null ? Number(req.body.amount) : undefined,
      description: req.body.description,
    },
  });
  res.json(bill);
});

costRouter.post("/:projectId/mb", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const nos1 = Number(req.body.nos1 || 0);
  const nos2 = Number(req.body.nos2 || 1) || 1;
  const length = Number(req.body.length || 0);
  const width = Number(req.body.width || 0);
  const height = Number(req.body.height || 0);
  const qty = Number(req.body.qty || nos1 * nos2 * (length || 1) * (width || 1) * (height || 1));
  const row = await prisma.costMbLine.create({
    data: {
      projectId: req.params.projectId,
      packageName: req.body.packageName || "Civil",
      srNo: req.body.srNo || null,
      description: String(req.body.description || "MB line"),
      nos1,
      nos2,
      length,
      width,
      height,
      qty,
      unit: req.body.unit || null,
      raBill: req.body.raBill || null,
      remark: req.body.remark || null,
    },
  });
  res.status(201).json(row);
});

costRouter.post("/:projectId/bbs", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.costBbsLine.create({
    data: {
      projectId: req.params.projectId,
      packageName: req.body.packageName || "BBS",
      barMark: req.body.barMark || null,
      diameterMm: Number(req.body.diameterMm || 0),
      shape: req.body.shape || null,
      lengthMm: Number(req.body.lengthMm || 0),
      nos: Number(req.body.nos || 0),
      nosPerMember: Number(req.body.nosPerMember || 0),
      nosOfMember: Number(req.body.nosOfMember || 0),
      shapeLenA: Number(req.body.shapeLenA || 0),
      shapeLenB: Number(req.body.shapeLenB || 0),
      shapeLenC: Number(req.body.shapeLenC || 0),
      shapeLenD: Number(req.body.shapeLenD || 0),
      shapeLenE: Number(req.body.shapeLenE || 0),
      totalLength: Number(req.body.totalLength || 0),
      weightKg: Number(req.body.weightKg || 0),
      location: req.body.location || null,
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
    const qty =
      body.qty != null
        ? Number(body.qty)
        : nos1 * nos2 * (length || 1) * (width || 1) * (height || 1);
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
  requireRoles("admin", "office", "employee"),
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
    const nosPerMember = body.nosPerMember != null ? Number(body.nosPerMember) : existing.nosPerMember;
    const nosOfMember = body.nosOfMember != null ? Number(body.nosOfMember) : existing.nosOfMember;
    const nos = body.nos != null ? Number(body.nos) : existing.nos || nosPerMember * nosOfMember;
    const dia = body.diameterMm != null ? Number(body.diameterMm) : existing.diameterMm;
    const totalLen = body.totalLength != null ? Number(body.totalLength) : existing.totalLength;
    const weight =
      body.weightKg != null
        ? Number(body.weightKg)
        : dia && totalLen
          ? (Math.PI * (dia / 1000 / 2) ** 2 * totalLen * 7850) / 1000
          : existing.weightKg;
    const row = await prisma.costBbsLine.update({
      where: { id: existing.id },
      data: {
        ...(body.packageName != null ? { packageName: String(body.packageName) } : {}),
        ...(body.barMark !== undefined ? { barMark: body.barMark ? String(body.barMark) : null } : {}),
        ...(body.shapeCode !== undefined ? { shapeCode: body.shapeCode ? String(body.shapeCode).toUpperCase() : null } : {}),
        ...(body.itemCode !== undefined ? { itemCode: body.itemCode ? String(body.itemCode) : null } : {}),
        ...(body.location !== undefined ? { location: body.location ? String(body.location) : null } : {}),
        diameterMm: dia,
        nos,
        nosPerMember,
        nosOfMember,
        ...(body.lengthMm != null ? { lengthMm: Number(body.lengthMm) } : {}),
        ...(body.shapeLenA != null ? { shapeLenA: Number(body.shapeLenA) } : {}),
        ...(body.shapeLenB != null ? { shapeLenB: Number(body.shapeLenB) } : {}),
        ...(body.shapeLenC != null ? { shapeLenC: Number(body.shapeLenC) } : {}),
        ...(body.shapeLenD != null ? { shapeLenD: Number(body.shapeLenD) } : {}),
        ...(body.shapeLenE != null ? { shapeLenE: Number(body.shapeLenE) } : {}),
        totalLength: totalLen,
        weightKg: Math.round(weight * 100) / 100,
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
  requireRoles("admin", "office", "employee"),
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
  "/monitoring/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMonitoringLine.findUnique({ where: { id: req.params.lineId } });
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
      where: { id: req.params.lineId },
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
  "/monitoring/:lineId",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.costMonitoringLine.findUnique({ where: { id: req.params.lineId } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.costMonitoringLine.delete({ where: { id: req.params.lineId } });
    await audit("cost.monitoring.delete", {
      userId: req.user!.id,
      entity: "CostMonitoringLine",
      entityId: req.params.lineId,
      meta: { projectId: existing.projectId },
    });
    res.json({ ok: true });
  }
);

/** Multi-structure BOQ / MB import — optional packageName on multipart */
costRouter.post(
  "/:projectId/structure/import",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const packageName = String(req.body.packageName || "Imported structure");
    const rows = parseBoqBuffer(req.file.buffer);
    const batch = await prisma.boqImportBatch.create({
      data: {
        projectId: req.params.projectId,
        fileName: `${packageName} · ${req.file.originalname}`,
        rowCount: rows.length,
        summaryJson: JSON.stringify({ packageName, items: rows.filter((r) => r.rowKind === "item").length }),
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
    for (const r of rows.filter((x) => x.rowKind === "item").slice(0, 300)) {
      await prisma.costMonitoringLine.create({
        data: {
          projectId: req.params.projectId,
          packageName,
          section: r.section || packageName,
          itemNo: r.srNo,
          description: r.description,
          uom: r.unit,
          rate: r.rate,
          boqQty: r.qty,
          boqCost: r.amount,
        },
      });
    }
    res.status(201).json(batch);
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
      data: parsed.map((r) => ({
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
      })),
    });
    const { applyShapeMastersToBbs } = await import("../services/costQuantitySync.js");
    await applyShapeMastersToBbs(project.id, packageName);
  } else {
    await prisma.costMbLine.createMany({
      data: parsed.map((r) => ({
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

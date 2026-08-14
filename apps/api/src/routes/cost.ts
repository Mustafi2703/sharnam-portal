import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { parseBoqBuffer } from "../services/boqParser.js";
import { parseBbsBuffer, parseMbBuffer } from "../services/costSheetParser.js";
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

  const sheetTools = {
    sources: ["Cashflow - Dashboard.xlsx", "SPDC_Budget_Arvind 49.xls", "Payment Summary - VIATRIX - Copy.xlsx"],
    cashflow: CASHFLOW_SHEET_TOOLS,
    budget: { label: "Budget WBS", rows: budget.length },
    monitoring: monPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    mb: mbPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    bbs: bbsPkgs.map((g) => ({ packageName: g.packageName, rows: g._count })),
    rates: { rows: rateDiffs.length },
  };

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
    },
    packages,
    monByPackage,
    mbByPackage,
    bbsByPackage,
    sheetTools,
    activePackage: pkg || null,
    budget,
    monitoring,
    cashflow,
    cashflowChart: cashflow.filter((c) => /chart|project cashflow \(chart\)/i.test(c.packageName || "")),
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
      ["Package", "Section", "Item", "Description", "UOM", "Rate", "BOQ Qty", "Extra", "GFC", "Achieved", "Excess", "Saving", "BOQ Cost"],
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
        r.boqCost,
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="BOQ-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "mb") {
    const rows = await prisma.costMbLine.findMany({ where, orderBy: [{ packageName: "asc" }, { srNo: "asc" }] });
    const csv = toCsv(
      ["Package", "Sr", "Description", "Nos1", "Nos2", "Length", "Width", "Height", "Qty", "Unit"],
      rows.map((r) => [r.packageName, r.srNo, r.description, r.nos1, r.nos2, r.length, r.width, r.height, r.qty, r.unit])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="MB-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "bbs") {
    const rows = await prisma.costBbsLine.findMany({ where, orderBy: [{ packageName: "asc" }, { barMark: "asc" }] });
    const csv = toCsv(
      ["Package", "Bar mark", "Dia mm", "Shape", "Length mm", "Nos", "Total length", "Weight kg", "Location", "Diagram URL"],
      rows.map((r) => [
        r.packageName,
        r.barMark,
        r.diameterMm,
        r.shape,
        r.lengthMm,
        r.nos,
        r.totalLength,
        r.weightKg,
        r.location,
        r.shapeDiagramUrl || r.shapeDiagramPath || "",
      ])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="BBS-${pkg || "all"}.csv"`);
    return res.send(csv);
  }

  if (kind === "budget") {
    const rows = await prisma.costBudgetLine.findMany({ where: { projectId } });
    const csv = toCsv(
      ["Sr", "Description", "Stakeholder", "Budgeted", "WO", "Certified", "Forecast", "Non-tendered"],
      rows.map((r) => [
        r.srNo,
        r.description,
        r.stakeholder,
        r.budgetedAmount,
        r.workOrderAmount,
        r.certifiedAmount,
        r.forecastedAmount,
        r.nonTendered,
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
  const line = await prisma.costBudgetLine.create({
    data: {
      projectId: req.params.projectId,
      srNo: req.body.srNo,
      description: req.body.description,
      stakeholder: req.body.stakeholder,
      budgetedAmount: Number(req.body.budgetedAmount || 0),
      workOrderAmount: Number(req.body.workOrderAmount || 0),
      certifiedAmount: Number(req.body.certifiedAmount || 0),
      forecastedAmount: Number(req.body.forecastedAmount || 0),
      nonTendered: Number(req.body.nonTendered || 0),
    },
  });
  res.status(201).json(line);
});

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
      totalLength: Number(req.body.totalLength || 0),
      weightKg: Number(req.body.weightKg || 0),
      location: req.body.location || null,
    },
  });
  res.status(201).json(row);
});

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
    const excessQty = Math.max(0, nextGfc - nextBoq);
    const savingQty = Math.max(0, nextBoq - nextGfc);
    const boqCost = nextBoq * nextRate;

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
        ...(body.extraQty != null ? { extraQty: Number(body.extraQty) } : {}),
        ...(body.gfcQty != null ? { gfcQty: nextGfc } : {}),
        ...(body.achievedQty != null ? { achievedQty: Number(body.achievedQty) } : {}),
        ...(body.certifiedQty != null ? { certifiedQty: Number(body.certifiedQty) } : {}),
        excessQty,
        savingQty,
        boqCost,
      },
    });
    await audit("cost.monitoring.update", {
      userId: req.user!.id,
      entity: "CostMonitoringLine",
      entityId: row.id,
      meta: { projectId: row.projectId },
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
        extraQty: Number(body.extraQty || 0),
        gfcQty,
        achievedQty: Number(body.achievedQty || 0),
        certifiedQty: Number(body.certifiedQty || 0),
        excessQty: Math.max(0, gfcQty - boqQty),
        savingQty: Math.max(0, boqQty - gfcQty),
        boqCost: boqQty * rate,
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
        diameterMm: Number(r.diameterMm) || 0,
        shape: (r.shape as string) || null,
        lengthMm: Number(r.lengthMm) || 0,
        nos: Number(r.nos) || 0,
        totalLength: Number(r.totalLength) || 0,
        weightKg: Number(r.weightKg) || 0,
        location: (r.location as string) || null,
      })),
    });
  } else {
    await prisma.costMbLine.createMany({
      data: parsed.map((r) => ({
        projectId: project.id,
        packageName,
        srNo: (r.srNo as string) || null,
        description: String(r.description || "MB line"),
        nos1: Number(r.nos1) || 0,
        nos2: Number(r.nos2) || 1,
        length: Number(r.length) || 0,
        width: Number(r.width) || 0,
        height: Number(r.height) || 0,
        qty: Number(r.qty) || 0,
        unit: (r.unit as string) || null,
      })),
    });
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

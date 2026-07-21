import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { parseBoqBuffer } from "../services/boqParser.js";
import { audit } from "../services/audit.js";

const upload = multer({ storage: multer.memoryStorage() });

export const costRouter = Router();
costRouter.use(requireAuth);

costRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const [budget, monitoring, cashflow, rateDiffs, boqBatches] = await Promise.all([
    prisma.costBudgetLine.findMany({ where: { projectId } }),
    prisma.costMonitoringLine.findMany({ where: { projectId } }),
    prisma.costCashflowPeriod.findMany({ where: { projectId } }),
    prisma.costRateDifference.findMany({ where: { projectId } }),
    prisma.boqImportBatch.findMany({
      where: { projectId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const budgeted = budget.reduce((s, b) => s + b.budgetedAmount, 0);
  const certified = budget.reduce((s, b) => s + b.certifiedAmount, 0);
  const workOrder = budget.reduce((s, b) => s + b.workOrderAmount, 0);
  const planned = cashflow.reduce((s, c) => s + c.plannedAmount, 0);
  const actual = cashflow.reduce((s, c) => s + c.actualAmount, 0);

  res.json({
    totals: { budgeted, certified, workOrder, planned, actual, variance: planned - actual },
    budget,
    monitoring,
    cashflow,
    rateDiffs,
    boqBatches,
  });
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

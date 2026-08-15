/**
 * Finance routes — Capex, PO, RA Bill, COP, Payment Summary + audit-sheet dump.
 * Keeps commercial data cleanly separate from Cost (BOQ / BBS / MB / cashflow).
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

export const financeRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
financeRouter.use(requireAuth);

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function csvEscape(v: unknown): string {
  const t = s(v);
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}
function iso(d: Date | null | undefined) {
  return d ? new Date(d).toISOString() : "";
}

/* ─────────────────────────────────────────  SUMMARY  ───────────────────────────────────────── */

financeRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const [capex, pos, ras, cops] = await Promise.all([
    prisma.projectCapex.findMany({ where: { projectId } }),
    prisma.purchaseOrder.findMany({ where: { projectId }, include: { vendor: true } }),
    prisma.raBill.findMany({ where: { projectId }, include: { purchaseOrder: true } }),
    prisma.certificateOfPayment.findMany({ where: { projectId } }),
  ]);

  const totals = {
    capexBudgeted: capex.reduce((n, r) => n + r.budgetedAmount, 0),
    capexWorkOrder: capex.reduce((n, r) => n + r.workOrderValue, 0),
    poOriginal: pos.reduce((n, r) => n + r.originalValue, 0),
    poAmended: pos.reduce((n, r) => n + (r.amendedValue || r.originalValue), 0),
    poBilledWithoutGst: pos.reduce((n, r) => n + r.totalBilledWithoutGst, 0),
    poBilledWithGst: pos.reduce((n, r) => n + r.totalBilledWithGst, 0),
    poCertified: pos.reduce((n, r) => n + r.totalCertified, 0),
    poPaid: pos.reduce((n, r) => n + r.totalPaid, 0),
    raGross: ras.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0),
    raWithGst: ras.reduce((n, r) => n + r.totalInvoiceWithGst, 0),
    raNetPayable: ras.reduce((n, r) => n + r.netAmountPayable, 0),
    raRetention: ras.reduce((n, r) => n + r.retentionAmount, 0),
    raAdvanceAdjusted: ras.reduce((n, r) => n + r.advanceAdjusted, 0),
    copCertified: cops.reduce((n, r) => n + r.amountCertified, 0),
    copPayable: cops.reduce((n, r) => n + r.amountPayable, 0),
  };

  const raByStatus = ras.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const copByStatus = cops.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const paymentSummary = pos.map((po) => {
    const poRa = ras.filter((r) => r.purchaseOrderId === po.id);
    const billedWithoutGst = poRa.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0);
    const billedWithGst = poRa.reduce((n, r) => n + r.totalInvoiceWithGst, 0);
    const netPayable = poRa.reduce((n, r) => n + r.netAmountPayable, 0);
    const retention = poRa.reduce((n, r) => n + r.retentionAmount, 0);
    const advanceAdj = poRa.reduce((n, r) => n + r.advanceAdjusted, 0);
    const original = po.originalValue;
    const balance = Math.max(0, (po.amendedValue || original) - billedWithoutGst);
    return {
      poId: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      workTrade: po.workTrade,
      originalValue: original,
      amendedValue: po.amendedValue,
      billedWithoutGst,
      billedWithGst,
      netPayable,
      retention,
      advanceAdj,
      balance,
      raCount: poRa.length,
      status: po.status,
    };
  });

  const { getFinanceCostBridge } = await import("../services/financeCostBridge.js");
  const costBridge = await getFinanceCostBridge(projectId);
  res.json({
    totals,
    raByStatus,
    copByStatus,
    paymentSummary,
    counts: { capex: capex.length, pos: pos.length, ras: ras.length, cops: cops.length },
    costBridge,
  });
});

/* ─────────────────────────────────────────  CAPEX  ───────────────────────────────────────── */

financeRouter.get("/:projectId/capex", async (req, res) => {
  const rows = await prisma.projectCapex.findMany({ where: { projectId: req.params.projectId }, orderBy: [{ packageName: "asc" }, { srNo: "asc" }] });
  res.json(rows);
});

financeRouter.post("/:projectId/capex", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const rows = Array.isArray(req.body) ? req.body : [req.body];
  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.projectCapex.create({
        data: {
          projectId: req.params.projectId,
          srNo: s(r.srNo) || null,
          description: s(r.description) || "Line",
          packageName: s(r.packageName) || null,
          stakeholder: s(r.stakeholder) || null,
          budgetedAmount: num(r.budgetedAmount),
          workOrderValue: num(r.workOrderValue),
        },
      })
    )
  );
  await audit("finance.capex.create", { userId: req.user!.id, entity: "Project", entityId: req.params.projectId, meta: { count: created.length } });
  res.status(201).json(created);
});

financeRouter.put("/capex/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.projectCapex.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.projectCapex.update({
    where: { id: req.params.id },
    data: {
      srNo: s(req.body.srNo) || null,
      description: s(req.body.description) || before.description,
      packageName: s(req.body.packageName) || null,
      stakeholder: s(req.body.stakeholder) || null,
      budgetedAmount: num(req.body.budgetedAmount),
      workOrderValue: num(req.body.workOrderValue),
    },
  });
  res.json(row);
});

financeRouter.delete("/capex/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.projectCapex.delete({ where: { id: req.params.id } });
  await audit("finance.capex.delete", { userId: req.user!.id, entity: "ProjectCapex", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────────────────────────────  PURCHASE ORDERS  ───────────────────────────────────────── */

financeRouter.get("/:projectId/po", async (req, res) => {
  const rows = await prisma.purchaseOrder.findMany({
    where: { projectId: req.params.projectId },
    include: {
      vendor: { select: { id: true, name: true, gstNumber: true } },
      _count: { select: { raBills: true, certificates: true } },
    },
    orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
});

financeRouter.post("/:projectId/po", requireRoles("admin", "office"), upload.single("file"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });
  let attachmentUrl: string | undefined;
  if (req.file) {
    const saved = await mockOneDrive.upload(
      project.code,
      "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
      `PO-${s(req.body.poNumber || "").replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    attachmentUrl = saved.url || `/uploads/onedrive/${project.code}/${saved.path}`;
  }
  const created = await prisma.purchaseOrder.create({
    data: {
      projectId: req.params.projectId,
      poNumber: s(req.body.poNumber) || `PO-${Date.now()}`,
      poDate: req.body.poDate ? new Date(req.body.poDate) : null,
      vendorId: s(req.body.vendorId) || null,
      vendorName: s(req.body.vendorName) || "Vendor",
      workTrade: s(req.body.workTrade) || null,
      packageName: s(req.body.packageName) || null,
      budgetCode: s(req.body.budgetCode) || null,
      originalValue: num(req.body.originalValue),
      amendmentNo: s(req.body.amendmentNo) || null,
      amendedValue: num(req.body.amendedValue),
      retentionPct: num(req.body.retentionPct) || 5,
      advancePct: num(req.body.advancePct),
      panNumber: s(req.body.panNumber) || null,
      gstNumber: s(req.body.gstNumber) || null,
      payableTo: s(req.body.payableTo) || null,
      attachmentUrl: attachmentUrl || null,
      createdById: req.user!.id,
    },
  });
  await audit("finance.po.create", { userId: req.user!.id, entity: "PurchaseOrder", entityId: created.id, meta: { poNumber: created.poNumber } });
  res.status(201).json(created);
});

financeRouter.put("/po/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.purchaseOrder.update({
    where: { id: req.params.id },
    data: {
      poNumber: s(req.body.poNumber) || before.poNumber,
      poDate: req.body.poDate ? new Date(req.body.poDate) : before.poDate,
      vendorName: s(req.body.vendorName) || before.vendorName,
      workTrade: s(req.body.workTrade) || null,
      packageName: s(req.body.packageName) || null,
      originalValue: num(req.body.originalValue),
      amendmentNo: s(req.body.amendmentNo) || null,
      amendedValue: num(req.body.amendedValue),
      retentionPct: num(req.body.retentionPct) || 5,
      advancePct: num(req.body.advancePct),
      status: s(req.body.status) || before.status,
      panNumber: s(req.body.panNumber) || null,
      gstNumber: s(req.body.gstNumber) || null,
      payableTo: s(req.body.payableTo) || null,
    },
  });
  res.json(row);
});

financeRouter.delete("/po/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
  await audit("finance.po.delete", { userId: req.user!.id, entity: "PurchaseOrder", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────────────────────────────  RA BILLS  ───────────────────────────────────────── */

financeRouter.get("/:projectId/ra", async (req, res) => {
  const rows = await prisma.raBill.findMany({
    where: { projectId: req.params.projectId },
    include: {
      purchaseOrder: { select: { id: true, poNumber: true, vendorName: true } },
      certificates: { select: { id: true, certificateNumber: true, status: true } },
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
});

financeRouter.post("/:projectId/ra", requireRoles("admin", "office"), upload.single("file"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });

  const raNumber = s(req.body.raNumber) || `RA-${Date.now()}`;
  let attachmentUrl: string | undefined;
  if (req.file) {
    const saved = await mockOneDrive.upload(
      project.code,
      "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
      `RA-${raNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    attachmentUrl = saved.url || `/uploads/onedrive/${project.code}/${saved.path}`;
  }

  // cumulative = previous cumulative + this net
  const purchaseOrderId = s(req.body.purchaseOrderId) || null;
  const prev = await prisma.raBill.aggregate({
    where: { projectId: req.params.projectId, purchaseOrderId: purchaseOrderId || undefined },
    _sum: { totalInvoiceWithoutGst: true },
  });
  const previousBillTotal = prev._sum.totalInvoiceWithoutGst || 0;
  const totalInvoiceWithoutGst = num(req.body.totalInvoiceWithoutGst) || (num(req.body.againstBillRaised) - num(req.body.priceVariation));
  const netAmountPayable =
    num(req.body.netAmountPayable) ||
    num(req.body.totalInvoiceWithGst || totalInvoiceWithoutGst) -
      num(req.body.advanceAdjusted) -
      num(req.body.retentionAmount) -
      num(req.body.otherRecoveries);

  const created = await prisma.raBill.create({
    data: {
      projectId: req.params.projectId,
      purchaseOrderId,
      raNumber,
      invoiceNumber: s(req.body.invoiceNumber) || null,
      invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : null,
      description: s(req.body.description) || null,
      againstBillRaised: num(req.body.againstBillRaised),
      priceVariation: num(req.body.priceVariation),
      totalInvoiceWithoutGst,
      gstAmount: num(req.body.gstAmount),
      totalInvoiceWithGst: num(req.body.totalInvoiceWithGst),
      advanceAdjusted: num(req.body.advanceAdjusted),
      retentionAmount: num(req.body.retentionAmount),
      otherRecoveries: num(req.body.otherRecoveries),
      netAmountPayable,
      previousBillTotal,
      cumulativeBillTotal: previousBillTotal + totalInvoiceWithoutGst,
      status: s(req.body.status) || "Submitted",
      discipline: s(req.body.discipline) || null,
      vendorId: s(req.body.vendorId) || null,
      vendorName: s(req.body.vendorName) || null,
      copNo: s(req.body.copNo) || null,
      attachmentUrl: attachmentUrl || null,
      createdById: req.user!.id,
    },
  });

  if (purchaseOrderId) {
    const totals = await prisma.raBill.aggregate({
      where: { purchaseOrderId },
      _sum: { totalInvoiceWithoutGst: true, totalInvoiceWithGst: true },
    });
    await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        totalBilledWithoutGst: totals._sum.totalInvoiceWithoutGst || 0,
        totalBilledWithGst: totals._sum.totalInvoiceWithGst || 0,
      },
    });
  }

  await audit("finance.ra.create", { userId: req.user!.id, entity: "RaBill", entityId: created.id, meta: { raNumber } });
  res.status(201).json(created);
});

financeRouter.put("/ra/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.raBill.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.raBill.update({
    where: { id: req.params.id },
    data: {
      status: s(req.body.status) || before.status,
      description: s(req.body.description) || before.description,
      copNo: s(req.body.copNo) || before.copNo,
      againstBillRaised: num(req.body.againstBillRaised),
      priceVariation: num(req.body.priceVariation),
      totalInvoiceWithoutGst: num(req.body.totalInvoiceWithoutGst),
      gstAmount: num(req.body.gstAmount),
      totalInvoiceWithGst: num(req.body.totalInvoiceWithGst),
      advanceAdjusted: num(req.body.advanceAdjusted),
      retentionAmount: num(req.body.retentionAmount),
      otherRecoveries: num(req.body.otherRecoveries),
      netAmountPayable: num(req.body.netAmountPayable),
    },
  });
  res.json(row);
});

financeRouter.delete("/ra/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.raBill.delete({ where: { id: req.params.id } });
  await audit("finance.ra.delete", { userId: req.user!.id, entity: "RaBill", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────────────────────────────  CERTIFICATES OF PAYMENT  ───────────────────────────────────────── */

financeRouter.get("/:projectId/cop", async (req, res) => {
  const rows = await prisma.certificateOfPayment.findMany({
    where: { projectId: req.params.projectId },
    include: {
      purchaseOrder: { select: { id: true, poNumber: true } },
      raBill: { select: { id: true, raNumber: true } },
    },
    orderBy: [{ certificateDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
});

financeRouter.post("/:projectId/cop", requireRoles("admin", "office"), upload.single("file"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });
  let attachmentUrl: string | undefined;
  if (req.file) {
    const saved = await mockOneDrive.upload(
      project.code,
      "09_COMMERCIAL_AND_CHANGE/09.05_Variation_Extra_Item_Evaluation",
      `COP-${s(req.body.certificateNumber || "").replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    attachmentUrl = saved.url || `/uploads/onedrive/${project.code}/${saved.path}`;
  }
  const created = await prisma.certificateOfPayment.create({
    data: {
      projectId: req.params.projectId,
      certificateNumber: s(req.body.certificateNumber) || `COP-${Date.now()}`,
      certificateType: s(req.body.certificateType) || null,
      certificateDate: req.body.certificateDate ? new Date(req.body.certificateDate) : new Date(),
      contractor: s(req.body.contractor) || "Contractor",
      workTrade: s(req.body.workTrade) || null,
      budgetCode: s(req.body.budgetCode) || null,
      purchaseOrderId: s(req.body.purchaseOrderId) || null,
      poNumberDate: s(req.body.poNumberDate) || null,
      originalWoValue: num(req.body.originalWoValue),
      amendmentNo: s(req.body.amendmentNo) || null,
      amendedWoValue: num(req.body.amendedWoValue),
      invoiceNoDate: s(req.body.invoiceNoDate) || null,
      raBillId: s(req.body.raBillId) || null,
      amountCertified: num(req.body.amountCertified),
      amountPayable: num(req.body.amountPayable),
      gstAmount: num(req.body.gstAmount),
      retentionAmount: num(req.body.retentionAmount),
      panNumber: s(req.body.panNumber) || null,
      gstNumber: s(req.body.gstNumber) || null,
      payableTo: s(req.body.payableTo) || null,
      remarks: s(req.body.remarks) || null,
      status: s(req.body.status) || "Draft",
      attachmentUrl: attachmentUrl || null,
      createdById: req.user!.id,
    },
  });

  if (created.raBillId) {
    await prisma.raBill.update({ where: { id: created.raBillId }, data: { copNo: created.certificateNumber } });
  }

  await audit("finance.cop.create", { userId: req.user!.id, entity: "CertificateOfPayment", entityId: created.id, meta: { certificateNumber: created.certificateNumber } });
  res.status(201).json(created);
});

financeRouter.put("/cop/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.certificateOfPayment.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.certificateOfPayment.update({
    where: { id: req.params.id },
    data: {
      status: s(req.body.status) || before.status,
      remarks: s(req.body.remarks) || before.remarks,
      amountCertified: num(req.body.amountCertified),
      amountPayable: num(req.body.amountPayable),
      gstAmount: num(req.body.gstAmount),
      retentionAmount: num(req.body.retentionAmount),
      certifiedById: req.body.certified ? req.user!.id : before.certifiedById,
      approvedById: req.body.approved ? req.user!.id : before.approvedById,
    },
  });
  res.json(row);
});

financeRouter.delete("/cop/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.certificateOfPayment.delete({ where: { id: req.params.id } });
  await audit("finance.cop.delete", { userId: req.user!.id, entity: "CertificateOfPayment", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────────────────────────────  AUDIT-SHEET DUMP  ───────────────────────────────────────── */

/**
 * Dump Payment Summary + PO + RA + COP as CSVs into
 * 09.01_Interim_Bill_Verification_Certification/ + 09.08_Cost_Reporting_and_Reconciliation/
 * + _Registers/ mirror. Same idempotency guarantee as /dump-logs.
 */
financeRouter.post("/:projectId/audit-dump", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });
  const code = project.code;

  const [capex, pos, ras, cops] = await Promise.all([
    prisma.projectCapex.findMany({ where: { projectId: project.id } }),
    prisma.purchaseOrder.findMany({ where: { projectId: project.id }, include: { vendor: true } }),
    prisma.raBill.findMany({ where: { projectId: project.id }, include: { purchaseOrder: true } }),
    prisma.certificateOfPayment.findMany({ where: { projectId: project.id }, include: { purchaseOrder: true, raBill: true } }),
  ]);

  const capexCsv = toCsv(
    ["SrNo", "Description", "Package", "Stakeholder", "Budgeted", "WorkOrder"],
    capex.map((c) => [c.srNo, c.description, c.packageName, c.stakeholder, c.budgetedAmount, c.workOrderValue])
  );
  const poCsv = toCsv(
    ["PO No", "PO Date", "Vendor", "Work/Trade", "Package", "OriginalValue", "AmendedValue", "BilledWithoutGst", "BilledWithGst", "Certified", "Paid", "Retention%", "Advance%", "Status", "PAN", "GST"],
    pos.map((p) => [p.poNumber, iso(p.poDate), p.vendorName, p.workTrade, p.packageName, p.originalValue, p.amendedValue, p.totalBilledWithoutGst, p.totalBilledWithGst, p.totalCertified, p.totalPaid, p.retentionPct, p.advancePct, p.status, p.panNumber, p.gstNumber])
  );
  const raCsv = toCsv(
    ["RA No", "Invoice No", "Invoice Date", "PO No", "Vendor", "Discipline", "Description", "AgainstBillRaised", "PriceVariation", "TotalWithoutGst", "GST", "TotalWithGst", "AdvanceAdjusted", "Retention", "OtherRecoveries", "NetPayable", "PreviousBill", "Cumulative", "COP", "Status"],
    ras.map((r) => [r.raNumber, r.invoiceNumber, iso(r.invoiceDate), r.purchaseOrder?.poNumber, r.vendorName ?? r.purchaseOrder?.vendorName, r.discipline, r.description, r.againstBillRaised, r.priceVariation, r.totalInvoiceWithoutGst, r.gstAmount, r.totalInvoiceWithGst, r.advanceAdjusted, r.retentionAmount, r.otherRecoveries, r.netAmountPayable, r.previousBillTotal, r.cumulativeBillTotal, r.copNo, r.status])
  );
  const copCsv = toCsv(
    ["COP No", "Type", "Cert Date", "Contractor", "Work/Trade", "PO No", "Original WO", "Amended WO", "Invoice No & Date", "RA No", "Certified", "Payable", "GST", "Retention", "Status"],
    cops.map((c) => [c.certificateNumber, c.certificateType, iso(c.certificateDate), c.contractor, c.workTrade, c.purchaseOrder?.poNumber, c.originalWoValue, c.amendedWoValue, c.invoiceNoDate, c.raBill?.raNumber, c.amountCertified, c.amountPayable, c.gstAmount, c.retentionAmount, c.status])
  );

  const paymentSummaryRows = pos.map((po) => {
    const poRa = ras.filter((r) => r.purchaseOrderId === po.id);
    return [
      po.poNumber,
      po.vendorName,
      po.workTrade,
      po.originalValue,
      po.amendedValue,
      poRa.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0),
      poRa.reduce((n, r) => n + r.totalInvoiceWithGst, 0),
      poRa.reduce((n, r) => n + r.netAmountPayable, 0),
      poRa.reduce((n, r) => n + r.retentionAmount, 0),
      poRa.reduce((n, r) => n + r.advanceAdjusted, 0),
      Math.max(0, (po.amendedValue || po.originalValue) - poRa.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0)),
      poRa.length,
    ];
  });
  const paymentSummaryCsv = toCsv(
    ["PO No", "Vendor", "Trade", "OriginalValue", "AmendedValue", "BilledWithoutGst", "BilledWithGst", "NetPayable", "Retention", "AdvanceAdjusted", "Balance", "RA Count"],
    paymentSummaryRows
  );

  const primaryFolder = "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification";
  const secondaryFolder = "09_COMMERCIAL_AND_CHANGE/09.08_Cost_Reporting_and_Reconciliation";
  const registers = "_Registers";

  const drops: { name: string; folder: string; csv: string }[] = [
    { name: "Capex-Log.csv", folder: secondaryFolder, csv: capexCsv },
    { name: "PurchaseOrder-Log.csv", folder: primaryFolder, csv: poCsv },
    { name: "RA-Bill-Log.csv", folder: primaryFolder, csv: raCsv },
    { name: "COP-Log.csv", folder: primaryFolder, csv: copCsv },
    { name: "Payment-Summary.csv", folder: primaryFolder, csv: paymentSummaryCsv },
  ];
  const uploaded: unknown[] = [];
  for (const d of drops) {
    uploaded.push(await mockOneDrive.upload(code, d.folder, d.name, Buffer.from(d.csv, "utf8")));
    uploaded.push(await mockOneDrive.upload(code, registers, d.name, Buffer.from(d.csv, "utf8")));
  }

  await audit("finance.audit.dump", { userId: req.user!.id, entity: "Project", entityId: project.id, meta: { rows: { capex: capex.length, pos: pos.length, ras: ras.length, cops: cops.length } } });

  res.json({ ok: true, uploaded: uploaded.length, at: new Date().toISOString(), registers: drops.map((d) => d.name) });
});

/* ─────────────────────────────────────────  helpers  ───────────────────────────────────────── */

function extOf(f: Express.Multer.File): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(f.originalname || "");
  if (m) return `.${m[1].toLowerCase()}`;
  if (f.mimetype === "application/pdf") return ".pdf";
  if (f.mimetype === "image/png") return ".png";
  if (f.mimetype === "image/jpeg") return ".jpg";
  return "";
}

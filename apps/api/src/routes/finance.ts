/**
 * Finance routes — Capex, PO, RA Bill, COP, Payment Summary + audit-sheet dump.
 * Keeps commercial data cleanly separate from Cost (BOQ / BBS / MB / cashflow).
 */
import { Router } from "express";
import multer from "multer";
import { buildFinanceDisciplineRollup, FINANCE_PACKAGES, FINANCE_MATERIAL_COLUMNS, FINANCE_RA_COLUMNS, materialMatchesPackage, raMatchesPackage, resolveFinancePackage } from "../modules/finance/disciplines.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

export const financeRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
financeRouter.use(requireAuth);

/** Module config — Viatrix Payment Summary packages (for web + integrations). */
financeRouter.get("/meta/packages", (_req, res) => {
  res.json({ packages: FINANCE_PACKAGES, raColumns: FINANCE_RA_COLUMNS, materialColumns: FINANCE_MATERIAL_COLUMNS });
});

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

const RA_ISO_ROOT = "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification";

function safeRaFolder(raNumber: string): string {
  return `RA-${raNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

function raBillFolder(raNumber: string): string {
  return `${RA_ISO_ROOT}/${safeRaFolder(raNumber)}`;
}

function extOf(file: Express.Multer.File): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(file.originalname || "");
  if (m) return `.${m[1].toLowerCase()}`;
  if (file.mimetype === "application/pdf") return ".pdf";
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/jpeg") return ".jpg";
  return "";
}

async function saveRaBillFile(
  projectCode: string,
  raNumber: string,
  fileName: string,
  buffer: Buffer
) {
  const saved = await mockOneDrive.upload(projectCode, raBillFolder(raNumber), fileName, buffer);
  const fileUrl = saved.url || `/uploads/onedrive/${projectCode}/${saved.path}`;
  return { ...saved, fileUrl, fileName };
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

  const { getFinanceCostBridge } = await import("../modules/finance/costBridge.js");
  const costBridge = await getFinanceCostBridge(projectId);
  const materials = await prisma.financeMaterialInvoice.findMany({ where: { projectId } });
  const byDiscipline = buildFinanceDisciplineRollup({
    ras,
    materials,
    pos,
    cops,
  });
  res.json({
    totals,
    raByStatus,
    copByStatus,
    paymentSummary,
    byDiscipline,
    counts: { capex: capex.length, pos: pos.length, ras: ras.length, cops: cops.length, materials: materials.length },
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
  const pkg = resolveFinancePackage(String(req.query.discipline || req.query.package || ""));
  const rows = await prisma.raBill.findMany({
    where: { projectId: req.params.projectId },
    include: {
      purchaseOrder: { select: { id: true, poNumber: true, vendorName: true, packageName: true, workTrade: true } },
      certificates: { select: { id: true, certificateNumber: true, status: true } },
      attachments: { orderBy: { uploadedAt: "desc" } },
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(pkg ? rows.filter((r) => raMatchesPackage(r, pkg)) : rows);
});

financeRouter.post("/:projectId/ra", requireRoles("admin", "office"), upload.fields([
  { name: "files", maxCount: 25 },
  { name: "file", maxCount: 1 },
]), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });

  const raNumber = s(req.body.raNumber) || `RA-${Date.now()}`;
  const pkg = resolveFinancePackage(s(req.body.discipline) || s(req.body.packageKey) || "");
  const discipline = pkg?.discipline || s(req.body.discipline) || "Civil";
  let attachmentUrl: string | undefined;
  const fieldFiles = req.files as { files?: Express.Multer.File[]; file?: Express.Multer.File[] } | undefined;
  const uploadedFiles = [...(fieldFiles?.files || []), ...(fieldFiles?.file || [])];
  const attachmentRows: { fileName: string; fileUrl: string; storagePath?: string; sharePointUrl?: string }[] = [];
  for (const f of uploadedFiles) {
    const saved = await saveRaBillFile(
      project.code,
      raNumber,
      `${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      f.buffer
    );
    attachmentRows.push({
      fileName: f.originalname,
      fileUrl: saved.fileUrl,
      storagePath: saved.path,
      sharePointUrl: saved.url || undefined,
    });
    if (!attachmentUrl) attachmentUrl = saved.fileUrl;
  }

  // cumulative = previous cumulative + this net
  const purchaseOrderId = s(req.body.purchaseOrderId) || null;
  const prev = await prisma.raBill.aggregate({
    where: {
      projectId: req.params.projectId,
      discipline: discipline,
      ...(purchaseOrderId ? { purchaseOrderId } : {}),
    },
    _sum: { totalInvoiceWithoutGst: true },
  });
  const previousBillTotal = prev._sum?.totalInvoiceWithoutGst || 0;
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
      discipline,
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

  // Link uploaded contractor invoices to this RA bill so they no longer show as unbilled
  const linkedIds: string[] = Array.isArray(req.body?.linkedVendorBillIds)
    ? (req.body.linkedVendorBillIds as unknown[]).map(String).filter(Boolean)
    : typeof req.body?.linkedVendorBillIds === "string" && req.body.linkedVendorBillIds
      ? String(req.body.linkedVendorBillIds).split(/[,\s]+/).filter(Boolean)
      : [];
  if (linkedIds.length) {
    await prisma.vendorBill.updateMany({
      where: { id: { in: linkedIds }, projectId: req.params.projectId },
      data: { copNo: created.raNumber, status: "Under review" },
    });
    await audit("finance.ra.link_invoices", {
      userId: req.user!.id,
      entity: "RaBill",
      entityId: created.id,
      meta: { linkedInvoices: linkedIds.length },
    });
  }

  if (attachmentRows.length) {
    await prisma.raBillAttachment.createMany({
      data: attachmentRows.map((a) => ({
        raBillId: created.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        storagePath: a.storagePath || null,
        sharePointUrl: a.sharePointUrl || null,
        kind: "contractor_doc",
        uploadedById: req.user!.id,
      })),
    });
  }

  await audit("finance.ra.create", { userId: req.user!.id, entity: "RaBill", entityId: created.id, meta: { raNumber } });
  const withAttachments = await prisma.raBill.findUnique({
    where: { id: created.id },
    include: { attachments: { orderBy: { uploadedAt: "desc" } } },
  });
  res.status(201).json(withAttachments || created);
});

financeRouter.put("/ra/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.raBill.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const data: Record<string, unknown> = {};
  if (req.body.status != null) data.status = s(req.body.status) || before.status;
  if (req.body.description != null) data.description = s(req.body.description) || before.description;
  if (req.body.copNo != null) data.copNo = s(req.body.copNo) || before.copNo;
  if (req.body.raNumber != null) data.raNumber = s(req.body.raNumber) || before.raNumber;
  if (req.body.invoiceNumber != null) data.invoiceNumber = s(req.body.invoiceNumber) || null;
  if (req.body.invoiceDate !== undefined) data.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : null;
  if (req.body.discipline != null) data.discipline = s(req.body.discipline) || before.discipline;
  for (const k of ["againstBillRaised", "priceVariation", "totalInvoiceWithoutGst", "gstAmount", "totalInvoiceWithGst", "advanceAdjusted", "retentionAmount", "otherRecoveries", "netAmountPayable"] as const) {
    if (req.body[k] != null && req.body[k] !== "") data[k] = num(req.body[k]);
  }
  const row = await prisma.raBill.update({ where: { id: req.params.id }, data });
  res.json(row);
});

financeRouter.delete("/ra/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.raBill.delete({ where: { id: req.params.id } });
  await audit("finance.ra.delete", { userId: req.user!.id, entity: "RaBill", entityId: req.params.id });
  res.json({ ok: true });
});

/* ─────────────────── RA-BILL STAGE FLOW: Submitted → Corrected → Certified ───────────────────
 * The PMC discipline: each RA bill goes through three stages. Every click uploads a NEW file
 * (SharePoint / mock OneDrive) — no overwrite. The bill's `status` reflects the latest stage
 * and `attachmentUrl` always points to the freshest file so the register keeps working.
 * Full log lives under `raBillRevisions`.
 */
const RA_STAGES = ["Submitted", "Corrected", "Certified"] as const;
type RaStage = (typeof RA_STAGES)[number];

/** List every stage revision on this RA bill — most recent first. */
financeRouter.get("/ra/:id/revisions", async (req, res) => {
  const bill = await prisma.raBill.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!bill) return res.status(404).json({ error: "RA bill not found" });
  const rows = await prisma.raBillRevision.findMany({
    where: { raBillId: bill.id },
    orderBy: [{ uploadedAt: "desc" }],
  });
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploadedById).filter(Boolean))) as string[];
  const users = uploaderIds.length
    ? await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => ({ ...r, uploadedBy: r.uploadedById ? userMap.get(r.uploadedById) || null : null })));
});

/** List all contractor documents filed under this RA bill folder. */
financeRouter.get("/ra/:id/attachments", async (req, res) => {
  const bill = await prisma.raBill.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!bill) return res.status(404).json({ error: "RA bill not found" });
  const rows = await prisma.raBillAttachment.findMany({
    where: { raBillId: bill.id },
    orderBy: { uploadedAt: "desc" },
  });
  res.json(rows);
});

/** Upload one or more contractor documents to the RA bill folder (09.01/RA-xx/). */
financeRouter.post(
  "/ra/:id/attachments",
  requireRoles("admin", "office"),
  upload.array("files", 25),
  async (req: AuthedRequest, res) => {
    const bill = await prisma.raBill.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { code: true } } },
    });
    if (!bill) return res.status(404).json({ error: "RA bill not found" });
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: "no files uploaded" });

    const created = [];
    let latestUrl: string | undefined;
    for (const f of files) {
      const saved = await saveRaBillFile(
        bill.project.code,
        bill.raNumber,
        `${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        f.buffer
      );
      const row = await prisma.raBillAttachment.create({
        data: {
          raBillId: bill.id,
          fileName: f.originalname,
          fileUrl: saved.fileUrl,
          storagePath: saved.path,
          sharePointUrl: saved.url || null,
          kind: s(req.body.kind) || "contractor_doc",
          uploadedById: req.user!.id,
        },
      });
      created.push(row);
      latestUrl = saved.fileUrl;
    }
    if (latestUrl) {
      await prisma.raBill.update({ where: { id: bill.id }, data: { attachmentUrl: latestUrl } });
    }
    await audit("finance.ra.attachments", {
      userId: req.user!.id,
      entity: "RaBill",
      entityId: bill.id,
      meta: { count: created.length },
    });
    res.status(201).json(created);
  }
);

/**
 * Log a new stage revision.
 * Body: stage (Submitted|Corrected|Certified), notes?, amountAtStage?, file
 * Contractors typically upload the same workbook they use in SharePoint (Excel/PDF).
 */
financeRouter.post(
  "/ra/:id/stage",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const bill = await prisma.raBill.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { id: true, code: true } } },
    });
    if (!bill) return res.status(404).json({ error: "RA bill not found" });

    const stageRaw = s(req.body.stage);
    const stage = (RA_STAGES as readonly string[]).includes(stageRaw) ? (stageRaw as RaStage) : null;
    if (!stage) {
      return res.status(400).json({ error: `stage must be one of ${RA_STAGES.join(" | ")}` });
    }

    const existing = await prisma.raBillRevision.count({ where: { raBillId: bill.id, stage } });
    const revisionNo = existing + 1;

    let fileName: string | undefined;
    let fileUrl: string | undefined;
    let storagePath: string | undefined;
    let sharePointUrl: string | undefined;
    if (req.file) {
      const saved = await saveRaBillFile(
        bill.project.code,
        bill.raNumber,
        `${stage}-R${revisionNo}-${Date.now()}${extOf(req.file)}`,
        req.file.buffer
      );
      fileName = req.file.originalname;
      storagePath = saved.path;
      sharePointUrl = saved.url || undefined;
      fileUrl = saved.fileUrl;
    }

    const revision = await prisma.raBillRevision.create({
      data: {
        raBillId: bill.id,
        stage,
        revisionNo,
        fileName: fileName || null,
        fileUrl: fileUrl || null,
        storagePath: storagePath || null,
        sharePointUrl: sharePointUrl || null,
        amountAtStage: req.body.amountAtStage != null && req.body.amountAtStage !== "" ? num(req.body.amountAtStage) : null,
        notes: s(req.body.notes) || null,
        uploadedById: req.user!.id,
      },
    });

    /** Roll status forward. Once a bill is Certified, further Corrected uploads keep it Certified. */
    const nextStatus = stage === "Certified" ? "Certified" : stage === "Corrected" ? "Under Review" : "Submitted";
    await prisma.raBill.update({
      where: { id: bill.id },
      data: {
        status: nextStatus,
        attachmentUrl: fileUrl || bill.attachmentUrl,
        ...(revision.amountAtStage != null ? { totalInvoiceWithoutGst: revision.amountAtStage } : {}),
      },
    });

    if (fileUrl && fileName) {
      await prisma.raBillAttachment.create({
        data: {
          raBillId: bill.id,
          fileName,
          fileUrl,
          storagePath: storagePath || null,
          sharePointUrl: sharePointUrl || null,
          kind: "stage",
          uploadedById: req.user!.id,
        },
      });
    }

    await audit("finance.ra.stage", {
      userId: req.user!.id,
      entity: "RaBillRevision",
      entityId: revision.id,
      meta: { raBillId: bill.id, raNumber: bill.raNumber, stage, revisionNo },
    });

    res.status(201).json(revision);
  }
);

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
      "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
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

  const { syncCopToCashflow } = await import("../modules/finance/cashflowSync.js");
  await syncCopToCashflow(req.params.projectId);

  await audit("finance.cop.create", { userId: req.user!.id, entity: "CertificateOfPayment", entityId: created.id, meta: { certificateNumber: created.certificateNumber } });
  res.status(201).json(created);
});

/** Download Viatrix-format COP certificate (xlsx). */
financeRouter.get("/:projectId/cop/:copId/download.xlsx", async (req, res) => {
  const cop = await prisma.certificateOfPayment.findFirst({
    where: { id: req.params.copId, projectId: req.params.projectId },
  });
  if (!cop) return res.status(404).json({ error: "COP not found" });
  const { buildViatrixCopWorkbook } = await import("../modules/finance/copWorkbook.js");
  const { buffer, filename } = await buildViatrixCopWorkbook(cop.id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * Print-ready COP HTML — Sharnam letterhead, contract details, invoice line,
 * amount in words, PMC / Client / Contractor signatory blocks.  Browser can
 * print this to PDF for the client-facing signed copy.
 */
financeRouter.get("/:projectId/cop/:copId/print.html", async (req, res) => {
  const cop = await prisma.certificateOfPayment.findFirst({
    where: { id: req.params.copId, projectId: req.params.projectId },
    include: {
      project: { select: { code: true, name: true, location: true } },
      purchaseOrder: { select: { poNumber: true, poDate: true, vendorName: true } },
      raBill: { select: { raNumber: true, invoiceNumber: true, invoiceDate: true, netAmountPayable: true } },
    },
  });
  if (!cop) return res.status(404).json({ error: "COP not found" });
  const { amountInWordsInr } = await import("../modules/finance/copWorkbook.js");
  const { sharnamLogoDataUri } = await import("../services/brandedExport.js");
  const logo = sharnamLogoDataUri();
  const esc = (v: unknown) =>
    String(v ?? "—").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    );
  const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
  const dt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>COP · ${esc(cop.certificateNumber)} · ${esc(cop.project?.code || "")}</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; color:#111; font-size:11px; margin:0; }
  .letterhead { display:flex; align-items:center; gap:16px; border-bottom:2px solid #b28c3c; padding-bottom:10px; margin-bottom:14px; }
  .letterhead img { height:56px; }
  .letterhead h1 { margin:0; font-size:15px; color:#b28c3c; letter-spacing:.4px; }
  .letterhead .co { font-size:10px; color:#444; }
  .letterhead .doc { text-align:right; font-size:10px; color:#555; }
  .letterhead .doc b { font-size:12px; color:#111; }
  h2 { color:#4a3a12; text-transform:uppercase; letter-spacing:.5px; font-size:12px; padding-bottom:3px; border-bottom:1px solid #d6c691; margin:14px 0 6px; }
  table { border-collapse:collapse; width:100%; margin-bottom:6px; }
  th, td { border:1px solid #cfc7ad; padding:6px 8px; vertical-align:top; }
  th { background:#efe4c4; color:#4a3a12; font-weight:700; font-size:10px; text-align:left; }
  td.n { text-align:right; font-variant-numeric: tabular-nums; }
  .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:0; }
  .grid .k { color:#6b5a2e; text-transform:uppercase; font-size:9.5px; letter-spacing:.4px; margin-top:4px; }
  .grid .v { font-weight:600; padding-bottom:6px; border-bottom:1px dashed #e2d9bd; }
  .amt-band { background:#fdf6e3; border:1px solid #e0d3ac; padding:10px 14px; margin:12px 0; display:flex; justify-content:space-between; align-items:center; border-radius:4px; }
  .amt-band .lbl { color:#6b5a2e; text-transform:uppercase; letter-spacing:.4px; font-size:10px; }
  .amt-band .val { font-size:15px; font-weight:700; color:#111; }
  .words { font-style: italic; color:#555; margin-top:2px; }
  .signs { display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; margin-top:26px; }
  .signs .b { border-top:1px solid #333; padding-top:6px; text-align:center; font-size:10px; color:#333; }
  .footer { border-top:1px solid #eee; padding-top:6px; margin-top:18px; font-size:9.5px; color:#666; display:flex; justify-content:space-between; }
  .stamp { display:inline-block; padding:2px 10px; border-radius:12px; font-weight:600; letter-spacing:.4px; font-size:10px; background:#efe4c4; color:#4a3a12; }
</style></head><body>
  <div class="letterhead">
    ${logo ? `<img src="${logo}" alt="Sharnam" />` : ""}
    <div style="flex:1">
      <h1>Sharnam Project Development Consultants &amp; Co.</h1>
      <div class="co">Project management consultancy · Ahmedabad, India · info@sharnamgroup.com</div>
    </div>
    <div class="doc">
      <b>Certificate of Payment</b><br />
      Ref · ${esc(cop.certificateNumber)}<br />
      Status · <span class="stamp">${esc(cop.status)}</span>
    </div>
  </div>

  <h2>Contract particulars</h2>
  <div class="grid" style="grid-template-columns:1fr 2fr;">
    <div class="k">Project</div><div class="v">${esc(cop.project?.code)} · ${esc(cop.project?.name)}</div>
    <div class="k">Certificate type</div><div class="v">${esc(cop.certificateType)}</div>
    <div class="k">Certificate date</div><div class="v">${dt(cop.certificateDate)}</div>
    <div class="k">Contractor</div><div class="v">${esc(cop.contractor)}</div>
    <div class="k">Work / Trade</div><div class="v">${esc(cop.workTrade)}</div>
    <div class="k">Budget code</div><div class="v">${esc(cop.budgetCode)}</div>
    <div class="k">Purchase order</div><div class="v">${esc(cop.purchaseOrder?.poNumber || cop.poNumberDate)} · ${dt(cop.purchaseOrder?.poDate)}</div>
    <div class="k">Original WO value</div><div class="v">${inr(cop.originalWoValue)}</div>
    <div class="k">Amendment no.</div><div class="v">${esc(cop.amendmentNo)} · ${inr(cop.amendedWoValue)}</div>
    <div class="k">Invoice no. / date</div><div class="v">${esc(cop.invoiceNoDate || cop.raBill?.invoiceNumber)} · ${dt(cop.raBill?.invoiceDate)}</div>
    <div class="k">Linked RA bill</div><div class="v">${esc(cop.raBill?.raNumber)}</div>
    <div class="k">PAN · GST</div><div class="v">${esc(cop.panNumber)} · ${esc(cop.gstNumber)}</div>
  </div>

  <h2>Amount worked out</h2>
  <table>
    <thead><tr><th>Description</th><th style="width:22%">Amount (INR)</th></tr></thead>
    <tbody>
      <tr><td>Amount certified this bill</td><td class="n">${inr(cop.amountCertified)}</td></tr>
      <tr><td>Add: GST as applicable</td><td class="n">${inr(cop.gstAmount)}</td></tr>
      <tr><td>Less: Retention (as per contract)</td><td class="n">(${inr(cop.retentionAmount)})</td></tr>
      <tr><td><b>Net payable to contractor</b></td><td class="n"><b>${inr(cop.amountPayable)}</b></td></tr>
    </tbody>
  </table>

  <div class="amt-band">
    <div>
      <div class="lbl">Net payable · figures</div>
      <div class="val">${inr(cop.amountPayable)}</div>
      <div class="words">${esc(amountInWordsInr(cop.amountPayable))} rupees only.</div>
    </div>
    <div style="text-align:right">
      <div class="lbl">Payable to</div>
      <div class="val" style="font-size:12px;">${esc(cop.payableTo || cop.contractor)}</div>
    </div>
  </div>

  <h2>PMC remarks</h2>
  <div style="border:1px solid #d6c691; padding:8px 10px; min-height:44px; border-radius:4px;">${esc(cop.remarks || "—")}</div>

  <div class="signs">
    <div class="b">Prepared by · Sharnam PMC</div>
    <div class="b">Certified by · Client Representative</div>
    <div class="b">Received by · Contractor</div>
  </div>

  <div class="footer">
    <span>Certificate generated ${dt(new Date())} — this is a Sharnam PMC controlled document.</span>
    <span>Sharnam Project Development Consultants &amp; Co. · Confidential</span>
  </div>
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

/** Generate Viatrix COP and save to 09.01 Interim Bill folder on DMS. */
financeRouter.post("/:projectId/cop/:copId/save-to-dms", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });
  const cop = await prisma.certificateOfPayment.findFirst({
    where: { id: req.params.copId, projectId: project.id },
  });
  if (!cop) return res.status(404).json({ error: "COP not found" });
  const { saveViatrixCopToDms } = await import("../modules/finance/copWorkbook.js");
  const out = await saveViatrixCopToDms(cop.id, (code, folder, name, buf) =>
    mockOneDrive.upload(code, folder, name, buf)
  );
  await audit("finance.cop.export", { userId: req.user!.id, entity: "CertificateOfPayment", entityId: cop.id, meta: { filename: out.filename } });
  res.json(out);
});

/** Upload all certified COP workbooks for this project to SharePoint / DMS (09.01 Interim Bill). */
financeRouter.post("/:projectId/cop/upload-all-to-dms", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "not found" });
  const cops = await prisma.certificateOfPayment.findMany({
    where: { projectId: project.id, status: { not: "Draft" } },
    orderBy: { certificateDate: "asc" },
  });
  const { saveViatrixCopToDms } = await import("../modules/finance/copWorkbook.js");
  const results: { copId: string; certificateNumber: string; ok: boolean; filename?: string; url?: string; error?: string }[] = [];
  for (const cop of cops) {
    try {
      const out = await saveViatrixCopToDms(cop.id, (code, folder, name, buf) =>
        mockOneDrive.upload(code, folder, name, buf)
      );
      results.push({ copId: cop.id, certificateNumber: cop.certificateNumber, ok: true, filename: out.filename, url: out.url ?? undefined });
    } catch (err) {
      results.push({ copId: cop.id, certificateNumber: cop.certificateNumber, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  await audit("finance.cop.upload.all", { userId: req.user!.id, entity: "Project", entityId: project.id, meta: { count: results.length } });
  res.json({ ok: true, projectCode: project.code, uploaded: results.filter((r) => r.ok).length, results });
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
  const { syncCopToCashflow } = await import("../modules/finance/cashflowSync.js");
  await syncCopToCashflow(row.projectId);
  res.json(row);
});

financeRouter.delete("/cop/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.certificateOfPayment.findUnique({ where: { id: req.params.id } });
  await prisma.certificateOfPayment.delete({ where: { id: req.params.id } });
  if (before) {
    const { syncCopToCashflow } = await import("../modules/finance/cashflowSync.js");
    await syncCopToCashflow(before.projectId);
  }
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

/* ─────────────────────────────────────────  MATERIAL INVOICES  ───────────────────────────────────────── */

financeRouter.get("/:projectId/material-invoices", async (req, res) => {
  const pkg = resolveFinancePackage(String(req.query.discipline || req.query.package || ""));
  const rows = await prisma.financeMaterialInvoice.findMany({
    where: { projectId: req.params.projectId },
    orderBy: [{ sheetCategory: "asc" }, { receivedDate: "asc" }],
  });
  res.json(pkg ? rows.filter((r) => materialMatchesPackage(r, pkg)) : rows);
});

financeRouter.post("/:projectId/material-invoices", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const pkg = resolveFinancePackage(s(req.body.packageKey) || s(req.body.sheetCategory) || s(req.body.discipline) || "");
  const sheetCategory = s(req.body.sheetCategory) || pkg?.sheetName || "Other";
  const created = await prisma.financeMaterialInvoice.create({
    data: {
      projectId: req.params.projectId,
      sheetCategory,
      srNo: s(req.body.srNo) || null,
      receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : null,
      description: s(req.body.description) || "Invoice line",
      vehicleNo: s(req.body.vehicleNo) || null,
      taxInvoiceNo: s(req.body.taxInvoiceNo) || null,
      invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : null,
      amountWithoutGst: num(req.body.amountWithoutGst),
      amountWithGst: num(req.body.amountWithGst),
      gstAmount: num(req.body.gstAmount),
      retentionAmount: num(req.body.retentionAmount),
      netPayable: num(req.body.netPayable) || num(req.body.amountWithGst),
      againstBillRaised: num(req.body.againstBillRaised),
      notes: s(req.body.notes) || null,
    },
  });
  res.status(201).json(created);
});

financeRouter.put("/material-invoices/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.financeMaterialInvoice.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const data: Record<string, unknown> = {};
  if (req.body.sheetCategory != null) data.sheetCategory = s(req.body.sheetCategory) || before.sheetCategory;
  if (req.body.srNo != null) data.srNo = s(req.body.srNo) || null;
  if (req.body.receivedDate !== undefined) data.receivedDate = req.body.receivedDate ? new Date(req.body.receivedDate) : before.receivedDate;
  if (req.body.description != null) data.description = s(req.body.description) || before.description;
  if (req.body.taxInvoiceNo != null) data.taxInvoiceNo = s(req.body.taxInvoiceNo) || null;
  if (req.body.invoiceDate !== undefined) data.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : before.invoiceDate;
  for (const k of ["amountWithoutGst", "amountWithGst", "gstAmount", "retentionAmount", "netPayable", "againstBillRaised"] as const) {
    if (req.body[k] != null && req.body[k] !== "") data[k] = num(req.body[k]);
  }
  if (req.body.notes != null) data.notes = s(req.body.notes) || null;
  const row = await prisma.financeMaterialInvoice.update({ where: { id: req.params.id }, data });
  res.json(row);
});

financeRouter.delete("/material-invoices/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.financeMaterialInvoice.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─────────────────────────────────────────  PAYMENT SUMMARY WORKBOOK  ───────────────────────────────────────── */

financeRouter.get("/:projectId/payment-summary/download.xlsx", async (req, res) => {
  const { buildPaymentSummaryWorkbook } = await import("../modules/finance/paymentSummaryWorkbook.js");
  const buf = await buildPaymentSummaryWorkbook(req.params.projectId);
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { code: true } });
  const filename = `Payment-Summary-${project?.code || "export"}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

financeRouter.post("/:projectId/payment-summary/sync-template", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { syncPaymentSummaryTemplate } = await import("../modules/finance/paymentSummaryWorkbook.js");
  const out = await syncPaymentSummaryTemplate(req.params.projectId);
  await audit("finance.paymentSummary.sync", { userId: req.user!.id, entity: "Project", entityId: req.params.projectId, meta: out });
  res.json(out);
});

financeRouter.post("/:projectId/payment-summary/import", requireRoles("admin", "office"), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload Payment Summary xlsx" });
  const { importPaymentSummaryWorkbook } = await import("../modules/finance/paymentSummaryWorkbook.js");
  const out = await importPaymentSummaryWorkbook(req.params.projectId, req.file.buffer, req.body.replace === "1", s(req.body.discipline) || undefined);
  res.json(out);
});

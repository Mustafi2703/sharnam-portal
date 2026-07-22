import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

vendorsRouter.get("/", async (_req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });
  res.json(vendors);
});

vendorsRouter.post("/", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const v = await prisma.vendor.create({
    data: {
      name: req.body.name,
      trade: req.body.trade,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country || "India",
      businessPhone: req.body.businessPhone,
      email: req.body.email,
      website: req.body.website,
      primaryContactName: req.body.primaryContactName,
      licenseNumber: req.body.licenseNumber,
      gstNumber: req.body.gstNumber,
      isUnionMember: !!req.body.isUnionMember,
      isPrequalified: !!req.body.isPrequalified,
      isMinorityOwned: !!req.body.isMinorityOwned,
      isWomenOwned: !!req.body.isWomenOwned,
      insuranceVerified: !!req.body.insuranceVerified,
      notes: req.body.notes,
      createdVia: "Manual",
    },
  });
  await audit("vendor.create", { userId: req.user!.id, entity: "Vendor", entityId: v.id });
  res.status(201).json(v);
});

vendorsRouter.patch("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const v = await prisma.vendor.update({ where: { id: req.params.id }, data: req.body });
  res.json(v);
});

vendorsRouter.get("/project/:projectId", async (req, res) => {
  const rows = await prisma.projectVendor.findMany({
    where: { projectId: req.params.projectId },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

vendorsRouter.post("/project/:projectId/assign", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { vendorId, tradeRole } = req.body;
  const row = await prisma.projectVendor.upsert({
    where: { projectId_vendorId: { projectId: req.params.projectId, vendorId } },
    create: { projectId: req.params.projectId, vendorId, tradeRole },
    update: { tradeRole },
    include: { vendor: true },
  });
  await audit("vendor.assign", { userId: req.user!.id, entity: "ProjectVendor", entityId: row.id });
  res.status(201).json(row);
});

export const rfiRouter = Router();
rfiRouter.use(requireAuth);

rfiRouter.get("/project/:projectId", async (req: AuthedRequest, res) => {
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const canRespond = await roleOnRfiMatrix(req.params.projectId, req.user!.role);
  const rfis = await prisma.rfi.findMany({
    where: { projectId: req.params.projectId },
    include: {
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
      drawing: { select: { id: true, drawingNumber: true, title: true } },
      vendor: { select: { id: true, name: true } },
      responses: { include: { respondedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ rfis, canRespond, canClose: canRespond, matrixGate: true });
});

rfiRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee", "client", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.rfi.count({ where: { projectId: req.params.projectId } });
  const isClient = req.user!.role === "client";
  const number = req.body.number || `${isClient ? "CON" : "RFI"}-${String(count + 1).padStart(3, "0")}`;
  const due = req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 7 * 86400000);

  const rfi = await prisma.rfi.create({
    data: {
      projectId: req.params.projectId,
      number,
      subject: req.body.subject,
      question: req.body.question,
      status: req.body.status || "Open",
      ballInCourt: "Assignee",
      assignedToId: req.body.assignedToId || null,
      createdById: req.user!.id,
      dueDate: due,
      linkedDrawingId: isClient ? null : req.body.linkedDrawingId || null,
      linkedChecklistItemId: req.body.linkedChecklistItemId || null,
      attachmentsJson: req.body.attachmentsJson ? JSON.stringify(req.body.attachmentsJson) : req.body.attachmentNote || null,
      responsibleVendorId: req.body.responsibleVendorId || null,
      scheduleImpact: req.body.scheduleImpact || "None",
      costImpact: req.body.costImpact || "None",
      isPrivate: !!req.body.isPrivate,
      specSectionLink: req.body.specSectionLink,
      questionReceivedFrom: isClient ? "Client portal" : req.body.questionReceivedFrom,
    },
    include: {
      assignedTo: { select: { fullName: true } },
      drawing: true,
    },
  });
  await audit("rfi.create", { userId: req.user!.id, entity: "Rfi", entityId: rfi.id });
  res.status(201).json(rfi);
});

rfiRouter.post("/:id/respond", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only roles listed on this project's Communication Matrix (RFI rows) can respond. Ask Sharnam office to add your role.",
    });
  }
  const response = await prisma.rfiResponse.create({
    data: {
      rfiId: req.params.id,
      respondedById: req.user!.id,
      responseText: req.body.responseText,
      responseChannel: req.body.responseChannel || "Web",
      isOfficialResponse: !!req.body.isOfficialResponse,
    },
  });
  await prisma.rfi.update({
    where: { id: req.params.id },
    data: {
      status: req.body.close ? "Answered" : "Open",
      ballInCourt: req.body.isOfficialResponse ? "Creator" : "Assignee",
      closedAt: req.body.close ? new Date() : null,
    },
  });
  res.status(201).json(response);
});

rfiRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only Communication Matrix parties (or Sharnam office) can close / update this RFI.",
    });
  }
  const rfi = await prisma.rfi.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      assignedToId: req.body.assignedToId,
      closedAt: req.body.status === "Closed" ? new Date() : undefined,
    },
  });
  res.json(rfi);
});

rfiRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  await prisma.rfiResponse.deleteMany({ where: { rfiId: existing.id } });
  await prisma.rfi.delete({ where: { id: existing.id } });
  await audit("rfi.delete", { userId: req.user!.id, entity: "Rfi", entityId: existing.id });
  res.json({ ok: true });
});

export const inspectionsRouter = Router();
inspectionsRouter.use(requireAuth);

inspectionsRouter.get("/project/:projectId", async (req, res) => {
  const rows = await prisma.qualityInspection.findMany({
    where: { projectId: req.params.projectId },
    include: {
      createdBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
      drawing: { select: { drawingNumber: true, title: true, isPublished: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  res.json({ inspections: rows, canInspect: published > 0, publishedDrawings: published });
});

inspectionsRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  if (published === 0) {
    return res.status(400).json({
      error: "QA / Inspections blocked until at least one drawing is published for this project.",
    });
  }

  const itemsFromBody: { description: string; autoGenerateRfi?: boolean }[] = req.body.items || [];
  let items = itemsFromBody;

  if (req.body.checklistTemplateId) {
    const tpl = await prisma.checklistTemplate.findUnique({
      where: { id: req.body.checklistTemplateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (tpl?.items?.length) {
      items = tpl.items.map((it) => ({ description: `${it.itemCode ? it.itemCode + " — " : ""}${it.description}` }));
    }
  }

  if (!items.length) {
    items = [
      { description: "Work matches approved drawing revision" },
      { description: "Materials as specified" },
      { description: "Workmanship acceptable" },
      { description: "Safety compliance verified" },
      { description: "Ready for next activity", autoGenerateRfi: true },
    ];
  }

  const inspection = await prisma.qualityInspection.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      inspectionType: req.body.inspectionType || "Quality",
      status: req.body.status || "Draft",
      location: req.body.location,
      linkedDrawingId: req.body.linkedDrawingId || null,
      checklistTemplateId: req.body.checklistTemplateId || null,
      trade: req.body.trade,
      createdById: req.user!.id,
      assignedToId: req.body.assignedToId || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
      items: {
        create: items.map((it, i) => ({
          description: it.description,
          sortOrder: i + 1,
          autoGenerateRfi: !!it.autoGenerateRfi,
        })),
      },
    },
    include: { items: true, drawing: true, assignedTo: { select: { fullName: true } } },
  });

  // Store under Mock OneDrive by drawing discipline (Procore-style folder by type)
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (project) {
    await mockOneDrive.ensureProjectTree(project.id);
    const drawing = inspection.linkedDrawingId
      ? await prisma.drawing.findUnique({ where: { id: inspection.linkedDrawingId } })
      : null;
    const disc = drawing?.discipline || "Architecture";
    await mockOneDrive.upload(
      project.code,
      `Inspections/${disc}`,
      `${inspection.id}-meta.txt`,
      Buffer.from(
        `Inspection: ${inspection.title}\nType: ${inspection.inspectionType}\nDrawing: ${drawing?.drawingNumber || "n/a"}\n`
      )
    );
  }

  await audit("inspection.create", { userId: req.user!.id, entity: "QualityInspection", entityId: inspection.id });
  res.status(201).json(inspection);
});

inspectionsRouter.post("/:id/items", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const inspection = await prisma.qualityInspection.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!inspection) return res.status(404).json({ error: "Not found" });
  const item = await prisma.inspectionItem.create({
    data: {
      inspectionId: inspection.id,
      description: req.body.description,
      sortOrder: (inspection.items?.length || 0) + 1,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      autoGenerateRfi: !!req.body.autoGenerateRfi,
    },
  });
  res.status(201).json(item);
});

inspectionsRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.qualityInspection.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      assignedToId: req.body.assignedToId,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      completedAt: req.body.status === "Closed" ? new Date() : undefined,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
    include: { items: true, assignedTo: { select: { fullName: true } }, drawing: true },
  });
  res.json(row);
});

inspectionsRouter.patch("/items/:itemId", requireRoles("admin", "office", "site_employee", "vendor", "employee"), async (req: AuthedRequest, res) => {
  const item = await prisma.inspectionItem.update({
    where: { id: req.params.itemId },
    data: {
      status: req.body.status,
      remarks: req.body.remarks,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      ...(req.body.attachmentsJson !== undefined ? { attachmentsJson: req.body.attachmentsJson } : {}),
    },
    include: { inspection: true },
  });

  // Auto-generate RFI when unresolved
  if (req.body.status === "Unresolved" && item.autoGenerateRfi && !item.linkedRfiId) {
    const count = await prisma.rfi.count({ where: { projectId: item.inspection.projectId } });
    const rfi = await prisma.rfi.create({
      data: {
        projectId: item.inspection.projectId,
        number: `RFI-${String(count + 1).padStart(3, "0")}`,
        subject: `Inspection issue: ${item.inspection.title}`,
        question: `${item.description}${item.remarks ? `\n\nRemarks: ${item.remarks}` : ""}`,
        status: "Open",
        ballInCourt: "Assignee",
        createdById: req.user!.id,
        linkedDrawingId: item.inspection.linkedDrawingId,
        dueDate: new Date(Date.now() + 5 * 86400000),
      },
    });
    await prisma.inspectionItem.update({
      where: { id: item.id },
      data: { linkedRfiId: rfi.id },
    });
    return res.json({ ...item, linkedRfiId: rfi.id, generatedRfi: rfi });
  }

  res.json(item);
});

inspectionsRouter.post(
  "/items/:itemId/attachments",
  requireRoles("admin", "office", "site_employee", "vendor", "employee"),
  upload.array("files", 10),
  async (req: AuthedRequest, res) => {
    const item = await prisma.inspectionItem.findUnique({
      where: { id: req.params.itemId },
      include: { inspection: { include: { project: true } } },
    });
    if (!item) return res.status(404).json({ error: "Item not found" });
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: "No files" });
    const comment = typeof req.body.comment === "string" ? req.body.comment : "";
    const existing: { url: string; name: string; kind: string; comment?: string }[] = (() => {
      try {
        return JSON.parse(item.attachmentsJson || "[]");
      } catch {
        return [];
      }
    })();
    for (const f of files) {
      const kind = f.mimetype?.startsWith("image/") ? "photo" : "doc";
      const saved = await mockOneDrive.upload(
        item.inspection.project.code,
        "Inspections",
        f.originalname,
        f.buffer
      );
      existing.push({ url: saved.url, name: f.originalname, kind, comment: comment || undefined });
    }
    const updated = await prisma.inspectionItem.update({
      where: { id: item.id },
      data: {
        attachmentsJson: JSON.stringify(existing),
        remarks: req.body.remarks !== undefined ? req.body.remarks : item.remarks,
      },
    });
    res.json(updated);
  }
);

inspectionsRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.inspectionItem.deleteMany({ where: { inspectionId: req.params.id } });
  await prisma.qualityInspection.delete({ where: { id: req.params.id } });
  await audit("inspection.delete", { userId: req.user!.id, entity: "QualityInspection", entityId: req.params.id });
  res.json({ ok: true });
});

inspectionsRouter.post("/:id/complete", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.qualityInspection.update({
    where: { id: req.params.id },
    data: { status: "Completed", completedAt: new Date() },
  });
  res.json(row);
});

export const directoryRouter = Router();
directoryRouter.use(requireAuth);

directoryRouter.get("/project/:projectId/overview", async (req, res) => {
  const projectId = req.params.projectId;
  const [members, vendors, drawings, rfis, inspections, submittals, photos, coordination] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, email: true, role: true, phone: true } } },
    }),
    prisma.projectVendor.findMany({ where: { projectId }, include: { vendor: true } }),
    prisma.drawing.findMany({ where: { projectId } }),
    prisma.rfi.findMany({ where: { projectId } }),
    prisma.qualityInspection.findMany({ where: { projectId } }),
    prisma.submittal.findMany({ where: { projectId } }),
    prisma.projectPhoto.findMany({ where: { projectId }, take: 20, orderBy: { createdAt: "desc" } }),
    prisma.designCoordinationIssue.findMany({ where: { projectId } }),
  ]);
  res.json({
    members,
    vendors,
    stats: {
      drawings: drawings.length,
      publishedDrawings: drawings.filter((d) => d.isPublished).length,
      openRfis: rfis.filter((r) => r.status === "Open").length,
      inspections: inspections.length,
      submittals: submittals.length,
      photos: photos.length,
      coordinationOpen: coordination.filter((c) => c.status === "Open").length,
    },
    photos,
    submittals,
    coordination,
  });
});

directoryRouter.post("/project/:projectId/submittals", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.submittal.count({ where: { projectId: req.params.projectId } });
  const row = await prisma.submittal.create({
    data: {
      projectId: req.params.projectId,
      number: req.body.number || `SUB-${String(count + 1).padStart(3, "0")}`,
      title: req.body.title,
      submittalType: req.body.submittalType || "Product Data",
      status: req.body.status || "Draft",
      ballInCourt: req.body.ballInCourt || "Submitter",
      specSection: req.body.specSection,
      description: req.body.description || null,
      revisionNumber: req.body.revisionNumber || "0",
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
    },
  });
  await audit("submittal.create", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.status(201).json(row);
});

directoryRouter.patch("/submittals/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const row = await prisma.submittal.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      submittalType: req.body.submittalType,
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      specSection: req.body.specSection,
      description: req.body.description,
      revisionNumber: req.body.revisionNumber,
      reviewerNotes: req.body.reviewerNotes,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      attachmentsJson: req.body.attachmentsJson !== undefined
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
  });
  await audit("submittal.update", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.json(row);
});

directoryRouter.get("/project/:projectId/submittals", async (req, res) => {
  const rows = await prisma.submittal.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows);
});

directoryRouter.get("/project/:projectId/photos", async (req, res) => {
  const album = req.query.album ? String(req.query.album) : undefined;
  const rows = await prisma.projectPhoto.findMany({
    where: { projectId: req.params.projectId, ...(album ? { album } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const albums = await prisma.projectPhoto.groupBy({
    by: ["album"],
    where: { projectId: req.params.projectId },
    _count: true,
  });
  res.json({ photos: rows, albums });
});

directoryRouter.post(
  "/project/:projectId/photos",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    let fileUrl = req.body.fileUrl || "";
    if (req.file) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const saved = await mockOneDrive.upload(project.code, "Photos", req.file.originalname, req.file.buffer);
      fileUrl = saved.url;
    }
    if (!fileUrl) fileUrl = `/uploads/photos/placeholder-${Date.now()}.txt`;
    const row = await prisma.projectPhoto.create({
      data: {
        projectId: req.params.projectId,
        fileUrl,
        album: req.body.album || "Site Progress",
        description: req.body.description,
        trade: req.body.trade,
        location: req.body.location,
        isPrivate: req.body.isPrivate === "true" || req.body.isPrivate === true,
      },
    });
    await audit("photo.create", { userId: req.user!.id, entity: "ProjectPhoto", entityId: row.id });
    res.status(201).json(row);
  }
);

directoryRouter.delete("/photos/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  await prisma.projectPhoto.delete({ where: { id: req.params.id } });
  await audit("photo.delete", { userId: req.user!.id, entity: "ProjectPhoto", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/submittals/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.submittal.delete({ where: { id: req.params.id } });
  await audit("submittal.delete", { userId: req.user!.id, entity: "Submittal", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/coordination/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.designCoordinationIssue.delete({ where: { id: req.params.id } });
  await audit("coordination.delete", { userId: req.user!.id, entity: "DesignCoordinationIssue", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.post("/project/:projectId/coordination", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body.description,
      discipline: req.body.discipline,
      location: req.body.location,
      priority: req.body.priority || "Medium",
      ballInCourt: req.body.ballInCourt || "Assignee",
      linkedDrawingId: req.body.linkedDrawingId || null,
      assignedToName: req.body.assignedToName || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
  });
  res.status(201).json(row);
});

directoryRouter.patch("/coordination/:id", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      location: req.body.location,
      discipline: req.body.discipline,
      ballInCourt: req.body.ballInCourt,
      assignedToName: req.body.assignedToName,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    },
  });
  res.json(row);
});

export const safetyRouter = Router();
safetyRouter.use(requireAuth);

safetyRouter.get("/project/:projectId", async (req, res) => {
  const records = await prisma.safetyRecord.findMany({
    where: { projectId: req.params.projectId },
    include: {
      reportedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
  const open = records.filter((r) => r.status === "Open").length;
  const incidents = records.filter((r) => r.recordType === "Incident" || r.recordType === "Near Miss").length;
  res.json({ records, stats: { total: records.length, open, incidents } });
});

safetyRouter.post(
  "/project/:projectId",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const row = await prisma.safetyRecord.create({
      data: {
        projectId: req.params.projectId,
        recordType: req.body.recordType || "Observation",
        title: req.body.title,
        description: req.body.description,
        severity: req.body.severity || "Low",
        status: req.body.status || "Open",
        location: req.body.location,
        correctiveAction: req.body.correctiveAction,
        occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : new Date(),
        reportedById: req.user!.id,
        assignedToId: req.body.assignedToId || null,
      },
      include: {
        reportedBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
      },
    });
    await audit("safety.create", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
    res.status(201).json(row);
  }
);

safetyRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const status = req.body.status;
  const row = await prisma.safetyRecord.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      description: req.body.description,
      severity: req.body.severity,
      status,
      location: req.body.location,
      correctiveAction: req.body.correctiveAction,
      assignedToId: req.body.assignedToId,
      closedAt: status === "Closed" ? new Date() : req.body.closedAt ? new Date(req.body.closedAt) : undefined,
    },
    include: {
      reportedBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });
  await audit("safety.update", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
  res.json(row);
});

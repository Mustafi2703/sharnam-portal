import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

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

rfiRouter.get("/project/:projectId", async (req, res) => {
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
  res.json(rfis);
});

rfiRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee", "client"), async (req: AuthedRequest, res) => {
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

rfiRouter.post("/:id/respond", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
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

rfiRouter.patch("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
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

inspectionsRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  if (published === 0) {
    return res.status(400).json({
      error: "QA / Inspections blocked until at least one drawing is published for this project.",
    });
  }

  const items: { description: string; autoGenerateRfi?: boolean }[] = req.body.items || [
    { description: "Work matches approved drawing revision" },
    { description: "Materials as specified" },
    { description: "Workmanship acceptable" },
    { description: "Safety compliance verified" },
    { description: "Ready for next activity", autoGenerateRfi: true },
  ];

  const inspection = await prisma.qualityInspection.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      inspectionType: req.body.inspectionType || "Quality",
      location: req.body.location,
      linkedDrawingId: req.body.linkedDrawingId || null,
      trade: req.body.trade,
      createdById: req.user!.id,
      assignedToId: req.body.assignedToId || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      items: {
        create: items.map((it, i) => ({
          description: it.description,
          sortOrder: i + 1,
          autoGenerateRfi: !!it.autoGenerateRfi,
        })),
      },
    },
    include: { items: true, drawing: true },
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

inspectionsRouter.patch("/items/:itemId", requireRoles("admin", "office", "site_employee", "vendor"), async (req: AuthedRequest, res) => {
  const item = await prisma.inspectionItem.update({
    where: { id: req.params.itemId },
    data: { status: req.body.status, remarks: req.body.remarks },
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

directoryRouter.post("/project/:projectId/submittals", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const count = await prisma.submittal.count({ where: { projectId: req.params.projectId } });
  const row = await prisma.submittal.create({
    data: {
      projectId: req.params.projectId,
      number: req.body.number || `SUB-${String(count + 1).padStart(3, "0")}`,
      title: req.body.title,
      submittalType: req.body.submittalType || "Product Data",
      status: req.body.status || "Draft",
      specSection: req.body.specSection,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
  });
  res.status(201).json(row);
});

directoryRouter.post("/project/:projectId/coordination", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body.description,
      discipline: req.body.discipline,
      location: req.body.location,
      priority: req.body.priority || "Medium",
    },
  });
  res.status(201).json(row);
});

directoryRouter.post("/project/:projectId/photos", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.projectPhoto.create({
    data: {
      projectId: req.params.projectId,
      fileUrl: req.body.fileUrl || "/uploads/placeholder-photo.txt",
      album: req.body.album || "Unclassified",
      description: req.body.description,
      trade: req.body.trade,
      location: req.body.location,
    },
  });
  res.status(201).json(row);
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

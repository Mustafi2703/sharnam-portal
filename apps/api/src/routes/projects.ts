import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { audit } from "../services/audit.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  if (role === "admin" || role === "office") {
    const projects = await prisma.project.findMany({
      include: { _count: { select: { drawings: true, members: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(projects);
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user!.id },
    include: {
      project: { include: { _count: { select: { drawings: true, members: true } } } },
    },
  });
  res.json(memberships.map((m) => m.project));
});

projectsRouter.post("/", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const {
    code,
    name,
    clientName,
    location,
    status,
    clientContactName,
    clientEmail,
    clientPhone,
    clientAddress,
    clientGst,
    designConsultant,
    contractorName,
  } = req.body;
  if (!code || !name) return res.status(400).json({ error: "code and name required" });
  const project = await prisma.project.create({
    data: {
      code,
      name,
      clientName,
      location,
      status: status || "Planning",
      clientContactName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientGst,
      designConsultant,
      contractorName,
    },
  });
  await mockOneDrive.ensureProjectTree(project.id);
  await audit("project.create", { userId: req.user!.id, entity: "Project", entityId: project.id });
  res.status(201).json(project);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
      drawings: { include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } } },
      _count: { select: { dailyLogs: true, checklistAssignments: true } },
    },
  });
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

projectsRouter.patch("/:id/settings", requireRoles("admin", "office", "employee"), async (req: AuthedRequest, res) => {
  const {
    notificationEmails,
    emailFromName,
    emailEnabled,
    notifyOnDrawingPublish,
    notifyOnChecklistSubmit,
    outlookMailbox,
    outlookConnected,
    clientName,
    location,
    status,
    name,
    clientContactName,
    clientEmail,
    clientPhone,
    clientAddress,
    clientGst,
    designConsultant,
    contractorName,
  } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      notificationEmails: notificationEmails !== undefined ? String(notificationEmails) : undefined,
      emailFromName: emailFromName !== undefined ? String(emailFromName) : undefined,
      emailEnabled: typeof emailEnabled === "boolean" ? emailEnabled : undefined,
      notifyOnDrawingPublish: typeof notifyOnDrawingPublish === "boolean" ? notifyOnDrawingPublish : undefined,
      notifyOnChecklistSubmit: typeof notifyOnChecklistSubmit === "boolean" ? notifyOnChecklistSubmit : undefined,
      outlookMailbox: outlookMailbox !== undefined ? String(outlookMailbox || "") || null : undefined,
      outlookConnected: typeof outlookConnected === "boolean" ? outlookConnected : undefined,
      outlookConnectedAt:
        typeof outlookConnected === "boolean"
          ? outlookConnected
            ? new Date()
            : null
          : undefined,
      clientName: clientName !== undefined ? clientName : undefined,
      location: location !== undefined ? location : undefined,
      status: status !== undefined ? status : undefined,
      name: name !== undefined ? name : undefined,
      clientContactName: clientContactName !== undefined ? clientContactName : undefined,
      clientEmail: clientEmail !== undefined ? clientEmail : undefined,
      clientPhone: clientPhone !== undefined ? clientPhone : undefined,
      clientAddress: clientAddress !== undefined ? clientAddress : undefined,
      clientGst: clientGst !== undefined ? clientGst : undefined,
      designConsultant: designConsultant !== undefined ? designConsultant : undefined,
      contractorName: contractorName !== undefined ? contractorName : undefined,
    },
  });
  await audit("project.settings", { userId: req.user!.id, entity: "Project", entityId: project.id });
  res.json(project);
});

projectsRouter.get("/:id/emails", requireRoles("admin", "office", "employee", "site_employee"), async (req, res) => {
  const rows = await prisma.emailOutbox.findMany({
    where: { projectId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(rows);
});

projectsRouter.post("/:id/emails/send", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const { queueProjectEmail } = await import("../services/email.js");
  const result = await queueProjectEmail({
    projectId: req.params.id,
    subject: req.body.subject || "Project notice",
    body: req.body.body || "",
    context: req.body.context || "manual",
    createdById: req.user!.id,
    toOverride: req.body.toEmails,
  });
  if (result.skipped) return res.status(400).json({ error: result.reason });
  res.status(201).json(result.email);
});

projectsRouter.post("/:id/members", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { userId, role } = req.body;
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: req.params.id, userId } },
    create: { projectId: req.params.id, userId, role: role || "member" },
    update: { role: role || "member" },
  });
  res.json(member);
});

export const dmsRouter = Router();
dmsRouter.use(requireAuth);

dmsRouter.post("/:projectId/sync", async (req: AuthedRequest, res) => {
  const result = await mockOneDrive.sync(req.params.projectId);
  await audit("dms.sync", { userId: req.user!.id, entity: "Project", entityId: req.params.projectId });
  res.json({ ok: true, ...result, message: "Mock OneDrive sync complete (Azure Graph ready to swap later)" });
});

dmsRouter.get("/:projectId/browse", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Not found" });
  const folderPath = String(req.query.path || "");
  // Sync-on-open: refresh tree (and later Graph delta) when a folder is opened
  const syncOnOpen = String(req.query.sync || "1") !== "0";
  let syncedAt: string | null = null;
  if (syncOnOpen) {
    await mockOneDrive.ensureProjectTree(project.id);
    if (folderPath) {
      await mockOneDrive.touchFolder(project.id, folderPath);
    }
    syncedAt = new Date().toISOString();
  }
  const folders = await prisma.documentFolder.findMany({ where: { projectId: project.id } });
  const children = mockOneDrive.listChildren(project.code, folderPath);
  res.json({
    projectCode: project.code,
    path: folderPath,
    fullPath: `/onedrive/${project.code}/${folderPath}`.replace(/\/+/g, "/").replace(/\/$/, "") || `/onedrive/${project.code}`,
    children,
    folders,
    syncedAt,
    provider: "mock-onedrive",
    note: "Browsable now; Microsoft Graph swap uses same browse+sync-on-open contract.",
  });
});

dmsRouter.post(
  "/:projectId/upload",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    if (!req.file) return res.status(400).json({ error: "file required" });
    const folder = String(req.body.folder || "Documents");
    const saved = await mockOneDrive.upload(project.code, folder, req.file.originalname, req.file.buffer);
    await audit("dms.upload", { userId: req.user!.id, entity: "Project", entityId: project.id, meta: saved });
    res.json(saved);
  }
);

export const drawingsRouter = Router();
drawingsRouter.use(requireAuth);

drawingsRouter.get("/project/:projectId", async (req, res) => {
  const drawings = await prisma.drawing.findMany({
    where: { projectId: req.params.projectId },
    include: {
      revisions: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: { fullName: true } } },
      },
    },
    orderBy: { drawingNumber: "asc" },
  });
  res.json(drawings);
});

drawingsRouter.get("/project/:projectId/gate", async (req, res) => {
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  res.json({
    canSubmitChecklist: true,
    publishedCount: published,
    note: "Checklists fill via Drawing Checklist / QI RFIs — drawings are optional context, not a lock.",
  });
});

drawingsRouter.post(
  "/project/:projectId",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });

    const { drawingNumber, title, discipline, revisionNumber, publish, buildingArea, tlNo } = req.body;
    if (!drawingNumber || !title) return res.status(400).json({ error: "drawingNumber and title required" });

    let fileUrl = "";
    let fileName = "";
    if (req.file) {
      const folder = `Drawings/${discipline || "Architecture"}`;
      const saved = await mockOneDrive.upload(project.code, folder, req.file.originalname, req.file.buffer);
      fileUrl = saved.url;
      fileName = req.file.originalname;
    }

    const existing = await prisma.drawing.findUnique({
      where: { projectId_drawingNumber: { projectId: project.id, drawingNumber } },
      include: { revisions: true },
    });
    const revIndex = existing?.revisions.length ?? 0;
    const rev = revisionNumber || `R${revIndex}`;
    const published = publish === "true" || publish === true;

    const drawing = await prisma.drawing.upsert({
      where: { projectId_drawingNumber: { projectId: project.id, drawingNumber } },
      create: {
        projectId: project.id,
        drawingNumber,
        title,
        discipline: discipline || "Architecture",
        buildingArea: buildingArea || null,
        tlNo: tlNo || null,
        currentRev: rev,
        status: published ? "Approved" : "Draft",
        isPublished: published,
        folderPath: `Drawings/${discipline || "Architecture"}`,
        revisions: fileUrl
          ? {
              create: {
                revisionNumber: rev,
                revisionLabel: `${rev} — initial`,
                fileUrl,
                fileName,
                published,
                uploadedById: req.user!.id,
              },
            }
          : undefined,
      },
      update: {
        title,
        discipline: discipline || undefined,
        buildingArea: buildingArea !== undefined ? buildingArea || null : undefined,
        tlNo: tlNo !== undefined ? tlNo || null : undefined,
        currentRev: rev,
        isPublished: published || undefined,
        status: published ? "Approved" : undefined,
      },
      include: { revisions: true },
    });

    if (fileUrl && drawing.revisions.every((r) => r.fileUrl !== fileUrl)) {
      await prisma.drawingRevision.create({
        data: {
          drawingId: drawing.id,
          revisionNumber: rev,
          revisionLabel: `${rev} — upload`,
          fileUrl,
          fileName,
          published,
          uploadedById: req.user!.id,
        },
      });
    }

    await audit("drawing.upload", {
      userId: req.user!.id,
      entity: "Drawing",
      entityId: drawing.id,
      meta: { drawingNumber, revision: rev, fileName },
    });
    const fresh = await prisma.drawing.findUnique({
      where: { id: drawing.id },
      include: {
        revisions: {
          orderBy: { createdAt: "asc" },
          include: { uploadedBy: { select: { fullName: true } } },
        },
      },
    });
    res.status(201).json(fresh);
  }
);

drawingsRouter.post("/:id/publish", requireRoles("admin", "office", "employee", "site_employee", "vendor"), async (req: AuthedRequest, res) => {
  const drawing = await prisma.drawing.update({
    where: { id: req.params.id },
    data: { isPublished: true, status: "Approved" },
  });
  await prisma.drawingRevision.updateMany({
    where: { drawingId: drawing.id },
    data: { published: true },
  });
  await audit("drawing.publish", { userId: req.user!.id, entity: "Drawing", entityId: drawing.id });

  const project = await prisma.project.findUnique({ where: { id: drawing.projectId } });
  if (project?.notifyOnDrawingPublish) {
    const { queueProjectEmail } = await import("../services/email.js");
    await queueProjectEmail({
      projectId: drawing.projectId,
      subject: `Drawing published — ${drawing.drawingNumber}`,
      body: `${drawing.drawingNumber} — ${drawing.title} (${drawing.currentRev}) is now published.\nQuality / Final Index checklists and communications are unlocked for site fills.`,
      context: "drawing.publish",
      createdById: req.user!.id,
    });
  }

  res.json(drawing);
});

/** Upload a new revision onto an existing drawing register row */
drawingsRouter.post(
  "/:id/revisions",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const drawing = await prisma.drawing.findUnique({
      where: { id: req.params.id },
      include: { project: true, revisions: true },
    });
    if (!drawing) return res.status(404).json({ error: "Drawing not found" });

    const revisionNumber = String(req.body.revisionNumber || `R${drawing.revisions.length}`);
    const revisionLabel = String(req.body.revisionLabel || `${revisionNumber} — ${new Date().toLocaleDateString()}`);
    const publish = req.body.publish === "true" || req.body.publish === true;

    let fileUrl = "";
    let fileName = "";
    if (req.file) {
      const folder = drawing.folderPath || `Drawings/${drawing.discipline}`;
      const saved = await mockOneDrive.upload(
        drawing.project.code,
        folder,
        req.file.originalname,
        req.file.buffer
      );
      fileUrl = saved.url;
      fileName = req.file.originalname;
    } else {
      return res.status(400).json({ error: "File required for revision upload" });
    }

    // Keep prior revision files; mark previous live revisions unpublished when publishing this one
    if (publish) {
      await prisma.drawingRevision.updateMany({
        where: { drawingId: drawing.id, published: true },
        data: { published: false },
      });
    }

    const rev = await prisma.drawingRevision.create({
      data: {
        drawingId: drawing.id,
        revisionNumber,
        revisionLabel,
        fileUrl,
        fileName,
        published: publish,
        uploadedById: req.user!.id,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    });

    const updated = await prisma.drawing.update({
      where: { id: drawing.id },
      data: {
        currentRev: revisionNumber,
        ...(publish ? { isPublished: true, status: "Approved" } : {}),
      },
      include: {
        revisions: {
          orderBy: { createdAt: "asc" },
          include: { uploadedBy: { select: { fullName: true } } },
        },
      },
    });

    await audit("drawing.revision", {
      userId: req.user!.id,
      entity: "DrawingRevision",
      entityId: rev.id,
      meta: { drawingId: drawing.id, revisionNumber, fileName },
    });
    res.status(201).json(updated);
  }
);

/** CSV export matching Approval & GFC Drawing Log columns */
drawingsRouter.get("/project/:projectId/export.csv", async (req, res) => {
  const drawings = await prisma.drawing.findMany({
    where: { projectId: req.params.projectId },
    include: { revisions: { orderBy: { createdAt: "asc" } } },
    orderBy: { drawingNumber: "asc" },
  });
  const header = [
    "DISCIPLINE",
    "BUILDING/AREA",
    "TL No",
    "DWG. NO.",
    "TITLE",
    "Drawing Browse",
    "R0",
    "R1",
    "R2",
    "R3",
    "R4",
    "R5",
    "TOTAL",
    "Published",
    "Current Rev",
  ];
  const rows = drawings.map((d) => {
    const dates = [0, 1, 2, 3, 4, 5].map((i) =>
      d.revisions[i] ? new Date(d.revisions[i].createdAt).toISOString().slice(0, 10) : ""
    );
    const latest = d.revisions[d.revisions.length - 1];
    return [
      d.discipline,
      `"${(d.buildingArea || "").replace(/"/g, '""')}"`,
      `"${(d.tlNo || "").replace(/"/g, '""')}"`,
      d.drawingNumber,
      `"${d.title.replace(/"/g, '""')}"`,
      latest?.fileUrl || "",
      ...dates,
      String(d.revisions.length),
      d.isPublished ? "Yes" : "No",
      d.currentRev,
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="gfc-drawing-log-${req.params.projectId}.csv"`);
  res.send(csv);
});

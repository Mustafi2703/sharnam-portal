import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { PROJECT_LIBRARY_FOLDERS } from "../services/graph.js";
import { consumeDrawingUnlockToken } from "../services/drawingUnlock.js";
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

/** Default bid disciplines configured for a project (CRM package setup). */
projectsRouter.get("/:id/bid-disciplines", requireRoles("admin", "office"), async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    select: { id: true, code: true, name: true, bidDisciplinesJson: true },
  });
  if (!project) return res.status(404).json({ error: "Not found" });

  const { defaultDisciplines, parseDisciplinesJson } = await import("../services/comparativeStatement.js");
  res.json({
    projectId: project.id,
    projectCode: project.code,
    catalog: defaultDisciplines(),
    disciplines: parseDisciplinesJson(project.bidDisciplinesJson),
  });
});

projectsRouter.patch("/:id/bid-disciplines", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { defaultDisciplines, parseDisciplinesJson, resolveDisciplinesForPackage, normalizeDisciplineKey } =
    await import("../services/comparativeStatement.js");

  const disciplineKeys = Array.isArray(req.body.disciplineKeys)
    ? req.body.disciplineKeys.map((x: unknown) => normalizeDisciplineKey(String(x))).filter(Boolean)
    : undefined;
  const customDisciplines = Array.isArray(req.body.customDisciplines)
    ? req.body.customDisciplines
        .map((d: { key?: string; label?: string; sheetName?: string }) => {
          const label = String(d.label || "").trim();
          if (!label) return null;
          return {
            key: normalizeDisciplineKey(d.key || label),
            label,
            sheetName: String(d.sheetName || label).trim(),
          };
        })
        .filter(Boolean)
    : undefined;

  const disciplines = resolveDisciplinesForPackage({ disciplineKeys, customDisciplines });
  if (!disciplines.length) return res.status(400).json({ error: "Select at least one discipline" });

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { bidDisciplinesJson: JSON.stringify(disciplines) },
    select: { id: true, code: true, name: true, bidDisciplinesJson: true },
  });

  await audit("project.bid_disciplines", {
    userId: req.user!.id,
    entity: "Project",
    entityId: project.id,
    meta: { count: disciplines.length },
  });

  res.json({
    projectId: project.id,
    catalog: defaultDisciplines(),
    disciplines: parseDisciplinesJson(project.bidDisciplinesJson),
  });
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
  res.json({
    ok: true,
    ...result,
    message:
      result.provider === "sharepoint"
        ? "SharePoint project library synced"
        : "Mock OneDrive sync complete (set MOCK_ONEDRIVE=false for live SharePoint)",
  });
});

dmsRouter.get("/:projectId/folders", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json({ projectCode: project.code, folders: PROJECT_LIBRARY_FOLDERS });
});

dmsRouter.get("/:projectId/browse", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Not found" });
  const folderPath = String(req.query.path || "");
  const syncOnOpen = String(req.query.sync || "0") === "1";
  let syncedAt: string | null = null;
  if (syncOnOpen) {
    // Touch only the opened folder — full tree sync is POST /sync
    if (folderPath) {
      await mockOneDrive.touchFolder(project.id, folderPath);
    }
    syncedAt = new Date().toISOString();
  }
  const folders = await prisma.documentFolder.findMany({ where: { projectId: project.id } });
  const children = await mockOneDrive.listChildrenLive(project.code, folderPath);
  res.json({
    projectCode: project.code,
    path: folderPath,
    fullPath: `/onedrive/${project.code}/${folderPath}`.replace(/\/+/g, "/").replace(/\/$/, "") || `/onedrive/${project.code}`,
    children,
    folders,
    syncedAt,
    provider: resultProvider(children),
    note: "Browse lists SharePoint live when configured. Run Sync library to create the full ISO folder tree.",
  });
});

function resultProvider(children: { url?: string }[]) {
  const live = children.some((c) => c.url?.includes("sharepoint.com"));
  return live || process.env.MOCK_ONEDRIVE === "false" ? "sharepoint" : "mock-onedrive";
}

/** Refresh all registers → CSVs → drive. Admin / office / site */
dmsRouter.post(
  "/:projectId/dump-logs",
  requireRoles("admin", "office", "site_employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    try {
      const { dumpAllProjectLogs } = await import("../services/logDump.js");
      const result = await dumpAllProjectLogs(project.id);
      await audit("dms.dump.logs", {
        userId: req.user!.id,
        entity: "Project",
        entityId: project.id,
        meta: { registers: result.registers.map((r) => r.name), refreshedAt: result.refreshedAt },
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

dmsRouter.post(
  "/:projectId/upload",
  requireRoles("admin", "office", "site_employee"),
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

    const unlock = await consumeDrawingUnlockToken({
      projectId: project.id,
      unlockToken: req.body.unlockToken || req.body.preCheckToken,
      userId: req.user!.id,
    });
    if (!unlock.ok) return res.status(400).json({ error: unlock.error });

    const { drawingNumber, title, discipline, revisionNumber, publish, buildingArea, tlNo, plannedDate, actualDate } =
      req.body;
    if (!drawingNumber || !title) return res.status(400).json({ error: "drawingNumber and title required" });
    if (!req.file) return res.status(400).json({ error: "Drawing file required after checklist" });

    const folder = `Drawings/${discipline || "Architecture"}`;
    const saved = await mockOneDrive.upload(project.code, folder, req.file.originalname, req.file.buffer);
    const fileUrl = saved.url;
    const fileName = req.file.originalname;

    const existing = await prisma.drawing.findUnique({
      where: { projectId_drawingNumber: { projectId: project.id, drawingNumber } },
      include: { revisions: true },
    });
    const revIndex = existing?.revisions.length ?? 0;
    const rev = revisionNumber || `R${revIndex}`;
    const published = publish === "true" || publish === true;
    const planned = plannedDate ? new Date(plannedDate) : null;
    const actual = actualDate ? new Date(actualDate) : new Date();

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
        folderPath: folder,
        revisions: {
          create: {
            revisionNumber: rev,
            revisionLabel: `${rev} — initial`,
            fileUrl,
            fileName,
            published,
            plannedDate: planned,
            actualDate: actual,
            preCheckSubmissionId: unlock.submissionId,
            uploadedById: req.user!.id,
          },
        },
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

    if (drawing.revisions.every((r) => r.fileUrl !== fileUrl)) {
      await prisma.drawingRevision.create({
        data: {
          drawingId: drawing.id,
          revisionNumber: rev,
          revisionLabel: `${rev} — upload`,
          fileUrl,
          fileName,
          published,
          plannedDate: planned,
          actualDate: actual,
          preCheckSubmissionId: unlock.submissionId,
          uploadedById: req.user!.id,
        },
      });
    }

    await prisma.checklistSubmission.update({
      where: { id: unlock.submissionId },
      data: { drawingId: drawing.id },
    });

    await audit("drawing.upload", {
      userId: req.user!.id,
      entity: "Drawing",
      entityId: drawing.id,
      meta: { drawingNumber, revision: rev, fileName, preCheck: unlock.submissionId },
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

/** Add GFC register line without file — upload revision later after Drawing Check */
drawingsRouter.post(
  "/project/:projectId/register-line",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });

    const { drawingNumber, title, discipline, buildingArea, tlNo, revisionNumber } = req.body || {};
    if (!drawingNumber || !title) return res.status(400).json({ error: "drawingNumber and title required" });

    const rev = revisionNumber || "R0";
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
        status: "Draft",
        isPublished: false,
        folderPath: `Drawings/${discipline || "Architecture"}`,
      },
      update: {
        title,
        discipline: discipline || undefined,
        buildingArea: buildingArea !== undefined ? buildingArea || null : undefined,
        tlNo: tlNo !== undefined ? tlNo || null : undefined,
      },
      include: {
        revisions: {
          orderBy: { createdAt: "asc" },
          include: { uploadedBy: { select: { fullName: true } } },
        },
      },
    });

    await audit("drawing.register_line", {
      userId: req.user!.id,
      entity: "Drawing",
      entityId: drawing.id,
      meta: { drawingNumber, title, discipline },
    });
    res.status(201).json(drawing);
  }
);

drawingsRouter.get("/project/:projectId/register-dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const { loadDrawingRegisterDashboard } = await import("../services/drawingRegisterSheets.js");
  const [lines, dashboard] = await Promise.all([
    prisma.drawingRegisterLine.findMany({
      where: { projectId },
      orderBy: { srNo: "asc" },
      include: { drawing: { select: { id: true, isPublished: true, currentRev: true } } },
    }),
    Promise.resolve(loadDrawingRegisterDashboard()),
  ]);
  const groupCount = (pick: (l: (typeof lines)[number]) => string) =>
    Object.entries(
      lines.reduce((acc: Record<string, number>, line) => {
        const label = pick(line) || "Other";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {})
    ).map(([label, value]) => ({ label, value }));
  res.json({
    dashboard,
    totals: {
      lines: lines.length,
      gfc: lines.filter((l) => /gfc|good for construction/i.test(l.drawingType || "")).length,
      critical: lines.filter((l) => /yes/i.test(l.criticalDrawing || "")).length,
      linkedGfc: lines.filter((l) => l.drawingId).length,
      delayed: lines.filter((l) => (l.submissionDelayDays ?? 0) > 0).length,
    },
    charts: {
      byDiscipline: groupCount((l) => l.discipline || "Other"),
      byDrawingType: groupCount((l) => l.drawingType || "Other"),
      byCritical: groupCount((l) => (l.criticalDrawing || "No").trim()),
    },
    lines,
  });
});

drawingsRouter.post(
  "/project/:projectId/register-lines",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.drawingNumber || !body.drawingTitle) {
      return res.status(400).json({ error: "drawingNumber and drawingTitle required" });
    }
    const row = await prisma.drawingRegisterLine.upsert({
      where: {
        projectId_drawingNumber: {
          projectId: req.params.projectId,
          drawingNumber: body.drawingNumber,
        },
      },
      create: {
        projectId: req.params.projectId,
        srNo: body.srNo ? Number(body.srNo) : null,
        projectPackage: body.projectPackage || null,
        building: body.building || null,
        discipline: body.discipline || null,
        drawingNumber: body.drawingNumber,
        drawingTitle: body.drawingTitle,
        drawingType: body.drawingType || null,
        consultantName: body.consultantName || null,
        revisionNumber: body.revisionNumber || null,
        revisionDate: body.revisionDate ? new Date(body.revisionDate) : null,
        revisionDescription: body.revisionDescription || null,
        latestRevision: body.latestRevision || null,
        plannedSubmissionDate: body.plannedSubmissionDate ? new Date(body.plannedSubmissionDate) : null,
        actualSubmissionDate: body.actualSubmissionDate ? new Date(body.actualSubmissionDate) : null,
        submissionDelayDays: body.submissionDelayDays != null ? Number(body.submissionDelayDays) : null,
        delayResponsibility: body.delayResponsibility || null,
        issuedTo: body.issuedTo || null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        copiesCount: body.copiesCount != null ? Number(body.copiesCount) : null,
        criticalDrawing: body.criticalDrawing || null,
        remarks: body.remarks || null,
        source: "Portal",
      },
      update: {
        drawingTitle: body.drawingTitle,
        discipline: body.discipline,
        drawingType: body.drawingType,
        consultantName: body.consultantName,
        revisionNumber: body.revisionNumber,
        revisionDescription: body.revisionDescription,
        criticalDrawing: body.criticalDrawing,
        remarks: body.remarks,
      },
    });
    res.status(201).json(row);
  }
);

drawingsRouter.patch(
  "/register-lines/:id",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = { ...body };
    for (const d of [
      "revisionDate",
      "plannedSubmissionDate",
      "actualSubmissionDate",
      "issueDate",
    ] as const) {
      if (body[d] !== undefined) data[d] = body[d] ? new Date(body[d]) : null;
    }
    const row = await prisma.drawingRegisterLine.update({
      where: { id: req.params.id },
      data,
    });
    res.json(row);
  }
);

/** Replace file on an existing revision (markup save / DWG swap) — logs audit, no new revision row */
drawingsRouter.patch(
  "/revision/:revId/file",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const rev = await prisma.drawingRevision.findUnique({
      where: { id: req.params.revId },
      include: { drawing: { include: { project: true } } },
    });
    if (!rev) return res.status(404).json({ error: "Revision not found" });
    if (!req.file) return res.status(400).json({ error: "File required" });

    const folder = rev.drawing.folderPath || `Drawings/${rev.drawing.discipline}`;
    const saved = await mockOneDrive.upload(
      rev.drawing.project.code,
      folder,
      req.file.originalname,
      req.file.buffer
    );
    const note = String(req.body.note || "Markup / file update").trim();
    const stamp = new Date().toLocaleDateString("en-IN");
    const updated = await prisma.drawingRevision.update({
      where: { id: rev.id },
      data: {
        fileUrl: saved.url,
        fileName: req.file.originalname,
        revisionLabel: `${rev.revisionNumber} — ${note} · ${stamp}`,
        actualDate: new Date(),
        uploadedById: req.user!.id,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    });

    await audit("drawing.revision.markup", {
      userId: req.user!.id,
      entity: "DrawingRevision",
      entityId: rev.id,
      meta: {
        drawingId: rev.drawingId,
        revisionNumber: rev.revisionNumber,
        previousFile: rev.fileName,
        newFile: req.file.originalname,
        note,
      },
    });
    res.json(updated);
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

    const unlock = await consumeDrawingUnlockToken({
      projectId: drawing.projectId,
      unlockToken: req.body.unlockToken || req.body.preCheckToken,
      userId: req.user!.id,
    });
    if (!unlock.ok) return res.status(400).json({ error: unlock.error });

    const revisionNumber = String(req.body.revisionNumber || `R${drawing.revisions.length}`);
    const revisionLabel = String(req.body.revisionLabel || `${revisionNumber} — ${new Date().toLocaleDateString()}`);
    const publish = req.body.publish === "true" || req.body.publish === true;
    const planned = req.body.plannedDate ? new Date(req.body.plannedDate) : null;
    const actual = req.body.actualDate ? new Date(req.body.actualDate) : new Date();

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
        plannedDate: planned,
        actualDate: actual,
        preCheckSubmissionId: unlock.submissionId,
        uploadedById: req.user!.id,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    });

    await prisma.checklistSubmission.update({
      where: { id: unlock.submissionId },
      data: { drawingId: drawing.id, revisionId: rev.id, revisionNumber },
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
      meta: { drawingId: drawing.id, revisionNumber, fileName, preCheck: unlock.submissionId },
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

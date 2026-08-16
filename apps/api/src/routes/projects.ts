import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER, PROJECT_LIBRARY_FOLDERS } from "../services/graph.js";
import { consumeDrawingUnlockToken } from "../services/drawingUnlock.js";
import { audit } from "../services/audit.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const drawingUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "dwg", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

function drawingUploadFiles(req: AuthedRequest) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const pdf = files?.pdf?.[0] || (files?.file?.[0] && /\.pdf$/i.test(files.file[0].originalname) ? files.file[0] : undefined);
  const dwg = files?.dwg?.[0] || (files?.file?.[0] && /\.dwg$/i.test(files.file[0].originalname) ? files.file[0] : undefined);
  return { pdf, dwg };
}

function primaryRevisionFile(rev: {
  pdfFileUrl?: string | null;
  pdfFileName?: string | null;
  dwgFileUrl?: string | null;
  dwgFileName?: string | null;
  fileUrl?: string;
  fileName?: string | null;
}) {
  if (rev.pdfFileUrl) return { fileUrl: rev.pdfFileUrl, fileName: rev.pdfFileName || rev.pdfFileUrl };
  if (rev.dwgFileUrl) return { fileUrl: rev.dwgFileUrl, fileName: rev.dwgFileName || rev.dwgFileUrl };
  return { fileUrl: rev.fileUrl || "", fileName: rev.fileName || rev.fileUrl || "" };
}

function sanitizeDrawingSegment(value: string) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function drawingIsoFolder(discipline?: string | null) {
  return `${MODULE_TO_ISO_FOLDER.drawings}/${discipline || "Architecture"}`;
}

function revisionStorageBase(drawingNumber: string, revisionNumber: string, discipline?: string | null) {
  return `${drawingIsoFolder(discipline)}/${sanitizeDrawingSegment(drawingNumber)}/${sanitizeDrawingSegment(revisionNumber)}`;
}

function storageUrl(saved: {
  url: string;
  sharePointUrl?: string | null;
}) {
  return saved.sharePointUrl || saved.url;
}

function contentTypeForFile(file: Express.Multer.File) {
  if (file.mimetype) return file.mimetype;
  const n = file.originalname.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".dwg")) return "application/acad";
  return "application/octet-stream";
}

function uniqueMarkupFileName(drawingNumber: string, revisionNumber: string, pageNumber: number, originalName: string) {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ".png";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeDrawingSegment(drawingNumber)}_${sanitizeDrawingSegment(revisionNumber)}_p${String(pageNumber).padStart(2, "0")}_${stamp}${ext}`;
}

async function touchStorageFolder(projectId: string | undefined, relPath: string) {
  if (!projectId) return;
  await mockOneDrive.touchFolder(projectId, relPath);
}

async function storeDrawingFiles(opts: {
  projectCode: string;
  projectId?: string;
  drawingNumber: string;
  revisionNumber: string;
  discipline?: string | null;
  pdf?: Express.Multer.File;
  dwg?: Express.Multer.File;
}) {
  const base = revisionStorageBase(opts.drawingNumber, opts.revisionNumber, opts.discipline);
  let pdfFileUrl: string | undefined;
  let pdfFileName: string | undefined;
  let dwgFileUrl: string | undefined;
  let dwgFileName: string | undefined;

  if (opts.pdf) {
    const rel = `${base}/PDF`;
    await touchStorageFolder(opts.projectId, rel);
    const saved = await mockOneDrive.upload(
      opts.projectCode,
      rel,
      opts.pdf.originalname,
      opts.pdf.buffer,
      contentTypeForFile(opts.pdf)
    );
    pdfFileUrl = storageUrl(saved);
    pdfFileName = opts.pdf.originalname;
  }
  if (opts.dwg) {
    const rel = `${base}/DWG`;
    await touchStorageFolder(opts.projectId, rel);
    const saved = await mockOneDrive.upload(
      opts.projectCode,
      rel,
      opts.dwg.originalname,
      opts.dwg.buffer,
      contentTypeForFile(opts.dwg)
    );
    dwgFileUrl = storageUrl(saved);
    dwgFileName = opts.dwg.originalname;
  }

  const primary = primaryRevisionFile({ pdfFileUrl, pdfFileName, dwgFileUrl, dwgFileName, fileUrl: "", fileName: "" });
  return { pdfFileUrl, pdfFileName, dwgFileUrl, dwgFileName, fileUrl: primary.fileUrl, fileName: primary.fileName, storageBase: base };
}

const revisionInclude = {
  uploadedBy: { select: { fullName: true } },
  markupPages: {
    orderBy: [{ pageNumber: "asc" as const }, { createdAt: "desc" as const }],
    include: { uploadedBy: { select: { fullName: true } } },
  },
};

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
        include: revisionInclude,
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
  drawingUpload,
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

    const { pdf, dwg } = drawingUploadFiles(req);
    if (!pdf && !dwg) return res.status(400).json({ error: "At least one of PDF or DWG required after checklist" });

    const existing = await prisma.drawing.findUnique({
      where: { projectId_drawingNumber: { projectId: project.id, drawingNumber } },
      include: { revisions: true },
    });
    const revIndex = existing?.revisions.length ?? 0;
    const rev = revisionNumber || `R${revIndex}`;
    const isoFolder = drawingIsoFolder(discipline);
    const stored = await storeDrawingFiles({
      projectCode: project.code,
      projectId: project.id,
      drawingNumber,
      revisionNumber: rev,
      discipline,
      pdf,
      dwg,
    });
    const { fileUrl, fileName, pdfFileUrl, pdfFileName, dwgFileUrl, dwgFileName } = stored;

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
        folderPath: isoFolder,
        revisions: {
          create: {
            revisionNumber: rev,
            revisionLabel: `${rev} — initial`,
            fileUrl,
            fileName,
            pdfFileUrl: pdfFileUrl || null,
            pdfFileName: pdfFileName || null,
            dwgFileUrl: dwgFileUrl || null,
            dwgFileName: dwgFileName || null,
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
          pdfFileUrl: pdfFileUrl || null,
          pdfFileName: pdfFileName || null,
          dwgFileUrl: dwgFileUrl || null,
          dwgFileName: dwgFileName || null,
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
      meta: { drawingNumber, revision: rev, fileName, pdfFileName, dwgFileName, preCheck: unlock.submissionId },
    });
    const fresh = await prisma.drawing.findUnique({
      where: { id: drawing.id },
      include: {
        revisions: {
          orderBy: { createdAt: "asc" },
          include: revisionInclude,
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
        folderPath: drawingIsoFolder(discipline || "Architecture"),
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

/** Replace PDF or DWG on an existing revision — logs audit, no new revision row */
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

    const fileRole = String(req.body.fileRole || "pdf").toLowerCase();
    const isDwg = fileRole === "dwg" || /\.dwg$/i.test(req.file.originalname);
    const roleFolder = isDwg ? "DWG" : "PDF";
    const rel = `${revisionStorageBase(rev.drawing.drawingNumber, rev.revisionNumber, rev.drawing.discipline)}/${roleFolder}`;
    await touchStorageFolder(rev.drawing.projectId, rel);
    const saved = await mockOneDrive.upload(
      rev.drawing.project.code,
      rel,
      req.file.originalname,
      req.file.buffer,
      contentTypeForFile(req.file)
    );
    const note = String(req.body.note || "Markup / file update").trim();
    const stamp = new Date().toLocaleDateString("en-IN");

    const storedUrl = storageUrl(saved);
    const rolePatch = isDwg
      ? { dwgFileUrl: storedUrl, dwgFileName: req.file.originalname }
      : { pdfFileUrl: storedUrl, pdfFileName: req.file.originalname };

    const merged = { ...rev, ...rolePatch };
    const primary = primaryRevisionFile(merged);

    const updated = await prisma.drawingRevision.update({
      where: { id: rev.id },
      data: {
        ...rolePatch,
        fileUrl: primary.fileUrl,
        fileName: primary.fileName,
        revisionLabel: `${rev.revisionNumber} — ${note} · ${stamp}`,
        actualDate: new Date(),
        uploadedById: req.user!.id,
      },
      include: revisionInclude,
    });

    await audit("drawing.revision.markup", {
      userId: req.user!.id,
      entity: "DrawingRevision",
      entityId: rev.id,
      meta: {
        drawingId: rev.drawingId,
        revisionNumber: rev.revisionNumber,
        previousFile: isDwg ? rev.dwgFileName : rev.pdfFileName || rev.fileName,
        newFile: req.file.originalname,
        fileRole: isDwg ? "dwg" : "pdf",
        note,
        sharePointPath: saved.sharePointPath || null,
      },
    });
    res.json(updated);
  }
);

/** Save annotated PDF pages — each page stored with full history */
drawingsRouter.post(
  "/revision/:revId/markup-pages",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  upload.array("files", 50),
  async (req: AuthedRequest, res) => {
    const rev = await prisma.drawingRevision.findUnique({
      where: { id: req.params.revId },
      include: { drawing: { include: { project: true } } },
    });
    if (!rev) return res.status(404).json({ error: "Revision not found" });
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: "At least one markup page required" });

    let pageNumbers: number[] = [];
    try {
      pageNumbers = JSON.parse(String(req.body.pageNumbers || "[]"));
    } catch {
      return res.status(400).json({ error: "pageNumbers must be a JSON array" });
    }
    if (pageNumbers.length !== files.length) {
      return res.status(400).json({ error: "pageNumbers length must match files count" });
    }

    const note = String(req.body.note || "PDF markup pages saved").trim();
    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pageNumber = Number(pageNumbers[i]);
      if (!Number.isFinite(pageNumber) || pageNumber < 1) {
        return res.status(400).json({ error: `Invalid page number at index ${i}` });
      }
      const storedName = uniqueMarkupFileName(
        rev.drawing.drawingNumber,
        rev.revisionNumber,
        pageNumber,
        file.originalname || `page-${pageNumber}.png`
      );
      const rel = `${revisionStorageBase(rev.drawing.drawingNumber, rev.revisionNumber, rev.drawing.discipline)}/Markup/page-${String(pageNumber).padStart(2, "0")}`;
      await touchStorageFolder(rev.drawing.projectId, rel);
      const saved = await mockOneDrive.upload(
        rev.drawing.project.code,
        rel,
        storedName,
        file.buffer,
        contentTypeForFile(file)
      );
      const row = await prisma.drawingRevisionMarkupPage.create({
        data: {
          revisionId: rev.id,
          pageNumber,
          fileUrl: storageUrl(saved),
          fileName: storedName,
          uploadedById: req.user!.id,
        },
        include: { uploadedBy: { select: { fullName: true } } },
      });
      created.push({ ...row, sharePointPath: saved.sharePointPath || null });
    }

    const stamp = new Date().toLocaleDateString("en-IN");
    const updated = await prisma.drawingRevision.update({
      where: { id: rev.id },
      data: {
        revisionLabel: `${rev.revisionNumber} — ${note} · ${stamp}`,
        actualDate: new Date(),
        uploadedById: req.user!.id,
      },
      include: revisionInclude,
    });

    await audit("drawing.revision.markup", {
      userId: req.user!.id,
      entity: "DrawingRevision",
      entityId: rev.id,
      meta: {
        drawingId: rev.drawingId,
        revisionNumber: rev.revisionNumber,
        markupPages: created.map((p) => ({
          pageNumber: p.pageNumber,
          fileName: p.fileName,
          sharePointPath: (p as { sharePointPath?: string | null }).sharePointPath || null,
        })),
        note,
        storageRoot: revisionStorageBase(rev.drawing.drawingNumber, rev.revisionNumber, rev.drawing.discipline),
      },
    });
    res.status(201).json({ revision: updated, pages: created });
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
  drawingUpload,
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

    const { pdf, dwg } = drawingUploadFiles(req);
    if (!pdf && !dwg) return res.status(400).json({ error: "At least one of PDF or DWG required for revision upload" });

    const stored = await storeDrawingFiles({
      projectCode: drawing.project.code,
      projectId: drawing.projectId,
      drawingNumber: drawing.drawingNumber,
      revisionNumber,
      discipline: drawing.discipline,
      pdf,
      dwg,
    });
    const { fileUrl, fileName, pdfFileUrl, pdfFileName, dwgFileUrl, dwgFileName, storageBase } = stored;

    if (drawing.folderPath !== drawingIsoFolder(drawing.discipline)) {
      await prisma.drawing.update({
        where: { id: drawing.id },
        data: { folderPath: drawingIsoFolder(drawing.discipline) },
      });
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
        pdfFileUrl: pdfFileUrl || null,
        pdfFileName: pdfFileName || null,
        dwgFileUrl: dwgFileUrl || null,
        dwgFileName: dwgFileName || null,
        published: publish,
        plannedDate: planned,
        actualDate: actual,
        preCheckSubmissionId: unlock.submissionId,
        uploadedById: req.user!.id,
      },
      include: revisionInclude,
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
          include: revisionInclude,
        },
      },
    });

    await audit("drawing.revision", {
      userId: req.user!.id,
      entity: "DrawingRevision",
      entityId: rev.id,
      meta: { drawingId: drawing.id, revisionNumber, fileName, pdfFileName, dwgFileName, storageBase, preCheck: unlock.submissionId },
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

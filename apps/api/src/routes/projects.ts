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
  const { code, name, clientName, location, status } = req.body;
  if (!code || !name) return res.status(400).json({ error: "code and name required" });
  const project = await prisma.project.create({
    data: { code, name, clientName, location, status: status || "Planning" },
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
  const path = String(req.query.path || "");
  const folders = await prisma.documentFolder.findMany({ where: { projectId: project.id } });
  const children = mockOneDrive.listChildren(project.code, path);
  res.json({ projectCode: project.code, path, children, folders });
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
        orderBy: { createdAt: "desc" },
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
  res.json({ canSubmitChecklist: published > 0, publishedCount: published });
});

drawingsRouter.post(
  "/project/:projectId",
  requireRoles("admin", "office"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });

    const { drawingNumber, title, discipline, revisionNumber, publish } = req.body;
    if (!drawingNumber || !title) return res.status(400).json({ error: "drawingNumber and title required" });

    let fileUrl = "";
    let fileName = "";
    if (req.file) {
      const folder = `Drawings/${discipline || "Architecture"}`;
      const saved = await mockOneDrive.upload(project.code, folder, req.file.originalname, req.file.buffer);
      fileUrl = saved.url;
      fileName = req.file.originalname;
    }

    const rev = revisionNumber || "Rev 0";
    const published = publish === "true" || publish === true;

    const drawing = await prisma.drawing.upsert({
      where: { projectId_drawingNumber: { projectId: project.id, drawingNumber } },
      create: {
        projectId: project.id,
        drawingNumber,
        title,
        discipline: discipline || "Architecture",
        currentRev: rev,
        status: published ? "Approved" : "Draft",
        isPublished: published,
        folderPath: `Drawings/${discipline || "Architecture"}`,
        revisions: fileUrl
          ? {
              create: {
                revisionNumber: rev,
                revisionLabel: rev,
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
          revisionLabel: rev,
          fileUrl,
          fileName,
          published,
          uploadedById: req.user!.id,
        },
      });
    }

    await audit("drawing.upload", { userId: req.user!.id, entity: "Drawing", entityId: drawing.id });
    const fresh = await prisma.drawing.findUnique({
      where: { id: drawing.id },
      include: { revisions: { orderBy: { createdAt: "desc" } } },
    });
    res.status(201).json(fresh);
  }
);

drawingsRouter.post("/:id/publish", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const drawing = await prisma.drawing.update({
    where: { id: req.params.id },
    data: { isPublished: true, status: "Approved" },
  });
  await prisma.drawingRevision.updateMany({
    where: { drawingId: drawing.id },
    data: { published: true },
  });
  await audit("drawing.publish", { userId: req.user!.id, entity: "Drawing", entityId: drawing.id });
  res.json(drawing);
});

/** CSV export matching Approval & GFC Drawing Log columns */
drawingsRouter.get("/project/:projectId/export.csv", async (req, res) => {
  const drawings = await prisma.drawing.findMany({
    where: { projectId: req.params.projectId },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
    orderBy: { drawingNumber: "asc" },
  });
  const header = [
    "Sr No",
    "Drawing Number",
    "Drawing Title",
    "Discipline",
    "Current Revision",
    "Revision Date",
    "Status",
    "Published",
    "Revision Count",
    "Latest File",
  ];
  const rows = drawings.map((d, i) => {
    const latest = d.revisions[0];
    return [
      String(i + 1),
      d.drawingNumber,
      `"${d.title.replace(/"/g, '""')}"`,
      d.discipline,
      d.currentRev,
      latest ? new Date(latest.createdAt).toISOString().slice(0, 10) : "",
      d.status,
      d.isPublished ? "Yes" : "No",
      String(d.revisions.length),
      latest?.fileName || latest?.fileUrl || "",
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="gfc-drawing-log-${req.params.projectId}.csv"`);
  res.send(csv);
});

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
export const closureRouter = Router();
closureRouter.use(requireAuth);

const DEFAULT_SECTIONS = {
  projectOverview: "",
  scopeDelivered: "",
  snagSummary: "",
  lessonsSummary: "",
  handoverChecklist: "",
  clientSignOff: "",
  pmcSignOff: "",
};

closureRouter.get("/project/:projectId/dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const [snags, lessons, report, openSnags, closedSnags] = await Promise.all([
    prisma.snagItem.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 200 }),
    prisma.lessonLearnt.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 200 }),
    prisma.projectClosureReport.findUnique({ where: { projectId } }),
    prisma.snagItem.count({ where: { projectId, status: "Open" } }),
    prisma.snagItem.count({ where: { projectId, status: { not: "Open" } } }),
  ]);
  res.json({
    totals: {
      snags: snags.length,
      openSnags,
      closedSnags,
      lessons: lessons.length,
      reportStatus: report?.status || "Not started",
    },
    snags,
    lessons,
    report,
  });
});

closureRouter.get("/project/:projectId/snags", async (req, res) => {
  const rows = await prisma.snagItem.findMany({
    where: { projectId: req.params.projectId },
    orderBy: [{ status: "asc" }, { srNo: "asc" }],
  });
  res.json({ snags: rows });
});

closureRouter.post(
  "/project/:projectId/snags",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    if (!body.itemDescription) return res.status(400).json({ error: "itemDescription required" });
    const row = await prisma.snagItem.create({
      data: {
        projectId: req.params.projectId,
        srNo: body.srNo ? Number(body.srNo) : null,
        package: body.package || null,
        itemDescription: body.itemDescription,
        location: body.location || null,
        area: body.area || null,
        severity: body.severity || "Medium",
        priority: body.priority || "Medium",
        status: body.status || "Open",
        vendor: body.vendor || null,
        raisedBy: body.raisedBy || req.user!.fullName,
        raisedOn: body.raisedOn ? new Date(body.raisedOn) : new Date(),
        targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : null,
        source: "Portal",
      },
    });
    res.status(201).json(row);
  }
);

closureRouter.patch(
  "/snags/:id",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "package",
      "itemDescription",
      "location",
      "area",
      "severity",
      "priority",
      "status",
      "vendor",
      "raisedBy",
      "targetCompletionDate",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.raisedOn !== undefined) data.raisedOn = body.raisedOn ? new Date(body.raisedOn) : null;
    if (body.status === "Closed") data.closedAt = new Date();
    const row = await prisma.snagItem.update({ where: { id: req.params.id }, data });
    res.json(row);
  }
);

closureRouter.get("/project/:projectId/lessons", async (req, res) => {
  const rows = await prisma.lessonLearnt.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { srNo: "asc" },
  });
  res.json({ lessons: rows });
});

closureRouter.post(
  "/project/:projectId/lessons",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.lessonLearnt.create({
      data: {
        projectId: req.params.projectId,
        srNo: body.srNo ? Number(body.srNo) : null,
        category: body.category || body.description || null,
        description: body.description || body.category || null,
        wentWell: body.wentWell || null,
        notMetExpectation: body.notMetExpectation || null,
        lessonsLearnt: body.lessonsLearnt || null,
        valueDifferentiator: body.valueDifferentiator || null,
        source: "Portal",
      },
    });
    res.status(201).json(row);
  }
);

closureRouter.patch(
  "/lessons/:id",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.lessonLearnt.update({
      where: { id: req.params.id },
      data: {
        category: body.category,
        description: body.description,
        wentWell: body.wentWell,
        notMetExpectation: body.notMetExpectation,
        lessonsLearnt: body.lessonsLearnt,
        valueDifferentiator: body.valueDifferentiator,
      },
    });
    res.json(row);
  }
);

closureRouter.get("/project/:projectId/report", async (req, res) => {
  let report = await prisma.projectClosureReport.findUnique({ where: { projectId: req.params.projectId } });
  if (!report) {
    report = await prisma.projectClosureReport.create({
      data: {
        projectId: req.params.projectId,
        title: "Project Closure Report",
        sectionsJson: JSON.stringify(DEFAULT_SECTIONS),
      },
    });
  }
  res.json({
    ...report,
    sections: report.sectionsJson ? JSON.parse(report.sectionsJson) : DEFAULT_SECTIONS,
  });
});

closureRouter.patch(
  "/project/:projectId/report",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const sections = body.sections ? JSON.stringify(body.sections) : undefined;
    const report = await prisma.projectClosureReport.upsert({
      where: { projectId: req.params.projectId },
      create: {
        projectId: req.params.projectId,
        title: body.title || "Project Closure Report",
        status: body.status || "Draft",
        summary: body.summary || null,
        sectionsJson: sections || JSON.stringify(DEFAULT_SECTIONS),
        updatedById: req.user!.id,
      },
      update: {
        title: body.title,
        status: body.status,
        summary: body.summary,
        sectionsJson: sections,
        approvedAt: body.status === "Approved" ? new Date() : undefined,
        updatedById: req.user!.id,
      },
    });
    res.json(report);
  }
);

closureRouter.post(
  "/project/:projectId/report/upload",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    const saved = await mockOneDrive.upload(
      project.code,
      "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.06_Project_Closure",
      req.file.originalname,
      req.file.buffer
    );
    const report = await prisma.projectClosureReport.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        title: "Project Closure Report",
        fileUrl: saved.url,
        fileName: req.file.originalname,
        sectionsJson: JSON.stringify(DEFAULT_SECTIONS),
        updatedById: req.user!.id,
      },
      update: {
        fileUrl: saved.url,
        fileName: req.file.originalname,
        updatedById: req.user!.id,
      },
    });
    await audit("closure.report.upload", {
      userId: req.user!.id,
      entity: "ProjectClosureReport",
      entityId: report.id,
      meta: { fileName: req.file.originalname },
    });
    res.json(report);
  }
);

closureRouter.get("/template/closure-report.docx", (_req, res) => {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Project Closure Report.docx")
      : "",
    path.join(process.cwd(), "seed", "data", "Project Closure Report.docx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "Project Closure Report.docx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      res.download(p, "Project Closure Report.docx");
      return;
    }
  }
  res.status(404).json({ error: "Template not found — sync reference sheets" });
});

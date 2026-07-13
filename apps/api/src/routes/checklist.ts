import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";

const upload = multer({ storage: multer.memoryStorage() });

export const checklistRouter = Router();
checklistRouter.use(requireAuth);

checklistRouter.get("/templates", async (_req, res) => {
  const templates = await prisma.checklistTemplate.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  res.json(templates);
});

checklistRouter.get("/templates/:id", async (req, res) => {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: req.params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return res.status(404).json({ error: "Not found" });
  res.json(template);
});

checklistRouter.get("/project/:projectId", async (req, res) => {
  const assignments = await prisma.checklistAssignment.findMany({
    where: { projectId: req.params.projectId },
    include: {
      template: { include: { _count: { select: { items: true } } } },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { submittedBy: { select: { fullName: true } } },
      },
    },
  });
  const gate = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  res.json({ assignments, canSubmit: gate > 0, publishedDrawings: gate });
});

checklistRouter.post("/project/:projectId/assign", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { templateId } = req.body;
  const assignment = await prisma.checklistAssignment.upsert({
    where: {
      projectId_templateId: { projectId: req.params.projectId, templateId },
    },
    create: { projectId: req.params.projectId, templateId },
    update: {},
    include: { template: true },
  });
  await audit("checklist.assign", { userId: req.user!.id, entity: "ChecklistAssignment", entityId: assignment.id });
  res.status(201).json(assignment);
});

checklistRouter.post(
  "/assignments/:assignmentId/submit",
  requireRoles("admin", "office", "site_employee", "employee"),
  upload.array("photos", 10),
  async (req: AuthedRequest, res) => {
    const assignment = await prisma.checklistAssignment.findUnique({
      where: { id: req.params.assignmentId },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const published = await prisma.drawing.count({
      where: { projectId: assignment.projectId, isPublished: true },
    });
    if (published === 0) {
      return res.status(400).json({
        error: "Checklist submission blocked: upload and publish at least one drawing for this project first.",
      });
    }

    const { responsesJson, drawingId, remarks, status } = req.body;
    let responses = responsesJson;
    if (typeof responses === "string") {
      try {
        JSON.parse(responses);
      } catch {
        return res.status(400).json({ error: "Invalid responsesJson" });
      }
    } else {
      responses = JSON.stringify(responsesJson || {});
    }

    const submission = await prisma.checklistSubmission.create({
      data: {
        assignmentId: assignment.id,
        drawingId: drawingId || null,
        submittedById: req.user!.id,
        status: status || "Submitted",
        responsesJson: responses,
        remarks,
      },
    });

    await audit("checklist.submit", {
      userId: req.user!.id,
      entity: "ChecklistSubmission",
      entityId: submission.id,
    });
    res.status(201).json(submission);
  }
);

checklistRouter.post(
  "/submissions/:id/review",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const { status, remarks } = req.body;
    if (!["Approved", "Rejected", "Reviewed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const submission = await prisma.checklistSubmission.update({
      where: { id: req.params.id },
      data: { status, remarks, reviewedAt: new Date() },
    });
    await audit("checklist.review", { userId: req.user!.id, entity: "ChecklistSubmission", entityId: submission.id });
    res.json(submission);
  }
);

checklistRouter.get("/submissions/:id", async (req, res) => {
  const submission = await prisma.checklistSubmission.findUnique({
    where: { id: req.params.id },
    include: {
      assignment: { include: { template: { include: { items: { orderBy: { sortOrder: "asc" } } } } } },
      submittedBy: { select: { fullName: true, email: true } },
      drawing: true,
      photos: true,
    },
  });
  if (!submission) return res.status(404).json({ error: "Not found" });
  res.json(submission);
});

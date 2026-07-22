import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const checklistRouter = Router();
checklistRouter.use(requireAuth);

checklistRouter.post(
  "/project/:projectId/assign",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
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

checklistRouter.delete(
  "/assignments/:assignmentId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    await prisma.checklistAssignment.delete({ where: { id: req.params.assignmentId } });
    await audit("checklist.unassign", { userId: req.user!.id, entity: "ChecklistAssignment", entityId: req.params.assignmentId });
    res.json({ ok: true });
  }
);

checklistRouter.get("/assignments/:assignmentId", async (req, res) => {
  const assignment = await prisma.checklistAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: {
      template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      project: {
        select: {
          id: true,
          code: true,
          name: true,
          notificationEmails: true,
          emailEnabled: true,
        },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          submittedBy: { select: { fullName: true, email: true, role: true } },
          drawing: { select: { id: true, drawingNumber: true, title: true, currentRev: true } },
          revision: { select: { id: true, revisionNumber: true, createdAt: true } },
          photos: true,
        },
      },
    },
  });
  if (!assignment) return res.status(404).json({ error: "Not found" });
  res.json(assignment);
});

checklistRouter.get("/templates", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const templates = await prisma.checklistTemplate.findMany({
    where: type ? { checklistType: type } : undefined,
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
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const assignments = await prisma.checklistAssignment.findMany({
    where: {
      projectId: req.params.projectId,
      ...(type ? { template: { checklistType: type } } : {}),
    },
    include: {
      template: { include: { _count: { select: { items: true } } } },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { submittedBy: { select: { fullName: true } } },
      },
    },
  });
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  const fillRfis = await prisma.rfi.findMany({
    where: {
      projectId: req.params.projectId,
      status: { in: ["Open", "Answered"] },
      rfiKind: { in: ["DrawingChecklist", "QualityInspection"] },
    },
    select: {
      id: true,
      number: true,
      subject: true,
      rfiKind: true,
      linkedAssignmentId: true,
      linkedChecklistItemId: true,
      responsibleVendorId: true,
      status: true,
    },
  });
  res.json({
    assignments,
    canSubmit: true,
    publishedDrawings: published,
    checklistType: type || "all",
    fillRfis,
    flow:
      type === "QualityInspection"
        ? "Raise a Quality Inspection RFI to ask matrix parties / vendor to fill QI checklists."
        : "Upload / assign checklists under Drawings → Documents, then raise a Drawing Checklist RFI for matrix parties / vendor to fill.",
  });
});

checklistRouter.post(
  "/assignments/:assignmentId/submit",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  upload.any(),
  async (req: AuthedRequest, res) => {
    const assignment = await prisma.checklistAssignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { template: true, project: true },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const { canFillChecklistAssignment } = await import("../services/reportPacks.js");
    const fillGate = await canFillChecklistAssignment({
      projectId: assignment.projectId,
      assignmentId: assignment.id,
      templateId: assignment.templateId,
      user: req.user!,
    });
    if (!fillGate.ok) {
      return res.status(403).json({ error: fillGate.reason });
    }

    const { responsesJson, drawingId, revisionId, revisionNumber, remarks, status } = req.body;

    let drawing: { id: string; revisions: { id: string; revisionNumber: string }[] } | null = null;
    let rev: { id: string; revisionNumber: string } | null = null;
    if (drawingId) {
      const found = await prisma.drawing.findFirst({
        where: { id: drawingId, projectId: assignment.projectId },
        include: { revisions: { orderBy: { createdAt: "desc" } } },
      });
      if (!found) return res.status(400).json({ error: "Drawing not found on this project." });
      drawing = found;
      rev = revisionId
        ? found.revisions.find((r) => r.id === revisionId) || null
        : found.revisions[0] || null;
      if (revisionId && !rev) return res.status(400).json({ error: "Select a valid revision for this drawing." });
    }

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
        drawingId: drawing?.id || null,
        revisionId: rev?.id || null,
        revisionNumber: revisionNumber || rev?.revisionNumber || null,
        submittedById: req.user!.id,
        status: status || "Submitted",
        responsesJson: responses,
        remarks,
      },
    });

    const files = (req.files as Express.Multer.File[]) || [];
    let itemAttachCount = 0;
    if (files.length) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const commentsRaw = req.body.itemCommentsJson;
      let itemComments: Record<string, string> = {};
      if (typeof commentsRaw === "string" && commentsRaw) {
        try {
          itemComments = JSON.parse(commentsRaw);
        } catch {
          itemComments = {};
        }
      }
      for (const f of files) {
        const scoped = /^item_([^_]+)_(photo|doc)$/.exec(f.fieldname);
        const itemId = scoped?.[1] || null;
        const kind = scoped?.[2] || (f.mimetype?.startsWith("image/") ? "photo" : "doc");
        if (itemId) itemAttachCount += 1;
        const saved = await mockOneDrive.upload(
          assignment.project.code,
          "Checklists",
          f.originalname,
          f.buffer
        );
        await prisma.checklistPhoto.create({
          data: {
            submissionId: submission.id,
            itemId,
            kind,
            fileUrl: saved.url,
            caption: f.originalname,
            comment: itemId ? itemComments[itemId] || null : null,
          },
        });
      }
    }

    await audit("checklist.submit", {
      userId: req.user!.id,
      entity: "ChecklistSubmission",
      entityId: submission.id,
      meta: { files: files.length, itemAttachments: itemAttachCount, fillVia: fillGate.via },
    });

    if (assignment.project.notifyOnChecklistSubmit) {
      const { queueProjectEmail } = await import("../services/email.js");
      await queueProjectEmail({
        projectId: assignment.projectId,
        subject: `Checklist submitted — ${assignment.template.name}`,
        body: `${req.user!.fullName || "User"} submitted "${assignment.template.name}" (${assignment.template.checklistType}).\nStatus: ${submission.status}`,
        context: "checklist.submit",
        createdById: req.user!.id,
      });
    }

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

/** Export project checklist fills for site engineers (shared dual-fill audit) */
checklistRouter.get("/project/:projectId/export.csv", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const submissions = await prisma.checklistSubmission.findMany({
    where: {
      assignment: {
        projectId: req.params.projectId,
        ...(type ? { template: { checklistType: type } } : {}),
      },
    },
    include: {
      assignment: { include: { template: true } },
      submittedBy: { select: { fullName: true, role: true, email: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      revision: { select: { revisionNumber: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const header = ["Submitted At", "Family", "Checklist", "Drawing", "Revision", "Status", "Filled By", "Role", "Email", "Remarks"];
  const rows = submissions.map((s) =>
    [
      new Date(s.createdAt).toISOString(),
      s.assignment.template.checklistType || "",
      `"${(s.assignment.template.name || "").replace(/"/g, '""')}"`,
      s.drawing ? `${s.drawing.drawingNumber}` : "",
      s.revisionNumber || s.revision?.revisionNumber || "",
      s.status,
      `"${s.submittedBy.fullName.replace(/"/g, '""')}"`,
      s.submittedBy.role || "",
      s.submittedBy.email || "",
      `"${(s.remarks || "").replace(/"/g, '""')}"`,
    ].join(",")
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="checklist-log-${req.params.projectId}.csv"`);
  res.send([header.join(","), ...rows].join("\n"));
});

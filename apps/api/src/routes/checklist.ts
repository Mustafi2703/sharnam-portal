import { Router } from "express";
import multer from "multer";
import XLSX, { type WorkBook } from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { buildBrandedChecklistHtml } from "../services/brandedChecklistHtml.js";
import { buildBrandedChecklistXlsxBuffer } from "../services/brandedChecklistXlsx.js";
import { attachProgress, computeChecklistProgress, parseResponsesJson } from "../services/checklistProgress.js";

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

checklistRouter.get("/assignments/:assignmentId", async (req: AuthedRequest, res) => {
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
        where: { status: { not: "Draft" } },
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

  const itemCount = assignment.template.items.length;
  const submissions = assignment.submissions.map((s) => attachProgress(s, itemCount));

  let myDraft: ReturnType<typeof attachProgress> | null = null;
  if (req.user?.id) {
    const draft = await prisma.checklistSubmission.findFirst({
      where: { assignmentId: assignment.id, submittedById: req.user.id, status: "Draft" },
      include: {
        submittedBy: { select: { fullName: true, email: true, role: true } },
        drawing: { select: { id: true, drawingNumber: true, title: true, currentRev: true } },
        revision: { select: { id: true, revisionNumber: true, createdAt: true } },
        photos: true,
      },
    });
    if (draft) myDraft = attachProgress(draft, itemCount);
  }

  res.json({ ...assignment, submissions, myDraft, itemCount });
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
        include: {
          submittedBy: { select: { fullName: true, role: true } },
          photos: { select: { id: true } },
        },
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
      rfiKind: {
        in: [
          "DrawingChecklist",
          "QualityInspection",
          "SafetyChecklist",
          "QualityIR",
          "SafetyIR",
          "ActivityInspection",
          "SiteExecution",
        ],
      },
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
  const enriched = await Promise.all(
    assignments.map(async (a) => {
      const itemCount = a.template._count.items;
      const latestDraft = await prisma.checklistSubmission.findFirst({
        where: { assignmentId: a.id, status: "Draft" },
        orderBy: { updatedAt: "desc" },
        include: {
          submittedBy: { select: { fullName: true, role: true } },
          photos: { select: { id: true } },
        },
      });
      return {
        ...a,
        latestDraft: latestDraft
          ? { ...latestDraft, progress: computeChecklistProgress(itemCount, latestDraft.responsesJson, latestDraft.photos.length) }
          : null,
        submissions: a.submissions.map((s) => ({
          ...s,
          progress: computeChecklistProgress(itemCount, s.responsesJson, s.photos?.length || 0),
        })),
      };
    })
  );
  res.json({
    assignments: enriched,
    canSubmit: true,
    publishedDrawings: published,
    checklistType: type || "all",
    fillRfis,
    flow:
      type === "QualityInspection"
        ? "Raise a Quality Inspection RFI to ask matrix parties / vendor to fill QI checklists."
        : type === "Safety"
          ? "Create Safety checklists, assign to project, then raise a SafetyChecklist RFI for the assignee to fill (min 3 photos)."
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
      include: { template: { include: { _count: { select: { items: true } } } }, project: true },
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

    const files = (req.files as Express.Multer.File[]) || [];
    const photoCount = files.filter(
      (f) => f.mimetype?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.originalname)
    ).length;
    const minPhotos = assignment.template.requirePhotosMin || 0;
    const linkEvidence = Object.values(parseResponsesJson(responses)).reduce(
      (s, r) => s + (r.evidenceLinks?.filter((u) => String(u).trim()).length || 0),
      0
    );
    if (minPhotos > 0 && photoCount + linkEvidence < minPhotos) {
      return res.status(400).json({
        error: `This checklist requires at least ${minPhotos} evidence items (photos or SharePoint links). Attached: ${photoCount + linkEvidence}.`,
      });
    }

    const submitStatus = status || "Submitted";
    const existingDraft = await prisma.checklistSubmission.findFirst({
      where: { assignmentId: assignment.id, submittedById: req.user!.id, status: "Draft" },
    });

    const submission = existingDraft
      ? await prisma.checklistSubmission.update({
          where: { id: existingDraft.id },
          data: {
            drawingId: drawing?.id || null,
            revisionId: rev?.id || null,
            revisionNumber: revisionNumber || rev?.revisionNumber || null,
            status: submitStatus,
            responsesJson: responses,
            remarks,
          },
        })
      : await prisma.checklistSubmission.create({
          data: {
            assignmentId: assignment.id,
            drawingId: drawing?.id || null,
            revisionId: rev?.id || null,
            revisionNumber: revisionNumber || rev?.revisionNumber || null,
            submittedById: req.user!.id,
            status: submitStatus,
            responsesJson: responses,
            remarks,
            purpose: "Fill",
          },
        });

    let itemAttachCount = 0;
    if (files.length) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const { MODULE_TO_ISO_FOLDER } = await import("../services/graph.js");
      const checklistFolder = MODULE_TO_ISO_FOLDER.qualityChecklist;
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
          checklistFolder,
          f.originalname,
          f.buffer
        );
        await prisma.checklistPhoto.create({
          data: {
            submissionId: submission.id,
            itemId,
            kind,
            fileUrl: saved.sharePointUrl || saved.url,
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
      meta: { files: files.length, photos: photoCount, itemAttachments: itemAttachCount, fillVia: fillGate.via },
    });

    if (assignment.project.notifyOnChecklistSubmit) {
      const linkedRfis = await prisma.rfi.findMany({
        where: {
          projectId: assignment.projectId,
          status: { in: ["Open", "Answered"] },
          OR: [{ linkedAssignmentId: assignment.id }, { linkedChecklistItemId: assignment.templateId }],
        },
        select: { id: true, number: true },
      });
      // Hand to office for review — do NOT auto-close the RFI
      if (linkedRfis.length) {
        await prisma.rfi.updateMany({
          where: { id: { in: linkedRfis.map((r) => r.id) } },
          data: { status: "Answered", ballInCourt: "Office", closedAt: null },
        });
      }
      const { notifyChecklistSubmittedForReview } = await import("../services/rfiFlowNotify.js");
      await notifyChecklistSubmittedForReview({
        projectId: assignment.projectId,
        projectCode: assignment.project.code,
        projectName: assignment.project.name,
        templateName: assignment.template.name,
        checklistType: assignment.template.checklistType,
        submissionId: submission.id,
        assignmentId: assignment.id,
        submittedByName: req.user!.fullName || undefined,
        rfiNumbers: linkedRfis.map((r) => r.number),
        createdById: req.user!.id,
      });
    } else {
      // Still move linked RFIs to Answered / Office without closing
      await prisma.rfi.updateMany({
        where: {
          projectId: assignment.projectId,
          status: { in: ["Open", "Answered"] },
          OR: [{ linkedAssignmentId: assignment.id }, { linkedChecklistItemId: assignment.templateId }],
        },
        data: { status: "Answered", ballInCourt: "Office", closedAt: null },
      });
    }

    const itemCount = assignment.template._count.items;
    const withPhotos = await prisma.checklistSubmission.findUnique({
      where: { id: submission.id },
      include: { photos: true },
    });

    res.status(existingDraft ? 200 : 201).json(
      attachProgress(withPhotos || submission, itemCount)
    );
  }
);

/** Save partial fill — Quality / Safety / Site. Evidence links stored in JSON; files go to SharePoint only. */
checklistRouter.post(
  "/assignments/:assignmentId/draft",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  upload.any(),
  async (req: AuthedRequest, res) => {
    const assignment = await prisma.checklistAssignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { template: { include: { items: true } }, project: true },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const { canFillChecklistAssignment } = await import("../services/reportPacks.js");
    const fillGate = await canFillChecklistAssignment({
      projectId: assignment.projectId,
      assignmentId: assignment.id,
      templateId: assignment.templateId,
      user: req.user!,
    });
    if (!fillGate.ok) return res.status(403).json({ error: fillGate.reason });

    const { responsesJson, drawingId, revisionId, revisionNumber, remarks } = req.body;
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

    const existingDraft = await prisma.checklistSubmission.findFirst({
      where: { assignmentId: assignment.id, submittedById: req.user!.id, status: "Draft" },
    });

    const submission = existingDraft
      ? await prisma.checklistSubmission.update({
          where: { id: existingDraft.id },
          data: {
            drawingId: drawing?.id || null,
            revisionId: rev?.id || null,
            revisionNumber: revisionNumber || rev?.revisionNumber || null,
            responsesJson: responses,
            remarks,
            status: "Draft",
          },
        })
      : await prisma.checklistSubmission.create({
          data: {
            assignmentId: assignment.id,
            drawingId: drawing?.id || null,
            revisionId: rev?.id || null,
            revisionNumber: revisionNumber || rev?.revisionNumber || null,
            submittedById: req.user!.id,
            status: "Draft",
            responsesJson: responses,
            remarks,
            purpose: "Fill",
          },
        });

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const { MODULE_TO_ISO_FOLDER } = await import("../services/graph.js");
      const checklistFolder = MODULE_TO_ISO_FOLDER.qualityChecklist;
      for (const f of files) {
        const scoped = /^item_([^_]+)_(photo|doc)$/.exec(f.fieldname);
        const itemId = scoped?.[1] || null;
        const kind = scoped?.[2] || (f.mimetype?.startsWith("image/") ? "photo" : "doc");
        const saved = await mockOneDrive.upload(
          assignment.project.code,
          checklistFolder,
          f.originalname,
          f.buffer
        );
        await prisma.checklistPhoto.create({
          data: {
            submissionId: submission.id,
            itemId,
            kind,
            fileUrl: saved.sharePointUrl || saved.url,
            caption: f.originalname,
          },
        });
      }
    }

    const withPhotos = await prisma.checklistSubmission.findUnique({
      where: { id: submission.id },
      include: { photos: true },
    });

    await audit("checklist.draft", {
      userId: req.user!.id,
      entity: "ChecklistSubmission",
      entityId: submission.id,
      meta: { progress: computeChecklistProgress(assignment.template.items.length, responses, withPhotos?.photos.length || 0) },
    });

    res.status(existingDraft ? 200 : 201).json(
      attachProgress(withPhotos || submission, assignment.template.items.length)
    );
  }
);

checklistRouter.post(
  "/submissions/:id/review",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const { status, remarks, closeRfi } = req.body;
    if (!["Approved", "Rejected", "Reviewed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const existing = await prisma.checklistSubmission.findUnique({
      where: { id: req.params.id },
      include: {
        assignment: { include: { template: true, project: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const submission = await prisma.checklistSubmission.update({
      where: { id: req.params.id },
      data: { status, remarks, reviewedAt: new Date() },
    });
    await audit("checklist.review", { userId: req.user!.id, entity: "ChecklistSubmission", entityId: submission.id });

    const linkedRfis = await prisma.rfi.findMany({
      where: {
        projectId: existing.assignment.projectId,
        OR: [
          { linkedAssignmentId: existing.assignmentId },
          { linkedChecklistItemId: existing.assignment.templateId },
        ],
      },
      select: { id: true, number: true, subject: true, rfiKind: true, status: true },
    });

    try {
      const project = existing.assignment.project;
      const { notifyChecklistReviewed, notifyRfiClosed, rfiEmailContextFromRecord } = await import(
        "../services/rfiFlowNotify.js"
      );
      await notifyChecklistReviewed({
        projectId: existing.assignment.projectId,
        projectCode: project.code,
        projectName: project.name,
        templateName: existing.assignment.template.name,
        status,
        submissionId: submission.id,
        remarks: remarks || null,
        rfiNumbers: linkedRfis.map((r) => r.number),
        createdById: req.user!.id,
      });

      if (closeRfi && status === "Approved" && linkedRfis.length) {
        const { archiveClosedRfiReport } = await import("../services/archiveClosedRfiReport.js");
        for (const r of linkedRfis.filter((x) => x.status !== "Closed")) {
          await prisma.rfi.update({
            where: { id: r.id },
            data: { status: "Closed", closedAt: new Date(), ballInCourt: "Closed" },
          });
          try {
            await archiveClosedRfiReport({ projectId: existing.assignment.projectId, rfiId: r.id });
          } catch {
            /* SharePoint optional */
          }
          const closedFull = await prisma.rfi.findUnique({
            where: { id: r.id },
            include: {
              assignedTo: { select: { fullName: true } },
              createdBy: { select: { fullName: true } },
              drawing: { select: { drawingNumber: true, title: true } },
              vendor: { select: { name: true } },
            },
          });
          if (closedFull) {
            await notifyRfiClosed({
              projectId: existing.assignment.projectId,
              rfiId: r.id,
              createdById: req.user!.id,
              ...rfiEmailContextFromRecord(
                closedFull,
                project,
                existing.assignment.template.name
              ),
            });
          }
        }
      }
    } catch {
      /* email optional */
    }

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

/** Branded checklist fill — HTML download (Print → Save as PDF). Avoids popup blockers. */
checklistRouter.get("/submissions/:id/branded.html", async (req, res) => {
  const submission = await prisma.checklistSubmission.findUnique({
    where: { id: req.params.id },
    include: {
      assignment: {
        include: {
          project: { select: { name: true, code: true, clientName: true } },
          template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      },
      submittedBy: { select: { fullName: true, email: true } },
      drawing: true,
    },
  });
  if (!submission) return res.status(404).send("Not found");
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
  const html = buildBrandedChecklistHtml(submission, `${webOrigin.replace(/\/$/, "")}/logo.png`);
  const safeName = (submission.assignment?.template?.name || "checklist")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 40);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName || "checklist"}-${req.params.id.slice(0, 8)}.html"`
  );
  res.send(html);
});

/** Branded checklist fill — SPDC Excel forms (colour-coded, DPR/WPR-style template fill). */
checklistRouter.get("/submissions/:id/branded.xlsx", async (req, res) => {
  const submission = await prisma.checklistSubmission.findUnique({
    where: { id: req.params.id },
    include: {
      assignment: {
        include: {
          project: {
            select: { name: true, code: true, clientName: true, contractorName: true, location: true },
          },
          template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      },
      submittedBy: { select: { fullName: true, email: true } },
      drawing: true,
    },
  });
  if (!submission) return res.status(404).json({ error: "Not found" });
  try {
    const buf = await buildBrandedChecklistXlsxBuffer(submission, submission.assignment.project);
    const safeName = (submission.assignment?.template?.name || "checklist")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .slice(0, 40);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName || "checklist"}-${req.params.id.slice(0, 8)}.xlsx"`
    );
    res.send(buf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Branded Excel failed";
    res.status(500).json({ error: message });
  }
});

/** Export project checklist fills for site engineers (shared dual-fill audit) */
checklistRouter.get("/project/:projectId/submissions", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const submissions = await prisma.checklistSubmission.findMany({
    where: {
      assignment: {
        projectId: req.params.projectId,
        ...(type ? { template: { checklistType: type } } : {}),
      },
    },
    include: {
      assignment: { include: { template: { include: { _count: { select: { items: true } } } } } },
      submittedBy: { select: { fullName: true, role: true, email: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      revision: { select: { revisionNumber: true, createdAt: true } },
      photos: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const rows = submissions.map((s) =>
    attachProgress(s, s.assignment.template._count.items)
  );
  res.json(rows);
});

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
      assignment: { include: { template: { include: { _count: { select: { items: true } } } } } },
      submittedBy: { select: { fullName: true, role: true, email: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      revision: { select: { revisionNumber: true, createdAt: true } },
      photos: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const header = [
    "Submitted At",
    "Family",
    "Checklist",
    "Drawing",
    "Revision",
    "Status",
    "Progress",
    "Evidence",
    "Filled By",
    "Role",
    "Email",
    "Remarks",
  ];
  const rows = submissions.map((s) => {
    const p = computeChecklistProgress(
      s.assignment.template._count.items,
      s.responsesJson,
      s.photos?.length || 0
    );
    return [
      new Date(s.createdAt).toISOString(),
      s.assignment.template.checklistType || "",
      `"${(s.assignment.template.name || "").replace(/"/g, '""')}"`,
      s.drawing ? `${s.drawing.drawingNumber}` : "",
      s.revisionNumber || s.revision?.revisionNumber || "",
      s.status,
      p.progressLabel,
      String(p.evidenceCount),
      `"${s.submittedBy.fullName.replace(/"/g, '""')}"`,
      s.submittedBy.role || "",
      s.submittedBy.email || "",
      `"${(s.remarks || "").replace(/"/g, '""')}"`,
    ].join(",");
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="checklist-log-${req.params.projectId}.csv"`);
  res.send([header.join(","), ...rows].join("\n"));
});

/**
 * Full filled-schedule export — every submission with line-level answers,
 * remarks, and photo paths. Admin can download one XLSX with all data.
 */
checklistRouter.get("/project/:projectId/export-filled.xlsx", requireRoles("admin", "office"), async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const submissions = await prisma.checklistSubmission.findMany({
    where: {
      assignment: {
        projectId: req.params.projectId,
        ...(type ? { template: { checklistType: type } } : {}),
      },
    },
    include: {
      assignment: { include: { template: { include: { items: { orderBy: { sortOrder: "asc" } } } } } },
      submittedBy: { select: { fullName: true, role: true, email: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      revision: { select: { revisionNumber: true } },
      photos: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: Record<string, string | number>[] = [];
  for (const s of submissions) {
    const template = s.assignment.template;
    let responses: Record<string, any> = {};
    try {
      responses = JSON.parse(s.responsesJson || "{}");
    } catch {
      responses = {};
    }
    const photoPaths = s.photos.map((p) => p.fileUrl).join(" | ");
    for (const item of template.items) {
      const key = item.id ?? item.itemCode ?? "";
      const ans = (key && responses[key]) || (item.itemCode ? responses[item.itemCode] : undefined) || {};
      const answer = typeof ans === "string" ? ans : ans.answer || ans.value || "";
      const remarks = typeof ans === "object" ? ans.remarks || ans.remark || "" : "";
      rows.push({
        "Submitted At": new Date(s.createdAt).toISOString(),
        Family: template.checklistType || "",
        Checklist: template.name || "",
        "Item Code": item.itemCode || "",
        Section: item.section || "",
        Description: item.description || "",
        Instruction: item.instruction || "",
        Answer: String(answer),
        "Line Remarks": String(remarks),
        "Overall Remarks": s.remarks || "",
        Status: s.status,
        "Filled By": s.submittedBy.fullName,
        Role: s.submittedBy.role || "",
        Email: s.submittedBy.email || "",
        Drawing: s.drawing?.drawingNumber || "",
        Revision: s.revisionNumber || s.revision?.revisionNumber || "",
        "Photo Paths": photoPaths,
      });
    }
    if (!template.items.length) {
      rows.push({
        "Submitted At": new Date(s.createdAt).toISOString(),
        Family: template.checklistType || "",
        Checklist: template.name || "",
        "Item Code": "",
        Section: "",
        Description: "(no line items)",
        Instruction: "",
        Answer: "",
        "Line Remarks": "",
        "Overall Remarks": s.remarks || "",
        Status: s.status,
        "Filled By": s.submittedBy.fullName,
        Role: s.submittedBy.role || "",
        Email: s.submittedBy.email || "",
        Drawing: s.drawing?.drawingNumber || "",
        Revision: s.revisionNumber || "",
        "Photo Paths": photoPaths,
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No filled checklists yet" }]);
  XLSX.utils.book_append_sheet(wb, ws, "Filled Schedules");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fname = `filled-checklists-${req.params.projectId}${type ? `-${type}` : ""}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

const TEMPLATE_TYPES = ["DrawingCheck", "SiteExecution", "QualityInspection", "Safety", "ActivityInspection"] as const;

/** Master: create checklist template (office + client for QI/Safety) */
checklistRouter.post(
  "/templates",
  requireRoles("admin", "office", "employee", "client"),
  async (req: AuthedRequest, res) => {
    const {
      name,
      category,
      checklistType,
      instructions,
      requirePhotosMin,
      items,
    } = req.body || {};
    if (!name || !category) return res.status(400).json({ error: "name and category required" });
    const type = TEMPLATE_TYPES.includes(checklistType) ? checklistType : "SiteExecution";
    const photoMin =
      typeof requirePhotosMin === "number"
        ? requirePhotosMin
        : type === "QualityInspection" || type === "Safety"
          ? 3
          : 0;
    const lineItems: {
      itemCode?: string;
      description: string;
      instruction?: string;
      section?: string;
      sortOrder: number;
      requirePhoto?: boolean;
    }[] = Array.isArray(items)
      ? items
          .filter((i: any) => i?.description)
          .map((i: any, idx: number) => ({
            itemCode: i.itemCode || String(idx + 1),
            description: String(i.description),
            instruction: i.instruction ? String(i.instruction) : undefined,
            section: i.section ? String(i.section) : undefined,
            sortOrder: Number(i.sortOrder ?? idx + 1),
            requirePhoto: Boolean(i.requirePhoto),
          }))
      : [];
    const template = await prisma.checklistTemplate.create({
      data: {
        name: String(name),
        category: String(category),
        checklistType: type,
        instructions: instructions ? String(instructions) : null,
        requirePhotosMin: photoMin,
        source: "manual",
        items: lineItems.length ? { create: lineItems } : undefined,
      },
      include: { items: { orderBy: { sortOrder: "asc" } }, _count: { select: { items: true } } },
    });
    await audit("checklist.template.create", {
      userId: req.user!.id,
      entity: "ChecklistTemplate",
      entityId: template.id,
    });
    res.status(201).json(template);
  }
);

/** Upload Excel → create checklist template (columns: description | instruction | section | requirePhoto) */
checklistRouter.post(
  "/templates/import-excel",
  requireRoles("admin", "office", "employee", "client"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "Excel file required" });
    const checklistType = String(req.body?.checklistType || "QualityInspection");
    const type = TEMPLATE_TYPES.includes(checklistType as any) ? checklistType : "QualityInspection";
    const name = String(req.body?.name || req.file.originalname.replace(/\.(xlsx|xls|csv)$/i, "") || "Imported checklist");
    const category = String(req.body?.category || "Imported");

    let workbook: WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      return res.status(400).json({ error: "Could not read Excel file" });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const lineItems = rows
      .map((row, idx) => {
        const description = String(
          row.description || row.Description || row.item || row.Item || row.check || row.Check || row["Line item"] || ""
        ).trim();
        if (!description) return null;
        const instruction = String(row.instruction || row.Instruction || row.QI || row.guidance || "").trim();
        const section = String(row.section || row.Section || row.category || row.Category || "General").trim();
        const requirePhoto = /y|yes|true|1/i.test(String(row.requirePhoto || row.photo || row.Photo || ""));
        return {
          itemCode: String(row.itemCode || row.code || idx + 1),
          description,
          instruction: instruction || undefined,
          section: section || "General",
          sortOrder: idx + 1,
          requirePhoto,
        };
      })
      .filter(Boolean) as {
      itemCode: string;
      description: string;
      instruction?: string;
      section: string;
      sortOrder: number;
      requirePhoto: boolean;
    }[];

    if (!lineItems.length) {
      return res.status(400).json({
        error: "No line items found. Use columns: description, instruction, section, requirePhoto",
      });
    }

    const photoMin = type === "QualityInspection" || type === "Safety" ? 3 : 0;
    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        category,
        checklistType: type,
        instructions: `Imported from ${req.file.originalname}`,
        requirePhotosMin: photoMin,
        source: "excel",
        items: { create: lineItems },
      },
      include: { items: { orderBy: { sortOrder: "asc" } }, _count: { select: { items: true } } },
    });
    await audit("checklist.template.import", {
      userId: req.user!.id,
      entity: "ChecklistTemplate",
      entityId: template.id,
      meta: { file: req.file.originalname, lines: lineItems.length },
    });
    res.status(201).json(template);
  }
);

checklistRouter.patch(
  "/templates/:id",
  requireRoles("admin", "office", "employee", "client"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name);
    if (body.category != null) data.category = String(body.category);
    if (body.instructions != null) data.instructions = String(body.instructions) || null;
    if (body.requirePhotosMin != null) data.requirePhotosMin = Number(body.requirePhotosMin) || 0;
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    if (body.checklistType && TEMPLATE_TYPES.includes(body.checklistType)) data.checklistType = body.checklistType;
    const template = await prisma.checklistTemplate.update({
      where: { id: req.params.id },
      data,
      include: { items: { orderBy: { sortOrder: "asc" } }, _count: { select: { items: true } } },
    });
    res.json(template);
  }
);

checklistRouter.post(
  "/templates/:id/items",
  requireRoles("admin", "office", "employee", "client"),
  async (req: AuthedRequest, res) => {
    const { itemCode, description, instruction, section, requirePhoto } = req.body || {};
    if (!description) return res.status(400).json({ error: "description required" });
    const count = await prisma.checklistItem.count({ where: { templateId: req.params.id } });
    const item = await prisma.checklistItem.create({
      data: {
        templateId: req.params.id,
        itemCode: itemCode || String(count + 1),
        description: String(description),
        instruction: instruction ? String(instruction) : null,
        section: section || null,
        sortOrder: count + 1,
        requirePhoto: Boolean(requirePhoto),
      },
    });
    res.status(201).json(item);
  }
);

checklistRouter.patch(
  "/items/:id",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const item = await prisma.checklistItem.update({
      where: { id: req.params.id },
      data: {
        ...(body.description != null ? { description: String(body.description) } : {}),
        ...(body.instruction != null ? { instruction: String(body.instruction) || null } : {}),
        ...(body.itemCode != null ? { itemCode: String(body.itemCode) } : {}),
        ...(body.section != null ? { section: String(body.section) || null } : {}),
        ...(body.requirePhoto != null ? { requirePhoto: Boolean(body.requirePhoto) } : {}),
        ...(body.sortOrder != null ? { sortOrder: Number(body.sortOrder) } : {}),
      },
    });
    res.json(item);
  }
);

checklistRouter.delete(
  "/items/:id",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    await prisma.checklistItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }
);

/**
 * Drawing Check Master — must be filled before drawing/revision upload.
 * Returns unlockToken consumed by drawing create/revision APIs.
 */
checklistRouter.post(
  "/project/:projectId/drawing-precheck",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    let template = await prisma.checklistTemplate.findFirst({
      where: { checklistType: "DrawingCheck", isActive: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    if (!template) {
      template = await prisma.checklistTemplate.findFirst({
        where: {
          OR: [
            { source: "Drwing check master checklist.xlt.xls" },
            { name: { contains: "Drawing Review" } },
          ],
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    }
    if (!template) return res.status(404).json({ error: "Drawing Check Master template not found. Create one in Checklist master." });

    const assignment = await prisma.checklistAssignment.upsert({
      where: { projectId_templateId: { projectId, templateId: template.id } },
      create: { projectId, templateId: template.id },
      update: {},
    });

    const responsesJson =
      typeof req.body?.responsesJson === "string"
        ? req.body.responsesJson
        : JSON.stringify(req.body?.responsesJson || req.body?.responses || {});

    try {
      JSON.parse(responsesJson);
    } catch {
      return res.status(400).json({ error: "Invalid responsesJson" });
    }

    const parsed = JSON.parse(responsesJson) as Record<string, { answer?: string }>;
    const unanswered = template.items.filter((i) => !parsed[i.id]?.answer);
    if (unanswered.length) {
      return res.status(400).json({
        error: `Complete all Drawing Check Master lines (${unanswered.length} remaining).`,
      });
    }

    const unlockToken = `dwgchk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const submission = await prisma.checklistSubmission.create({
      data: {
        assignmentId: assignment.id,
        submittedById: req.user!.id,
        status: "Submitted",
        responsesJson,
        remarks: req.body?.remarks || "Pre-upload drawing check",
        purpose: "PreUploadDrawing",
        unlockToken,
      },
    });

    await audit("checklist.drawing_precheck", {
      userId: req.user!.id,
      entity: "ChecklistSubmission",
      entityId: submission.id,
      meta: { projectId, unlockToken },
    });

    res.status(201).json({
      submissionId: submission.id,
      unlockToken,
      template: { id: template.id, name: template.name, itemCount: template.items.length },
      expiresHint: "Use once on the next drawing/revision upload",
    });
  }
);

checklistRouter.get("/project/:projectId/drawing-check-template", async (req, res) => {
  let template = await prisma.checklistTemplate.findFirst({
    where: { checklistType: "DrawingCheck", isActive: true },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!template) {
    template = await prisma.checklistTemplate.findFirst({
      where: {
        OR: [
          { source: "Drwing check master checklist.xlt.xls" },
          { name: { contains: "Drawing Review" } },
        ],
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }
  if (!template) return res.status(404).json({ error: "Drawing Check Master not found" });
  res.json(template);
});

/** Quality + Safety module dashboards */
checklistRouter.get("/project/:projectId/quality-dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const { loadQualityDashboardWorkbook, buildLiveSorLog, buildLiveSorEntries } = await import("../services/qualityDashboardSheets.js");
  const { buildQualityCatalogStatus, fillBuckets } = await import("../services/qualityChecklistCatalog.js");
  const [qiFills, allQiFills, siteFills, openQi, qap, openRfis, ncrs, cubes, siteRecords, workbook] = await Promise.all([
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId, template: { checklistType: "QualityInspection" } } },
      include: {
        assignment: { include: { template: { include: { _count: { select: { items: true } } } } } },
        submittedBy: { select: { fullName: true, role: true } },
        photos: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId, template: { checklistType: { in: ["QualityInspection", "Safety"] } } } },
      select: {
        createdAt: true,
        status: true,
        assignment: { select: { template: { select: { name: true, category: true, checklistType: true } } } },
      },
    }),
    prisma.checklistSubmission.count({
      where: { assignment: { projectId, template: { checklistType: "SiteExecution" } } },
    }),
    prisma.qualityInspection.count({ where: { projectId, status: { in: ["Open", "Failed", "Rework"] } } }),
    prisma.qapActivity.findMany({ where: { projectId }, orderBy: [{ weekLabel: "desc" }, { section: "asc" }, { srNo: "asc" }] }),
    prisma.rfi.count({
      where: { projectId, status: "Open", rfiKind: { in: ["QualityInspection", "DrawingChecklist"] } },
    }),
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { issueDate: "desc" }, take: 40 }),
    prisma.cubeTest.findMany({ where: { projectId }, orderBy: [{ srNo: "asc" }, { castDate: "asc" }] }),
    prisma.qualitySiteRecord.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      include: { reportedBy: { select: { fullName: true } } },
    }),
    Promise.resolve(loadQualityDashboardWorkbook()),
  ]);
  const liveSorLog = buildLiveSorLog(workbook?.sorLog || [], siteRecords, ncrs);
  const sorEntries = buildLiveSorEntries(siteRecords, ncrs);
  const catalog = workbook?.checklistCatalog || [];
  const catalogStatus = await buildQualityCatalogStatus(projectId, catalog);
  const fillDates = allQiFills.map((f) => f.createdAt);
  const buckets = fillBuckets(fillDates);
  const liveDiscipline = Object.entries(
    allQiFills.reduce((acc: Record<string, number>, f) => {
      const cat = f.assignment.template.category || f.assignment.template.checklistType || "Other";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {})
  ).map(([discipline, filled]) => ({ discipline, filled }));
  const workbookOut = workbook
    ? { ...workbook, sorLog: liveSorLog, checklistByDiscipline: liveDiscipline.length ? liveDiscipline : workbook.checklistByDiscipline }
    : { sorLog: liveSorLog, checklistByDiscipline: liveDiscipline, checklistCatalog: [], source: "portal" };
  const byDay: Record<string, number> = {};
  for (const f of allQiFills) {
    const d = new Date(f.createdAt).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  const groupCount = (items: { status?: string | null; result?: string | null }[], key: "status" | "result") =>
    Object.entries(
      items.reduce((acc: Record<string, number>, item) => {
        const label = String(item[key] || "Unknown");
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {})
    ).map(([label, value]) => ({ label, value }));
  res.json({
    workbook: workbookOut,
    siteRecords,
    sorEntries,
    totals: {
      fills: allQiFills.filter((f) => f.assignment.template.checklistType === "QualityInspection").length,
      siteExecutionFills: siteFills,
      openInspections: openQi,
      openFillRfis: openRfis,
      qapOpen: qap.filter((q) => q.status === "Open").length,
      qapDone: qap.filter((q) => q.status === "Done" || q.completedAt).length,
      openNcrs: ncrs.filter((n) => n.status === "Open").length,
      cubes: cubes.length,
      cubesPass: cubes.filter((c) => /pass/i.test(c.result || "")).length,
      catalogTypes: catalog.length,
      catalogOnboarded: catalogStatus.filter((c) => c.onboarded).length,
      catalogFilled: catalogStatus.filter((c) => c.fillCount > 0).length,
    },
    fillsByDay: byDay,
    catalogStatus,
    fillTrends: buckets,
    recentFills: qiFills.map((f) =>
      attachProgress(
        { ...f, photos: f.photos || [] },
        f.assignment.template._count.items
      )
    ),
    qap,
    ncrs,
    cubes,
    charts: {
      byNcrStatus: groupCount(ncrs, "status"),
      byCubeResult: groupCount(cubes, "result"),
      byQapStatus: groupCount(qap, "status"),
      fillsByDiscipline: (workbookOut.checklistByDiscipline || []).map((d) => ({
        label: d.discipline,
        value: d.filled,
      })),
      fillsByDay: buckets.fillsByDay,
      fillsByWeek: buckets.fillsByWeek,
      fillsByMonth: buckets.fillsByMonth,
      sorByType: Object.entries(
        sorEntries.reduce((acc: Record<string, number>, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
      sorByStatus: Object.entries(
        sorEntries.reduce((acc: Record<string, number>, e) => {
          acc[e.status] = (acc[e.status] || 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
    },
    /** Progress Reports: QI fills → Quality section; SiteExecution → DPR site checklists */
    reportMapping: {
      QualityInspection: "WPR / DPR Quality section",
      SiteExecution: "DPR site checklist activity (Progress)",
      DrawingCheck: "WPR Drawing / GFC checklist section",
      Safety: "WPR Safety section",
    },
  });
});

checklistRouter.get("/project/:projectId/safety-dashboard", async (req, res) => {
  const projectId = req.params.projectId;
  const { loadSafetyDashboardKpis } = await import("../services/safetyDashboardSheets.js");
  const [records, allRecords, safetyFills, openRfis, onePagerSheet] = await Promise.all([
    prisma.safetyRecord.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: { reportedBy: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
    }),
    prisma.safetyRecord.findMany({
      where: { projectId },
      select: { recordType: true, status: true, severity: true, title: true },
    }),
    prisma.checklistSubmission.count({
      where: { assignment: { projectId, template: { checklistType: "Safety" } } },
    }),
    prisma.rfi.count({ where: { projectId, status: "Open", rfiKind: "SafetyChecklist" } }),
    Promise.resolve(loadSafetyDashboardKpis()),
  ]);
  const isNcr = (r: { recordType: string; title: string }) => /ncr/i.test(r.recordType) || /ncr/i.test(r.title);
  const dbIncidents = allRecords.filter((r) => r.recordType === "Incident" || r.recordType === "Near Miss").length;
  const dbUnsafeActs = allRecords.filter((r) => r.recordType === "Observation").length;
  const dbNcrs = allRecords.filter(isNcr).length;
  const dbSiteInstructions = allRecords.filter((r) => r.recordType === "Site Instruction").length;
  const onePager = {
    totalIncidents: onePagerSheet?.totalIncidents || dbIncidents,
    totalUnsafeActs: onePagerSheet?.totalUnsafeActs || dbUnsafeActs,
    totalNcrs: onePagerSheet?.totalNcrs || dbNcrs,
    safeManHours: onePagerSheet?.safeManHours ?? 0,
    toolboxTalks: onePagerSheet?.toolboxTalks ?? 0,
    siteInstructions: onePagerSheet?.siteInstructions || dbSiteInstructions,
    source: onePagerSheet?.source || "database",
  };
  res.json({
    onePager,
    totals: {
      records: allRecords.length,
      open: allRecords.filter((r) => r.status === "Open").length,
      incidents: allRecords.filter((r) => r.recordType === "Incident" || r.recordType === "Near Miss").length,
      ncrLike: allRecords.filter(isNcr).length,
      siteInstructions: allRecords.filter((r) => r.recordType === "Site Instruction").length,
      unsafeActs: allRecords.filter((r) => r.recordType === "Observation").length,
      checklistFills: safetyFills,
      openFillRfis: openRfis,
    },
    charts: {
      byType: Object.entries(
        records.reduce((acc: Record<string, number>, r) => {
          acc[r.recordType || "Other"] = (acc[r.recordType || "Other"] || 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
      bySeverity: Object.entries(
        records.reduce((acc: Record<string, number>, r) => {
          acc[r.severity || "Low"] = (acc[r.severity || "Low"] || 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
      byStatus: Object.entries(
        records.reduce((acc: Record<string, number>, r) => {
          acc[r.status || "Open"] = (acc[r.status || "Open"] || 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
    },
    records,
  });
});

checklistRouter.post(
  "/project/:projectId/qap",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.qapActivity.create({
      data: {
        projectId: req.params.projectId,
        weekLabel: String(body.weekLabel || `W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`),
        section: body.section ? String(body.section) : body.activity ? String(body.activity) : null,
        activity: String(body.activity || body.section || "QC activity"),
        description: body.description ? String(body.description) : body.discipline ? String(body.discipline) : null,
        discipline: body.discipline || body.section || null,
        frequency: body.frequency ? String(body.frequency) : null,
        codeOfConformance: body.codeOfConformance ? String(body.codeOfConformance) : null,
        testAgency: body.testAgency ? String(body.testAgency) : null,
        contractorOk: Boolean(body.contractorOk),
        pmcOk: Boolean(body.pmcOk),
        clientOk: Boolean(body.clientOk),
        status: body.status || "Open",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    res.status(201).json(row);
  }
);

checklistRouter.patch(
  "/project/:projectId/qap/:qapId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    if (body.status != null) data.status = String(body.status);
    if (body.contractorOk != null) data.contractorOk = Boolean(body.contractorOk);
    if (body.pmcOk != null) data.pmcOk = Boolean(body.pmcOk);
    if (body.clientOk != null) data.clientOk = Boolean(body.clientOk);
    if (body.activity != null) data.activity = String(body.activity);
    if (body.section != null) data.section = String(body.section);
    if (body.description != null) data.description = String(body.description);
    if (body.discipline != null) data.discipline = String(body.discipline);
    if (body.frequency != null) data.frequency = String(body.frequency);
    if (body.codeOfConformance != null) data.codeOfConformance = String(body.codeOfConformance);
    if (body.testAgency != null) data.testAgency = String(body.testAgency);
    if (body.contractorPerformer != null) data.contractorPerformer = String(body.contractorPerformer);
    if (body.contractorChecker != null) data.contractorChecker = String(body.contractorChecker);
    if (body.pmcRole != null) data.pmcRole = String(body.pmcRole);
    if (body.clientRole != null) data.clientRole = String(body.clientRole);
    if (body.records != null) data.records = String(body.records);
    if (body.remarks != null) data.remarks = String(body.remarks);
    if (body.dailyChecks != null) data.dailyChecks = typeof body.dailyChecks === "string" ? body.dailyChecks : JSON.stringify(body.dailyChecks);
    if (body.weekLabel != null) data.weekLabel = String(body.weekLabel);
    if (body.srNo != null) data.srNo = String(body.srNo);
    if (body.status === "Done" || body.completedAt) data.completedAt = body.completedAt ? new Date(body.completedAt) : new Date();
    if (body.status === "Open") data.completedAt = null;
    const row = await prisma.qapActivity.update({
      where: { id: req.params.qapId },
      data,
    });
    res.json(row);
  }
);

/** Raise quality NCR or CAR row from portal (same table — CAR uses number prefix CAR-) */
checklistRouter.post(
  "/project/:projectId/ncr",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const kind = String(body.kind || "NCR").toUpperCase();
    const autoNo = kind === "CAR" ? `CAR-${Date.now().toString().slice(-6)}` : `NCR-${Date.now().toString().slice(-6)}`;
    const row = await prisma.qualityNcr.create({
      data: {
        projectId: req.params.projectId,
        number: String(body.number || autoNo).slice(0, 40),
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        ncrType: String(body.ncrType || (kind === "CAR" ? "Corrective Action" : "General")).slice(0, 80),
        contractor: body.contractor ? String(body.contractor).slice(0, 120) : null,
        description: String(body.description || "Non-conformance raised from portal"),
        location: body.location ? String(body.location).slice(0, 120) : null,
        plannedClosure: body.plannedClosure ? new Date(body.plannedClosure) : null,
        status: String(body.status || "Open").slice(0, 40),
        source: "portal",
        formDataJson:
          body.formDataJson && typeof body.formDataJson === "object"
            ? JSON.stringify(body.formDataJson)
            : typeof body.formDataJson === "string"
              ? body.formDataJson
              : null,
      },
    });
    await audit("quality.ncr.create", {
      userId: req.user!.id,
      entity: "QualityNcr",
      entityId: row.id,
      meta: { projectId: req.params.projectId, number: row.number },
    });
    const { notifyNcrStatus } = await import("../services/ncrNotify.js");
    await notifyNcrStatus({
      projectId: req.params.projectId,
      kind: kind === "CAR" ? "QualityCAR" : "QualityNCR",
      number: row.number || row.id,
      status: row.status,
      description: row.description,
      createdById: req.user!.id,
      event: "created",
    });
    res.status(201).json(row);
  }
);

checklistRouter.patch(
  "/project/:projectId/ncr/:ncrId",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const existing = await prisma.qualityNcr.findFirst({
      where: { id: req.params.ncrId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "NCR not found" });

    const nextStatus = body.status != null ? String(body.status) : existing.status;
    if (nextStatus === "Closed" && existing.status !== "Closed") {
      const { qualityNcrCloseMissingFields } = await import("../services/ncrFormExport.js");
      const merged = {
        ...existing,
        ...body,
        formDataJson:
          body.formDataJson && typeof body.formDataJson === "object"
            ? JSON.stringify(body.formDataJson)
            : body.formDataJson ?? existing.formDataJson,
        plannedClosure: body.plannedClosure ? new Date(body.plannedClosure) : existing.plannedClosure,
        actualClosure: body.actualClosure ? new Date(body.actualClosure) : existing.actualClosure,
      };
      const missing = qualityNcrCloseMissingFields(merged);
      if (missing.length) {
        return res.status(400).json({
          error: "Complete the NCR / CAR form before closing",
          missingFields: missing,
          formUrl: `/projects/${req.params.projectId}/ncr-form/quality/${existing.id}`,
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (body.status != null) data.status = String(body.status);
    if (body.description != null) data.description = String(body.description);
    if (body.location != null) data.location = String(body.location);
    if (body.contractor != null) data.contractor = String(body.contractor);
    if (body.plannedClosure !== undefined) data.plannedClosure = body.plannedClosure ? new Date(body.plannedClosure) : null;
    if (body.actualClosure !== undefined) data.actualClosure = body.actualClosure ? new Date(body.actualClosure) : null;
    if (body.ncrType != null) data.ncrType = String(body.ncrType);
    if (body.formDataJson != null) {
      data.formDataJson =
        typeof body.formDataJson === "object" ? JSON.stringify(body.formDataJson) : String(body.formDataJson);
    }
    const row = await prisma.qualityNcr.update({
      where: { id: req.params.ncrId },
      data,
    });
    const { notifyNcrStatus } = await import("../services/ncrNotify.js");
    await notifyNcrStatus({
      projectId: req.params.projectId,
      kind: /^CAR/i.test(row.number || "") ? "QualityCAR" : "QualityNCR",
      number: row.number || row.id,
      status: row.status,
      description: row.description,
      createdById: req.user!.id,
      event: row.status === "Closed" && existing.status !== "Closed" ? "closed" : "updated",
    });
    res.json(row);
  }
);

checklistRouter.get("/project/:projectId/ncr/:ncrId/export.xlsx", async (req, res) => {
  const row = await prisma.qualityNcr.findFirst({
    where: { id: req.params.ncrId, projectId: req.params.projectId },
  });
  if (!row) return res.status(404).json({ error: "NCR not found" });
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildQualityNcrXlsxBuffer } = await import("../services/ncrFormExport.js");
  const buf = buildQualityNcrXlsxBuffer(row, project || undefined);
  const name = `${row.number || "NCR"}.xlsx`.replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buf);
});

/** Quality site observation / site instruction — feeds SOR Log */
checklistRouter.get("/project/:projectId/quality-site-records", async (req, res) => {
  const type = req.query.type ? String(req.query.type) : undefined;
  const rows = await prisma.qualitySiteRecord.findMany({
    where: { projectId: req.params.projectId, ...(type ? { recordType: type } : {}) },
    orderBy: { occurredAt: "desc" },
    include: { reportedBy: { select: { fullName: true } } },
  });
  res.json(rows);
});

checklistRouter.post(
  "/project/:projectId/quality-site-records",
  requireRoles("admin", "office", "employee", "site_employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.qualitySiteRecord.create({
      data: {
        projectId: req.params.projectId,
        recordType: String(body.recordType || "Site Observation"),
        title: String(body.title || "Site observation"),
        description: body.description ? String(body.description) : null,
        location: body.location ? String(body.location) : null,
        severity: body.severity ? String(body.severity) : null,
        status: String(body.status || "Open"),
        issuedTo: body.issuedTo ? String(body.issuedTo) : null,
        correctiveAction: body.correctiveAction ? String(body.correctiveAction) : null,
        reportedById: req.user!.id,
        source: "portal",
      },
    });
    res.status(201).json(row);
  }
);

checklistRouter.patch(
  "/project/:projectId/quality-site-records/:recordId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of ["title", "description", "location", "severity", "status", "issuedTo", "correctiveAction", "recordType"] as const) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    const row = await prisma.qualitySiteRecord.update({ where: { id: req.params.recordId }, data });
    res.json(row);
  }
);

checklistRouter.post(
  "/project/:projectId/cubes",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const b = req.body || {};
    const load7 = b.load7 != null ? Number(b.load7) : null;
    const load28 = b.load28 != null ? Number(b.load28) : null;
    const s7 = b.strength7 != null ? Number(b.strength7) : null;
    const s28 = b.strength28 != null ? Number(b.strength28) : null;
    const row = await prisma.cubeTest.create({
      data: {
        projectId: req.params.projectId,
        srNo: b.srNo ? String(b.srNo) : null,
        castDate: b.castDate ? new Date(b.castDate) : null,
        description: String(b.description || "Cube test"),
        grade: b.grade ? String(b.grade) : null,
        cubeWeight: b.cubeWeight != null ? Number(b.cubeWeight) : null,
        testDate7: b.testDate7 ? new Date(b.testDate7) : null,
        testDate28: b.testDate28 ? new Date(b.testDate28) : null,
        load7,
        load28,
        strength7: s7 ?? (load7 && b.strength != null ? Number(b.strength) : null),
        strength28: s28 ?? (load28 && b.strength != null ? Number(b.strength) : null),
        strength: s7 ?? s28 ?? (b.strength != null ? Number(b.strength) : null),
        avgStrength: b.avgStrength != null ? Number(b.avgStrength) : null,
        result: b.result ? String(b.result) : "Pending",
        testAgency: b.testAgency ? String(b.testAgency) : null,
        source: "portal",
      },
    });
    res.status(201).json(row);
  }
);

checklistRouter.patch(
  "/project/:projectId/cubes/:cubeId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const b = req.body || {};
    const data: Record<string, unknown> = {};
    if (b.srNo != null) data.srNo = String(b.srNo);
    if (b.description != null) data.description = String(b.description);
    if (b.grade != null) data.grade = String(b.grade);
    if (b.result != null) data.result = String(b.result);
    if (b.testAgency !== undefined) data.testAgency = b.testAgency ? String(b.testAgency) : null;
    if (b.castDate !== undefined) data.castDate = b.castDate ? new Date(b.castDate) : null;
    if (b.testDate7 !== undefined) data.testDate7 = b.testDate7 ? new Date(b.testDate7) : null;
    if (b.testDate28 !== undefined) data.testDate28 = b.testDate28 ? new Date(b.testDate28) : null;
    if (b.cubeWeight != null) data.cubeWeight = Number(b.cubeWeight);
    if (b.load7 != null) data.load7 = Number(b.load7);
    if (b.load28 != null) data.load28 = Number(b.load28);
    if (b.strength7 != null) {
      data.strength7 = Number(b.strength7);
      data.strength = Number(b.strength7);
    }
    if (b.strength28 != null) data.strength28 = Number(b.strength28);
    if (b.strength != null && !b.strength7 && !b.strength28) {
      if (b.load28) data.strength28 = Number(b.strength);
      else if (b.load7) data.strength7 = Number(b.strength);
      data.strength = Number(b.strength);
    }
    if (b.avgStrength != null) data.avgStrength = Number(b.avgStrength);
    const row = await prisma.cubeTest.update({ where: { id: req.params.cubeId }, data });
    res.json(row);
  }
);

checklistRouter.post(
  "/project/:projectId/cubes/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const { importCubeRegisterWorkbook, resolveCubeRegisterPath } = await import("../services/cubeRegisterImport.js");
    const file = resolveCubeRegisterPath();
    if (!file) return res.status(404).json({ error: "SPDC CUBE REGISTER (1).xlsx not found on server" });
    const fs = await import("fs");
    const out = await importCubeRegisterWorkbook(req.params.projectId, fs.readFileSync(file), true);
    res.json(out);
  }
);

checklistRouter.post(
  "/project/:projectId/qap/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file?.buffer) return res.status(400).json({ error: "Excel file required" });
    const { importQapWorkbook } = await import("../services/qapImportExport.js");
    const out = await importQapWorkbook(req.params.projectId, req.file.buffer);
    res.json(out);
  }
);

/** Load Week 50 QAP from bundled client template on server (all ~295 rows + daily checks). */
checklistRouter.post(
  "/project/:projectId/qap/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const { importQapWorkbook, resolveQapWeek50Path } = await import("../services/qapImportExport.js");
    const file = resolveQapWeek50Path();
    if (!file) return res.status(404).json({ error: "Quality Assurance Plan Week 50.xlsx not found on server" });
    const fs = await import("fs");
    const out = await importQapWorkbook(req.params.projectId, fs.readFileSync(file), true);
    res.json(out);
  }
);

checklistRouter.post(
  "/project/:projectId/quality-catalog/sync",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const { syncQualityChecklistCatalog } = await import("../services/qualityChecklistCatalog.js");
    try {
      const out = await syncQualityChecklistCatalog(req.params.projectId);
      res.json(out);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Catalog sync failed" });
    }
  }
);

/** Inventory of client checklist pack (New folder + Final Index). */
checklistRouter.get("/checklist-pack/inventory", requireAuth, async (_req, res) => {
  const { loadChecklistPackInventory } = await import("../services/checklistPackPaths.js");
  res.json(loadChecklistPackInventory());
});

checklistRouter.get("/project/:projectId/qap/download.xlsx", async (req, res) => {
  const week = req.query.week ? String(req.query.week) : undefined;
  const { exportQapWorkbook } = await import("../services/qapImportExport.js");
  const { buffer, weekLabel } = await exportQapWorkbook(req.params.projectId, week);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="QAP-${weekLabel.replace(/\s+/g, "-")}.xlsx"`);
  res.send(buffer);
});

checklistRouter.get("/project/:projectId/qap/download.html", async (req, res) => {
  const week = req.query.week ? String(req.query.week) : undefined;
  const { exportQapHtml } = await import("../services/qapImportExport.js");
  const html = await exportQapHtml(req.params.projectId, week);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

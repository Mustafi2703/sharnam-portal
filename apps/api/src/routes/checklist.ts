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
      rfiKind: { in: ["DrawingChecklist", "QualityInspection", "SafetyChecklist"] },
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

    const files = (req.files as Express.Multer.File[]) || [];
    const photoCount = files.filter(
      (f) => f.mimetype?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.originalname)
    ).length;
    const minPhotos = assignment.template.requirePhotosMin || 0;
    if (minPhotos > 0 && photoCount < minPhotos) {
      return res.status(400).json({
        error: `This checklist requires at least ${minPhotos} photos. Attached: ${photoCount}.`,
      });
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
        purpose: "Fill",
      },
    });

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
      meta: { files: files.length, photos: photoCount, itemAttachments: itemAttachCount, fillVia: fillGate.via },
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

const TEMPLATE_TYPES = ["DrawingCheck", "SiteExecution", "QualityInspection", "Safety"] as const;

/** Master: create checklist template (office) */
checklistRouter.post(
  "/templates",
  requireRoles("admin", "office", "employee"),
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

checklistRouter.patch(
  "/templates/:id",
  requireRoles("admin", "office", "employee"),
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
  requireRoles("admin", "office", "employee"),
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
  const [qiFills, siteFills, openQi, qap, openRfis, ncrs, cubes] = await Promise.all([
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId, template: { checklistType: "QualityInspection" } } },
      include: { assignment: { include: { template: true } }, submittedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.checklistSubmission.count({
      where: { assignment: { projectId, template: { checklistType: "SiteExecution" } } },
    }),
    prisma.qualityInspection.count({ where: { projectId, status: { in: ["Open", "Failed", "Rework"] } } }),
    prisma.qapActivity.findMany({ where: { projectId }, orderBy: { weekLabel: "desc" }, take: 40 }),
    prisma.rfi.count({
      where: { projectId, status: "Open", rfiKind: { in: ["QualityInspection", "DrawingChecklist"] } },
    }),
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { issueDate: "desc" }, take: 40 }),
    prisma.cubeTest.findMany({ where: { projectId }, orderBy: { castDate: "desc" }, take: 40 }),
  ]);
  const byDay: Record<string, number> = {};
  for (const f of qiFills) {
    const d = new Date(f.createdAt).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  res.json({
    totals: {
      fills: qiFills.length,
      siteExecutionFills: siteFills,
      openInspections: openQi,
      openFillRfis: openRfis,
      qapOpen: qap.filter((q) => q.status === "Open").length,
      qapDone: qap.filter((q) => q.status === "Done" || q.completedAt).length,
      openNcrs: ncrs.filter((n) => n.status === "Open").length,
      cubes: cubes.length,
      cubesPass: cubes.filter((c) => /pass/i.test(c.result || "")).length,
    },
    fillsByDay: byDay,
    recentFills: qiFills,
    qap,
    ncrs,
    cubes,
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
  const [records, safetyFills, openRfis] = await Promise.all([
    prisma.safetyRecord.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { reportedBy: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
    }),
    prisma.checklistSubmission.count({
      where: { assignment: { projectId, template: { checklistType: "Safety" } } },
    }),
    prisma.rfi.count({ where: { projectId, status: "Open", rfiKind: "SafetyChecklist" } }),
  ]);
  res.json({
    totals: {
      records: records.length,
      open: records.filter((r) => r.status === "Open").length,
      incidents: records.filter((r) => r.recordType === "Incident").length,
      ncrLike: records.filter((r) => /ncr/i.test(r.recordType) || /ncr/i.test(r.title)).length,
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
        activity: String(body.activity || "QC activity"),
        discipline: body.discipline || null,
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

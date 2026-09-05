import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

vendorsRouter.get("/", async (req, res) => {
  const partyType = typeof req.query.partyType === "string" ? req.query.partyType : undefined;
  const vendors = await prisma.vendor.findMany({
    where: {
      isActive: true,
      ...(partyType ? { partyType } : {}),
    },
    include: { _count: { select: { projects: true } } },
    orderBy: [{ partyType: "asc" }, { name: "asc" }],
  });
  res.json(vendors);
});

vendorsRouter.post("/", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const partyType = ["Contractor", "Vendor", "Client", "Consultant", "PMC"].includes(req.body.partyType)
    ? req.body.partyType
    : "Vendor";
  const v = await prisma.vendor.create({
    data: {
      name: req.body.name,
      partyType,
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

/** Seed global bidder catalog — one vendor per R2 BOQ discipline package (idempotent). */
vendorsRouter.post("/seed-bid-catalog", requireRoles("admin", "office"), async (_req: AuthedRequest, res) => {
  const { seedBidVendorCatalog } = await import("../services/crmVendorCatalog.js");
  const out = await seedBidVendorCatalog(prisma);
  res.json({ ok: true, ...out });
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

const rfiDetailInclude = {
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  drawing: { select: { id: true, drawingNumber: true, title: true, currentRev: true } },
  vendor: { select: { id: true, name: true } },
  responses: { include: { respondedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" as const } },
};

async function nextSpdcRfiNumber(projectId: string) {
  const rows = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "RequestForInformation" },
    select: { number: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = String(r.number || "").match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `SPDC-RFI-${String(max + 1).padStart(3, "0")}`;
}

function sendWorkbook(res: import("express").Response, buf: Buffer, filename: string, html = false) {
  if (html) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
  } else {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  res.send(buf);
}

rfiRouter.get("/project/:projectId", async (req: AuthedRequest, res) => {
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const canRespond = await roleOnRfiMatrix(req.params.projectId, req.user!.role);
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const kindList = kind && kind !== "All" ? kind.split(",").map((k) => k.trim()).filter(Boolean) : [];
  const rfis = await prisma.rfi.findMany({
    where: {
      projectId: req.params.projectId,
      ...(kindList.length === 1 ? { rfiKind: kindList[0] } : kindList.length > 1 ? { rfiKind: { in: kindList } } : {}),
    },
    include: rfiDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ rfis, canRespond, canClose: canRespond, matrixGate: true });
});

rfiRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee", "client", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.rfi.count({ where: { projectId: req.params.projectId } });
  const isClient = req.user!.role === "client";
  const rfiKind = isClient
    ? "ClientConcern"
    : req.body.rfiKind ||
      (req.body.linkedChecklistItemId || req.body.linkedAssignmentId
        ? "DrawingChecklist"
        : "RequestForInformation");
  const noDrawingLink = [
    "QualityIR",
    "SafetyIR",
    "ActivityInspection",
    "QualityInspection",
    "SafetyChecklist",
    "SiteExecution",
  ].includes(rfiKind);
  const prefix =
    rfiKind === "QualityIR"
      ? "IR-QA"
      : rfiKind === "SafetyIR"
        ? "HSE-IR"
        : rfiKind === "ActivityInspection"
          ? "CL"
          : rfiKind === "QualityInspection"
            ? "QI-RFI"
            : rfiKind === "DrawingChecklist"
              ? "DWG-RFI"
              : rfiKind === "SafetyChecklist"
                ? "SAF-RFI"
                : rfiKind === "SiteExecution"
                  ? "SITE-CL"
                  : rfiKind === "RequestForInformation"
                  ? "SPDC-RFI"
                  : isClient
                    ? "CON"
                    : "RFI";
  const formObj =
    req.body.formDataJson && typeof req.body.formDataJson === "object" ? req.body.formDataJson : {};
  if (rfiKind === "RequestForInformation" && !isClient) {
    const solution = String(formObj.contractorSolution || formObj.proposedSolution || "").trim();
    if (!solution) {
      return res.status(400).json({
        error: "An RFI without the contractor's proposed solution is returned unanswered.",
      });
    }
  }
  const slaDays = { CRITICAL: 3, HIGH: 7, NORMAL: 14, LOW: 21 } as Record<string, number>;
  const priority = String(formObj.priority || "NORMAL").toUpperCase();
  const number =
    req.body.number ||
    (rfiKind === "RequestForInformation"
      ? await nextSpdcRfiNumber(req.params.projectId)
      : `${prefix}-${String(count + 1).padStart(3, "0")}`);
  const due = req.body.dueDate
    ? new Date(req.body.dueDate)
    : new Date(Date.now() + (slaDays[priority] || 14) * 86400000);
  const formDataJson =
    req.body.formDataJson && typeof req.body.formDataJson === "object"
      ? JSON.stringify(req.body.formDataJson)
      : typeof req.body.formDataJson === "string"
        ? req.body.formDataJson
        : null;

  const rfi = await prisma.rfi.create({
    data: {
      projectId: req.params.projectId,
      number,
      subject: req.body.subject,
      question: req.body.question,
      rfiKind,
      irNumber: req.body.irNumber || null,
      formDataJson,
      status: req.body.status || "Open",
      ballInCourt: "Assignee",
      assignedToId: req.body.assignedToId || null,
      createdById: req.user!.id,
      dueDate: due,
      linkedDrawingId: isClient || noDrawingLink ? null : req.body.linkedDrawingId || null,
      linkedChecklistItemId: req.body.linkedChecklistItemId || null,
      linkedAssignmentId: req.body.linkedAssignmentId || null,
      attachmentsJson: req.body.attachmentsJson ? JSON.stringify(req.body.attachmentsJson) : req.body.attachmentNote || null,
      responsibleVendorId: req.body.responsibleVendorId || null,
      scheduleImpact: req.body.scheduleImpact || "None",
      costImpact: req.body.costImpact || "None",
      isPrivate: !!req.body.isPrivate,
      specSectionLink: req.body.specSectionLink,
      questionReceivedFrom: isClient ? "Client portal" : req.body.questionReceivedFrom,
    },
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      vendor: { select: { id: true, name: true } },
    },
  });
  await audit("rfi.create", { userId: req.user!.id, entity: "Rfi", entityId: rfi.id });
  try {
    const [project, assignment] = await Promise.all([
      prisma.project.findUnique({
        where: { id: req.params.projectId },
        select: { code: true, name: true },
      }),
      rfi.linkedAssignmentId
        ? prisma.checklistAssignment.findUnique({
            where: { id: rfi.linkedAssignmentId },
            include: { template: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    const { notifyRfiRaised, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
    await notifyRfiRaised({
      projectId: req.params.projectId,
      rfiId: rfi.id,
      linkedAssignmentId: rfi.linkedAssignmentId,
      createdById: req.user!.id,
      extraEmails: req.body.extraEmails || req.body.notifyEmails || null,
      ...rfiEmailContextFromRecord(
        rfi,
        project,
        assignment?.template?.name || null
      ),
    });
  } catch {
    /* email optional */
  }
  res.status(201).json(rfi);
});

rfiRouter.get("/project/:projectId/register.xlsx", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: project.id },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { buildSpdcRfiXlsxBuffer, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const buf = await buildSpdcRfiXlsxBuffer({ project, rfis });
  sendWorkbook(res, buf, `${String(project.code).replace(/[^\w.-]+/g, "_")}-RFI-Register.xlsx`);
});

rfiRouter.get("/project/:projectId/register.html", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: project.id },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { renderSpdcRfiFormHtml } = await import("../services/spdcRfiForm.js");
  const latest = rfis[rfis.length - 1];
  if (!latest) return res.status(404).json({ error: "No RFIs in register" });
  const html = renderSpdcRfiFormHtml({ project, rfi: latest });
  sendWorkbook(res, Buffer.from(html, "utf8"), `${project.code}-RFI-Register.html`, true);
});

rfiRouter.get("/:id/download.xlsx", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id }, include: rfiDetailInclude });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: rfi.projectId },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { buildSpdcRfiXlsxBuffer, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const buf = await buildSpdcRfiXlsxBuffer({ project, rfis, selectRfiId: rfi.id });
  sendWorkbook(res, buf, safeRfiFilename(rfi.number, "xlsx"));
});

rfiRouter.get("/:id/download.html", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id }, include: rfiDetailInclude });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const { renderSpdcRfiFormHtml, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const html = renderSpdcRfiFormHtml({ project, rfi });
  sendWorkbook(res, Buffer.from(html, "utf8"), safeRfiFilename(rfi.number, "html"), true);
});

rfiRouter.post("/:id/follow-up", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({
    where: { id: req.params.id },
    include: rfiDetailInclude,
  });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({
    where: { id: existing.projectId },
    select: { code: true, name: true },
  });
  const { notifyRfiFollowUp, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
  const result = await notifyRfiFollowUp({
    projectId: existing.projectId,
    rfiId: existing.id,
    linkedAssignmentId: existing.linkedAssignmentId,
    createdById: req.user!.id,
    extraEmails: req.body.extraEmails || req.body.notifyEmails || null,
    note: req.body.note || null,
    ...rfiEmailContextFromRecord(existing, project),
  });
  await audit("rfi.follow-up", { userId: req.user!.id, entity: "Rfi", entityId: existing.id });
  res.json({ ok: true, email: result });
});

rfiRouter.post("/:id/respond", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only roles listed on this project's Communication Matrix (RFI rows) can respond. Ask Sharnam office to add your role.",
    });
  }
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
  try {
    const [project, fullRfi] = await Promise.all([
      prisma.project.findUnique({
        where: { id: existing.projectId },
        select: { code: true, name: true },
      }),
      prisma.rfi.findUnique({
        where: { id: existing.id },
        include: {
          assignedTo: { select: { fullName: true } },
          createdBy: { select: { fullName: true } },
          drawing: { select: { drawingNumber: true, title: true } },
          vendor: { select: { name: true } },
        },
      }),
    ]);
    const { notifyRfiResponse, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
    if (fullRfi) {
      await notifyRfiResponse({
        projectId: existing.projectId,
        rfiId: existing.id,
        responseText: req.body.responseText || "",
        respondedByName: req.user!.fullName || undefined,
        isOfficial: !!req.body.isOfficialResponse,
        createdById: req.user!.id,
        ...rfiEmailContextFromRecord(fullRfi, project),
      });
    }
  } catch {
    /* email optional */
  }
  res.status(201).json(response);
});

rfiRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only Communication Matrix parties (or Sharnam office) can close / update this RFI.",
    });
  }
  const rfi = await prisma.rfi.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      assignedToId: req.body.assignedToId,
      closedAt: req.body.status === "Closed" ? new Date() : undefined,
    },
  });
  if (req.body.status && req.body.status !== existing.status) {
    if (req.body.status === "Closed") {
      try {
        const { archiveClosedRfiReport } = await import("../services/archiveClosedRfiReport.js");
        await archiveClosedRfiReport({ projectId: existing.projectId, rfiId: rfi.id });
      } catch (err) {
        console.warn("[RFI] SharePoint archive failed:", err instanceof Error ? err.message : err);
      }
      const [project, closedRfi, assignment] = await Promise.all([
        prisma.project.findUnique({
          where: { id: existing.projectId },
          select: { code: true, name: true },
        }),
        prisma.rfi.findUnique({
          where: { id: rfi.id },
          include: {
            assignedTo: { select: { fullName: true } },
            createdBy: { select: { fullName: true } },
            drawing: { select: { drawingNumber: true, title: true } },
            vendor: { select: { name: true } },
          },
        }),
        existing.linkedAssignmentId
          ? prisma.checklistAssignment.findUnique({
              where: { id: existing.linkedAssignmentId },
              include: { template: { select: { name: true } } },
            })
          : Promise.resolve(null),
      ]);
      const { notifyRfiClosed, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
      if (closedRfi) {
        await notifyRfiClosed({
          projectId: existing.projectId,
          rfiId: rfi.id,
          createdById: req.user!.id,
          ...rfiEmailContextFromRecord(closedRfi, project, assignment?.template?.name || null),
        });
      }
    } else {
      const { notifyRfiStatus } = await import("../services/ncrNotify.js");
      await notifyRfiStatus({
        projectId: existing.projectId,
        number: rfi.number,
        subject: rfi.subject,
        status: rfi.status,
        createdById: req.user!.id,
      });
    }
  }
  res.json(rfi);
});

rfiRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  await prisma.rfiResponse.deleteMany({ where: { rfiId: existing.id } });
  await prisma.rfi.delete({ where: { id: existing.id } });
  await audit("rfi.delete", { userId: req.user!.id, entity: "Rfi", entityId: existing.id });
  res.json({ ok: true });
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
  res.json({ inspections: rows, canInspect: true, publishedDrawings: published });
});

inspectionsRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });

  const itemsFromBody: { description: string; autoGenerateRfi?: boolean }[] = req.body.items || [];
  let items = itemsFromBody;

  if (req.body.checklistTemplateId) {
    const tpl = await prisma.checklistTemplate.findUnique({
      where: { id: req.body.checklistTemplateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (tpl?.items?.length) {
      items = tpl.items.map((it) => ({ description: `${it.itemCode ? it.itemCode + " — " : ""}${it.description}` }));
    }
  }

  if (!items.length) {
    items = [
      { description: "Work per approved method / QAP" },
      { description: "Materials as specified" },
      { description: "Workmanship acceptable" },
      { description: "Safety compliance verified" },
      { description: "Ready for next activity", autoGenerateRfi: true },
    ];
  }

  const inspection = await prisma.qualityInspection.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      inspectionType: req.body.inspectionType || "Quality",
      status: req.body.status || "Draft",
      location: req.body.location,
      linkedDrawingId: req.body.linkedDrawingId || null,
      checklistTemplateId: req.body.checklistTemplateId || null,
      trade: req.body.trade,
      createdById: req.user!.id,
      assignedToId: req.body.assignedToId || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
      items: {
        create: items.map((it, i) => ({
          description: it.description,
          sortOrder: i + 1,
          autoGenerateRfi: !!it.autoGenerateRfi,
        })),
      },
    },
    include: { items: true, drawing: true, assignedTo: { select: { fullName: true } } },
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
      `${MODULE_TO_ISO_FOLDER.qualityChecklist}/Inspections/${disc}`,
      `${inspection.id}-meta.txt`,
      Buffer.from(
        `Inspection: ${inspection.title}\nType: ${inspection.inspectionType}\nDrawing: ${drawing?.drawingNumber || "n/a"}\n`
      )
    );
  }

  await audit("inspection.create", { userId: req.user!.id, entity: "QualityInspection", entityId: inspection.id });
  res.status(201).json(inspection);
});

inspectionsRouter.post("/:id/items", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const inspection = await prisma.qualityInspection.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!inspection) return res.status(404).json({ error: "Not found" });
  const item = await prisma.inspectionItem.create({
    data: {
      inspectionId: inspection.id,
      description: req.body.description,
      sortOrder: (inspection.items?.length || 0) + 1,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      autoGenerateRfi: !!req.body.autoGenerateRfi,
    },
  });
  res.status(201).json(item);
});

inspectionsRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.qualityInspection.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      assignedToId: req.body.assignedToId,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      completedAt: req.body.status === "Closed" ? new Date() : undefined,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
    include: { items: true, assignedTo: { select: { fullName: true } }, drawing: true },
  });
  res.json(row);
});

inspectionsRouter.patch("/items/:itemId", requireRoles("admin", "office", "site_employee", "vendor", "employee"), async (req: AuthedRequest, res) => {
  const item = await prisma.inspectionItem.update({
    where: { id: req.params.itemId },
    data: {
      status: req.body.status,
      remarks: req.body.remarks,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      ...(req.body.attachmentsJson !== undefined ? { attachmentsJson: req.body.attachmentsJson } : {}),
    },
    include: { inspection: true },
  });

  // Auto-generate RFI when unresolved
  if (req.body.status === "Unresolved" && item.autoGenerateRfi && !item.linkedRfiId) {
    const count = await prisma.rfi.count({ where: { projectId: item.inspection.projectId } });
    const rfi = await prisma.rfi.create({
      data: {
        projectId: item.inspection.projectId,
        number: `QI-RFI-${String(count + 1).padStart(3, "0")}`,
        subject: `QI checklist fill / issue: ${item.inspection.title}`,
        question: `${item.description}${item.remarks ? `\n\nRemarks: ${item.remarks}` : ""}`,
        rfiKind: "QualityInspection",
        status: "Open",
        ballInCourt: "Assignee",
        createdById: req.user!.id,
        linkedDrawingId: item.inspection.linkedDrawingId,
        linkedChecklistItemId: item.inspection.checklistTemplateId || null,
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

inspectionsRouter.post(
  "/items/:itemId/attachments",
  requireRoles("admin", "office", "site_employee", "vendor", "employee"),
  upload.array("files", 10),
  async (req: AuthedRequest, res) => {
    const item = await prisma.inspectionItem.findUnique({
      where: { id: req.params.itemId },
      include: { inspection: { include: { project: true } } },
    });
    if (!item) return res.status(404).json({ error: "Item not found" });
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: "No files" });
    const comment = typeof req.body.comment === "string" ? req.body.comment : "";
    const existing: { url: string; name: string; kind: string; comment?: string }[] = (() => {
      try {
        return JSON.parse(item.attachmentsJson || "[]");
      } catch {
        return [];
      }
    })();
    for (const f of files) {
      const kind = f.mimetype?.startsWith("image/") ? "photo" : "doc";
      const saved = await mockOneDrive.upload(
        item.inspection.project.code,
        `${MODULE_TO_ISO_FOLDER.qualityChecklist}/Inspections`,
        f.originalname,
        f.buffer
      );
      existing.push({ url: saved.url, name: f.originalname, kind, comment: comment || undefined });
    }
    const updated = await prisma.inspectionItem.update({
      where: { id: item.id },
      data: {
        attachmentsJson: JSON.stringify(existing),
        remarks: req.body.remarks !== undefined ? req.body.remarks : item.remarks,
      },
    });
    res.json(updated);
  }
);

inspectionsRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.inspectionItem.deleteMany({ where: { inspectionId: req.params.id } });
  await prisma.qualityInspection.delete({ where: { id: req.params.id } });
  await audit("inspection.delete", { userId: req.user!.id, entity: "QualityInspection", entityId: req.params.id });
  res.json({ ok: true });
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
    prisma.designCoordinationIssue.findMany({
      where: { projectId },
      include: { documents: { orderBy: { createdAt: "desc" } } },
    }),
  ]);
  res.json({
    members,
    vendors,
    parties: {
      contractors: vendors.filter((v) => v.vendor.partyType === "Contractor"),
      vendorsOnly: vendors.filter((v) => v.vendor.partyType === "Vendor" || !v.vendor.partyType),
      clients: vendors.filter((v) => v.vendor.partyType === "Client"),
      consultants: vendors.filter((v) => v.vendor.partyType === "Consultant"),
      pmc: vendors.filter((v) => v.vendor.partyType === "PMC"),
    },
    stats: {
      drawings: drawings.length,
      publishedDrawings: drawings.filter((d) => d.isPublished).length,
      openRfis: rfis.filter((r) => r.status === "Open").length,
      inspections: inspections.length,
      submittals: submittals.length,
      photos: photos.length,
      coordinationOpen: coordination.filter((c) => c.status === "Open").length,
      contractors: vendors.filter((v) => v.vendor.partyType === "Contractor").length,
      vendorCompanies: vendors.filter((v) => v.vendor.partyType === "Vendor" || !v.vendor.partyType).length,
      clients: vendors.filter((v) => v.vendor.partyType === "Client").length,
    },
    photos,
    submittals,
    coordination,
  });
});

directoryRouter.post("/project/:projectId/submittals", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.submittal.count({ where: { projectId: req.params.projectId } });
  const row = await prisma.submittal.create({
    data: {
      projectId: req.params.projectId,
      number: req.body.number || `SUB-${String(count + 1).padStart(3, "0")}`,
      title: req.body.title,
      submittalType: req.body.submittalType || "Product Data",
      status: req.body.status || "Draft",
      ballInCourt: req.body.ballInCourt || "Submitter",
      specSection: req.body.specSection,
      description: req.body.description || null,
      revisionNumber: req.body.revisionNumber || "0",
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
    },
  });
  await audit("submittal.create", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.status(201).json(row);
});

directoryRouter.patch("/submittals/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const row = await prisma.submittal.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      submittalType: req.body.submittalType,
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      specSection: req.body.specSection,
      description: req.body.description,
      revisionNumber: req.body.revisionNumber,
      reviewerNotes: req.body.reviewerNotes,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      attachmentsJson: req.body.attachmentsJson !== undefined
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
  });
  await audit("submittal.update", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.json(row);
});

directoryRouter.get("/project/:projectId/submittals", async (req, res) => {
  const rows = await prisma.submittal.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows);
});

directoryRouter.get("/project/:projectId/photos", async (req, res) => {
  const album = req.query.album ? String(req.query.album) : undefined;
  const rows = await prisma.projectPhoto.findMany({
    where: { projectId: req.params.projectId, ...(album ? { album } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const albums = await prisma.projectPhoto.groupBy({
    by: ["album"],
    where: { projectId: req.params.projectId },
    _count: true,
  });
  res.json({ photos: rows, albums });
});

directoryRouter.post(
  "/project/:projectId/photos",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    let fileUrl = req.body.fileUrl || "";
    if (req.file) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const saved = await mockOneDrive.upload(
        project.code,
        `${MODULE_TO_ISO_FOLDER.photos}/Site Progress`,
        req.file.originalname,
        req.file.buffer
      );
      fileUrl = saved.url;
    }
    if (!fileUrl) fileUrl = `/uploads/photos/placeholder-${Date.now()}.txt`;
    const row = await prisma.projectPhoto.create({
      data: {
        projectId: req.params.projectId,
        fileUrl,
        album: req.body.album || "Site Progress",
        description: req.body.description,
        trade: req.body.trade,
        location: req.body.location,
        isPrivate: req.body.isPrivate === "true" || req.body.isPrivate === true,
      },
    });
    await audit("photo.create", { userId: req.user!.id, entity: "ProjectPhoto", entityId: row.id });
    res.status(201).json(row);
  }
);

directoryRouter.delete("/photos/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  await prisma.projectPhoto.delete({ where: { id: req.params.id } });
  await audit("photo.delete", { userId: req.user!.id, entity: "ProjectPhoto", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/submittals/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.submittal.delete({ where: { id: req.params.id } });
  await audit("submittal.delete", { userId: req.user!.id, entity: "Submittal", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/coordination/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.designCoordinationIssue.delete({ where: { id: req.params.id } });
  await audit("coordination.delete", { userId: req.user!.id, entity: "DesignCoordinationIssue", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.post("/project/:projectId/coordination", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body.description,
      discipline: req.body.discipline,
      location: req.body.location,
      priority: req.body.priority || "Medium",
      ballInCourt: req.body.ballInCourt || "Assignee",
      linkedDrawingId: req.body.linkedDrawingId || null,
      assignedToName: req.body.assignedToName || null,
      assignedToId: req.body.assignedToId || null,
      assignedToEmail: req.body.assignedToEmail || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
  });
  res.status(201).json(row);
});

directoryRouter.patch("/coordination/:id", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      location: req.body.location,
      discipline: req.body.discipline,
      ballInCourt: req.body.ballInCourt,
      assignedToName: req.body.assignedToName,
      assignedToId: req.body.assignedToId,
      assignedToEmail: req.body.assignedToEmail,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    },
  });
  res.json(row);
});

directoryRouter.post(
  "/coordination/:id/follow-up",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ error: "Not found" });
    try {
      const { sendCoordinationFollowUp, MAX_FOLLOW_UPS } = await import("../services/coordinationEscalation.js");
      const result = await sendCoordinationFollowUp({
        issueId: issue.id,
        projectId: issue.projectId,
        userId: req.user!.id,
      });
      await audit("coordination.follow-up", {
        userId: req.user!.id,
        entity: "DesignCoordinationIssue",
        entityId: issue.id,
        meta: { followUpCount: result.issue.followUpCount, autoEscalated: result.autoEscalated },
      });
      res.json({ ...result, maxFollowUps: MAX_FOLLOW_UPS });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Follow-up failed" });
    }
  }
);

directoryRouter.post(
  "/coordination/:id/escalate-rfi",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ error: "Not found" });
    if (issue.status === "Closed") return res.status(400).json({ error: "Issue is closed" });
    try {
      const { createRfiFromCoordinationIssue, MAX_FOLLOW_UPS } = await import("../services/coordinationEscalation.js");
      if (issue.followUpCount >= MAX_FOLLOW_UPS && issue.escalatedRfiId) {
        return res.status(400).json({ error: "Already escalated" });
      }
      const rfi = await createRfiFromCoordinationIssue({
        issueId: issue.id,
        projectId: issue.projectId,
        userId: req.user!.id,
      });
      await audit("coordination.escalate-rfi", {
        userId: req.user!.id,
        entity: "DesignCoordinationIssue",
        entityId: issue.id,
        meta: { rfiId: rfi.id, number: rfi.number },
      });
      res.status(201).json({ rfi, issue: await prisma.designCoordinationIssue.findUnique({ where: { id: issue.id } }) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Escalation failed" });
    }
  }
);

const coordDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

directoryRouter.post(
  "/coordination/:id/documents",
  requireRoles("admin", "office", "employee", "site_employee"),
  coordDocUpload.single("file"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { code: true } } },
    });
    if (!issue) return res.status(404).json({ error: "Not found" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file required" });
    const { mockOneDrive } = await import("../services/mockOneDrive.js");
    const { MODULE_TO_ISO_FOLDER } = await import("../services/graph.js");
    const folder = MODULE_TO_ISO_FOLDER.designCoordination || "04.04_Clash_Detection_Design_Coordination";
    const rel = `${folder}/${issue.id}`;
    const saved = await mockOneDrive.upload(issue.project.code, rel, file.originalname, file.buffer, file.mimetype);
    const fileUrl = saved.sharePointUrl || saved.url;
    const doc = await prisma.coordinationIssueDocument.create({
      data: {
        issueId: issue.id,
        fileUrl,
        fileName: file.originalname,
        uploadedById: req.user!.id,
      },
    });
    res.status(201).json(doc);
  }
);

export const safetyRouter = Router();
safetyRouter.use(requireAuth);

safetyRouter.get("/project/:projectId", async (req, res) => {
  const records = await prisma.safetyRecord.findMany({
    where: { projectId: req.params.projectId },
    include: {
      reportedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: [{ category: "asc" }, { ncrNumber: "asc" }, { occurredAt: "desc" }],
  });
  const open = records.filter((r) => r.status === "Open").length;
  const incidents = records.filter((r) => r.recordType === "Incident" || r.recordType === "Near Miss").length;
  res.json({ records, stats: { total: records.length, open, incidents } });
});

function safetyRecordCreate(body: Record<string, unknown>) {
  const date = (v: unknown) => (v ? new Date(String(v)) : null);
  const str = (v: unknown, fallback = "") => (v != null && v !== "" ? String(v) : fallback);
  const opt = (v: unknown) => (v != null && v !== "" ? String(v) : null);
  return {
    recordType: str(body.recordType, "Observation"),
    title: str(body.title),
    description: opt(body.description),
    severity: str(body.severity, "Low"),
    status: str(body.status, "Open"),
    location: opt(body.location),
    correctiveAction: opt(body.correctiveAction),
    ncrNumber: opt(body.ncrNumber),
    activityTask: opt(body.activityTask),
    category: opt(body.category),
    rootCause: opt(body.rootCause),
    contributingFactors: opt(body.contributingFactors),
    immediateAction: opt(body.immediateAction),
    longTermAction: opt(body.longTermAction),
    responsibleParty: opt(body.responsibleParty),
    targetCompletion: body.targetCompletion ? date(body.targetCompletion) : null,
    timeImpact: opt(body.timeImpact),
    costImpact: opt(body.costImpact),
    actionTaken: opt(body.actionTaken),
    issuedTo: opt(body.issuedTo),
    followUpDate: body.followUpDate ? date(body.followUpDate) : null,
    source: opt(body.source),
    assignedToId: opt(body.assignedToId),
    occurredAt: body.occurredAt ? date(body.occurredAt) ?? new Date() : new Date(),
  };
}

function safetyRecordPatch(body: Record<string, unknown>) {
  const date = (v: unknown) => (v ? new Date(String(v)) : null);
  const patch: Record<string, unknown> = {};
  const set = (key: string, val: unknown, transform?: (v: unknown) => unknown) => {
    if (val !== undefined) patch[key] = transform ? transform(val) : val;
  };
  set("recordType", body.recordType);
  set("title", body.title);
  set("description", body.description);
  set("severity", body.severity);
  set("status", body.status);
  set("location", body.location);
  set("correctiveAction", body.correctiveAction);
  set("ncrNumber", body.ncrNumber);
  set("activityTask", body.activityTask);
  set("category", body.category);
  set("rootCause", body.rootCause);
  set("contributingFactors", body.contributingFactors);
  set("immediateAction", body.immediateAction);
  set("longTermAction", body.longTermAction);
  set("responsibleParty", body.responsibleParty);
  set("targetCompletion", body.targetCompletion, date);
  set("timeImpact", body.timeImpact);
  set("costImpact", body.costImpact);
  set("actionTaken", body.actionTaken);
  set("issuedTo", body.issuedTo);
  set("followUpDate", body.followUpDate, date);
  set("source", body.source);
  set("assignedToId", body.assignedToId);
  set("occurredAt", body.occurredAt, date);
  return patch;
}

safetyRouter.post(
  "/project/:projectId/hira/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const { syncHiraFromTemplate } = await import("../services/hiraRegister.js");
    try {
      const out = await syncHiraFromTemplate(req.params.projectId, req.user!.id);
      res.json(out);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "HIRA sync failed" });
    }
  }
);

safetyRouter.post(
  "/project/:projectId",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const row = await prisma.safetyRecord.create({
      data: {
        projectId: req.params.projectId,
        ...safetyRecordCreate(req.body || {}),
        reportedById: req.user!.id,
      },
      include: {
        reportedBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
      },
    });
    await audit("safety.create", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
    if (row.recordType === "NCR") {
      const { notifyNcrStatus } = await import("../services/ncrNotify.js");
      await notifyNcrStatus({
        projectId: req.params.projectId,
        kind: "SafetyNCR",
        number: row.ncrNumber || row.title,
        status: row.status,
        description: row.description || row.title,
        createdById: req.user!.id,
        event: "created",
      });
      const project = await prisma.project.findUnique({
        where: { id: req.params.projectId },
        select: { name: true, code: true, clientName: true },
      });
      if (project?.code) {
        try {
          const { syncSafetyNcrToDrive } = await import("../services/syncNcrToDrive.js");
          const drive = await syncSafetyNcrToDrive(project, row);
          return res.status(201).json({ ...row, sharePointExports: drive.exports });
        } catch {
          /* optional */
        }
      }
    }
    res.status(201).json(row);
  }
);

safetyRouter.get("/:id", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({
    where: { id: req.params.id },
    include: {
      reportedBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

safetyRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const body = req.body || {};
  const existing = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const nextStatus = body.status != null ? String(body.status) : existing.status;
  if (nextStatus === "Closed" && existing.status !== "Closed" && existing.recordType === "NCR") {
    const { safetyNcrMissingFields } = await import("../services/ncrFormExport.js");
    const merged = { ...existing, ...body };
    const missing = safetyNcrMissingFields(merged);
    if (missing.length) {
      return res.status(400).json({
        error: "Complete the Safety NCR form before closing",
        missingFields: missing,
        formUrl: `/projects/${existing.projectId}/ncr-form/safety/${existing.id}`,
      });
    }
  }

  const patch = safetyRecordPatch(body);
  if (body.status === "Closed") patch.closedAt = new Date();
  else if (body.closedAt) patch.closedAt = new Date(String(body.closedAt));
  const row = await prisma.safetyRecord.update({
    where: { id: req.params.id },
    data: patch,
    include: {
      reportedBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });
  await audit("safety.update", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
  if (row.recordType === "NCR") {
    const { notifyNcrStatus } = await import("../services/ncrNotify.js");
    await notifyNcrStatus({
      projectId: row.projectId,
      kind: "SafetyNCR",
      number: row.ncrNumber || row.title,
      status: row.status,
      description: row.description || row.title,
      createdById: req.user!.id,
      event: row.status === "Closed" && existing.status !== "Closed" ? "closed" : "updated",
    });
  }
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  let sharePointExports: { kind: string; path: string; url?: string | null }[] = [];
  if (row.recordType === "NCR" && project?.code) {
    try {
      const { syncSafetyNcrToDrive } = await import("../services/syncNcrToDrive.js");
      const drive = await syncSafetyNcrToDrive(project, row);
      sharePointExports = drive.exports;
    } catch {
      /* optional */
    }
  }
  res.json({ ...row, sharePointExports });
});

safetyRouter.get("/:id/export.xlsx", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildSafetyNcrXlsxFromTemplate } = await import("../services/ncrFormExport.js");
  const buf = await buildSafetyNcrXlsxFromTemplate(row, project || undefined);
  const name = `${row.ncrNumber || row.title || "Safety-NCR"}.xlsx`.replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buf);
});

safetyRouter.get("/:id/export.html", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildSafetyNcrHtml } = await import("../services/ncrFormExport.js");
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
  const html = buildSafetyNcrHtml(row, project || undefined, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

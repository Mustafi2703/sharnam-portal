import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { buildDprPack, buildWprPack, renderDprHtml, renderWprHtml } from "../services/reportPacks.js";
import {
  analyticsToHtml,
  analyticsToSheets,
  buildAnalyticsPack,
  buildModuleExport,
  dprToSheets,
  workbookBuffer,
  wprToSheets,
  type ModuleExportKey,
} from "../services/brandedExport.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const MODULE_KEYS: ModuleExportKey[] = [
  "rfis",
  "comms",
  "quality",
  "safety",
  "drawings",
  "progress",
  "field",
  "cost",
];

reportsRouter.get("/daily/:projectId", async (req, res) => {
  const pack = await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined);
  res.json({
    type: "daily",
    date: pack.date,
    diary: pack.diary,
    checklistSubmissions: pack.submissions,
    activity: [],
    kpis: pack.kpis,
    project: pack.project,
    rfis: pack.rfis,
    safety: pack.safety,
    photos: pack.photos,
  });
});

reportsRouter.get("/weekly/:projectId", async (req, res) => {
  const pack = await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined);
  res.json({
    type: "weekly",
    start: pack.start,
    end: pack.end,
    summary: pack.kpis,
    diaries: pack.diaries,
    submissions: pack.submissions,
    meetings: pack.meetings,
    cashflow: pack.cashflow,
    project: pack.project,
    kpis: pack.kpis,
    drawings: pack.drawings,
    rfis: pack.rfis,
    safety: pack.safety,
    submittals: pack.submittals,
    htmlStub: `<h1>Weekly Project Report</h1><p>${new Date(pack.start).toDateString()} – ${new Date(pack.end).toDateString()}</p>`,
  });
});

reportsRouter.get("/dpr/:projectId/pack", async (req, res) => {
  res.json(await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined));
});

reportsRouter.get("/wpr/:projectId/pack", async (req, res) => {
  res.json(await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined));
});

reportsRouter.get("/dpr/:projectId/download.html", async (req, res) => {
  const pack = await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined);
  const html = renderDprHtml(pack);
  const fname = `DPR-${pack.project.code}-${new Date(pack.date).toISOString().slice(0, 10)}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(html);
});

reportsRouter.get("/wpr/:projectId/download.html", async (req, res) => {
  const pack = await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined);
  const html = renderWprHtml(pack);
  const fname = `WPR-${pack.project.code}-${new Date(pack.end).toISOString().slice(0, 10)}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(html);
});

reportsRouter.get("/dpr/:projectId/download.xlsx", async (req, res) => {
  const pack = await buildDprPack(req.params.projectId, req.query.date ? String(req.query.date) : undefined);
  const buf = workbookBuffer(dprToSheets(pack), { title: "Daily Progress Report (DPR)", projectCode: pack.project.code });
  const fname = `DPR-${pack.project.code}-${new Date(pack.date).toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

reportsRouter.get("/wpr/:projectId/download.xlsx", async (req, res) => {
  const pack = await buildWprPack(req.params.projectId, req.query.end ? String(req.query.end) : undefined);
  const buf = workbookBuffer(wprToSheets(pack), { title: "Weekly Progress Report (WPR)", projectCode: pack.project.code });
  const fname = `WPR-${pack.project.code}-${new Date(pack.end).toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

/** Workday-style analytics dashboard pack */
reportsRouter.get("/analytics/:projectId/pack", async (req, res) => {
  res.json(await buildAnalyticsPack(req.params.projectId));
});

reportsRouter.get("/analytics/:projectId/download.xlsx", async (req, res) => {
  const pack = await buildAnalyticsPack(req.params.projectId);
  const buf = workbookBuffer(analyticsToSheets(pack), {
    title: "Project analytics dashboard",
    projectCode: pack.project.code,
  });
  const fname = `Sharnam-Analytics-${pack.project.code}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

reportsRouter.get("/analytics/:projectId/download.html", async (req, res) => {
  const pack = await buildAnalyticsPack(req.params.projectId);
  const html = analyticsToHtml(pack);
  const fname = `Sharnam-Analytics-${pack.project.code}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(html);
});

reportsRouter.get("/module/:projectId/:module/download.xlsx", async (req, res) => {
  const module = String(req.params.module) as ModuleExportKey;
  if (!MODULE_KEYS.includes(module)) return res.status(400).json({ error: "Unknown module" });
  const pack = await buildModuleExport(req.params.projectId, module);
  const code = (await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { code: true } }))?.code || "project";
  const buf = workbookBuffer(pack.sheets, { title: pack.title, projectCode: code });
  const fname = `Sharnam-${module}-${code}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

reportsRouter.get("/module/:projectId/:module/download.html", async (req, res) => {
  const module = String(req.params.module) as ModuleExportKey;
  if (!MODULE_KEYS.includes(module)) return res.status(400).json({ error: "Unknown module" });
  const pack = await buildModuleExport(req.params.projectId, module);
  const code = (await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { code: true } }))?.code || "project";
  const fname = `Sharnam-${module}-${code}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(pack.html);
});

export const auditRouter = Router();
auditRouter.use(requireAuth);
auditRouter.use(requireRoles("admin", "office"));

auditRouter.get("/", async (req, res) => {
  const take = Math.min(Number(req.query.take || 100), 500);
  const events = await prisma.auditEvent.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true, email: true, role: true } } },
  });
  res.json(events);
});

export const crmRouter = Router();
crmRouter.use(requireAuth);

crmRouter.get("/leads", async (_req, res) => {
  const leads = await prisma.lead.findMany({
    include: { owner: { select: { fullName: true } }, project: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(leads);
});

crmRouter.post("/leads", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.create({
    data: {
      title: req.body.title,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      stage: req.body.stage || "New",
      value: req.body.value != null ? Number(req.body.value) : null,
      projectId: req.body.projectId,
      ownerId: req.user!.id,
    },
  });
  res.status(201).json(lead);
});

crmRouter.get("/deals", async (_req, res) => {
  const deals = await prisma.deal.findMany({ include: { project: true }, orderBy: { createdAt: "desc" } });
  res.json(deals);
});

crmRouter.post("/deals", requireRoles("admin", "office"), async (req, res) => {
  const deal = await prisma.deal.create({
    data: {
      name: req.body.name,
      stage: req.body.stage || "Negotiation",
      value: Number(req.body.value || 0),
      projectId: req.body.projectId,
    },
  });
  res.status(201).json(deal);
});

crmRouter.patch("/leads/:id", requireRoles("admin", "office"), async (req, res) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      stage: req.body.stage,
      value: req.body.value != null ? Number(req.body.value) : undefined,
    },
  });
  res.json(lead);
});

/** Convert a lead into a project + optional members/vendors + Closed Won deal */
crmRouter.post("/leads/:id/convert", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  if (lead.projectId) return res.status(400).json({ error: "Lead already converted" });

  const code = String(req.body.code || "").trim();
  const name = String(req.body.name || lead.title).trim();
  if (!code || !name) return res.status(400).json({ error: "code and name required" });

  const project = await prisma.project.create({
    data: {
      code,
      name,
      clientName: req.body.clientName || lead.contactName || undefined,
      location: req.body.location || undefined,
      status: "Planning",
      clientContactName: req.body.clientContactName || lead.contactName || undefined,
      clientEmail: req.body.clientEmail || lead.email || undefined,
      clientPhone: req.body.clientPhone || lead.phone || undefined,
      clientAddress: req.body.clientAddress || undefined,
      clientGst: req.body.clientGst || undefined,
      designConsultant: req.body.designConsultant || undefined,
      contractorName: req.body.contractorName || undefined,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { projectId: project.id, stage: "Converted" },
  });

  await prisma.deal.create({
    data: {
      name: `${name} — PMC`,
      stage: "Closed Won",
      value: lead.value || Number(req.body.value || 0),
      projectId: project.id,
    },
  });

  const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
  for (const userId of memberIds) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      create: { projectId: project.id, userId, role: "member" },
      update: {},
    });
  }

  const vendorIds: string[] = Array.isArray(req.body.vendorIds) ? req.body.vendorIds : [];
  for (const vendorId of vendorIds) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: project.id, vendorId } },
      create: { projectId: project.id, vendorId, assignedVia: "CRM convert" },
      update: {},
    });
  }

  // Always add converter as member
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: req.user!.id } },
    create: { projectId: project.id, userId: req.user!.id, role: "office" },
    update: {},
  });

  const { mockOneDrive } = await import("../services/mockOneDrive.js");
  await mockOneDrive.ensureProjectTree(project.id);

  res.status(201).json({ project, leadId: lead.id });
});

/* ─── Quotations (proposal maker) ─── */

crmRouter.get("/quotations", async (_req, res) => {
  const rows = await prisma.quotation.findMany({
    include: { lead: true, project: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

crmRouter.get("/quotations/:id", async (req, res) => {
  const row = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { lead: true, project: true },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

crmRouter.post("/quotations", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.quotation.create({
    data: {
      quotationNo: req.body.quotationNo || `QTN-${Date.now()}`,
      clientName: req.body.clientName || "Client",
      clientAddress: req.body.clientAddress || null,
      clientGst: req.body.clientGst || null,
      scopeSummary: req.body.scopeSummary || null,
      totalValue: Number(req.body.totalValue || 0),
      currency: req.body.currency || "INR",
      status: req.body.status || "Draft",
      validityDays: Number(req.body.validityDays || 30),
      quotationDate: req.body.quotationDate ? new Date(req.body.quotationDate) : new Date(),
      leadId: req.body.leadId || null,
      projectId: req.body.projectId || null,
      sectionsJson: req.body.sections ? JSON.stringify(req.body.sections) : req.body.sectionsJson || null,
      createdById: req.user!.id,
    },
  });
  res.status(201).json(row);
});

crmRouter.patch("/quotations/:id", requireRoles("admin", "office"), async (req, res) => {
  const before = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.quotation.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status ?? before.status,
      quotationNo: req.body.quotationNo ?? before.quotationNo,
      clientName: req.body.clientName ?? before.clientName,
      clientAddress: req.body.clientAddress ?? before.clientAddress,
      clientGst: req.body.clientGst ?? before.clientGst,
      scopeSummary: req.body.scopeSummary ?? before.scopeSummary,
      totalValue: req.body.totalValue != null ? Number(req.body.totalValue) : before.totalValue,
      validityDays: req.body.validityDays != null ? Number(req.body.validityDays) : before.validityDays,
      sectionsJson: req.body.sections ? JSON.stringify(req.body.sections) : req.body.sectionsJson ?? before.sectionsJson,
    },
  });
  res.json(row);
});

/** Award the quotation → create a project (or link existing) */
crmRouter.post("/quotations/:id/award", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const qtn = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  if (!qtn) return res.status(404).json({ error: "not found" });
  const code = String(req.body.code || "").trim();
  const name = String(req.body.name || qtn.clientName).trim();
  if (!code || !name) return res.status(400).json({ error: "code and name required" });

  let projectId = req.body.projectId as string | undefined;
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        code,
        name,
        clientName: qtn.clientName,
        clientAddress: qtn.clientAddress || undefined,
        clientGst: qtn.clientGst || undefined,
        status: "Planning",
      },
    });
    projectId = project.id;
    const { mockOneDrive } = await import("../services/mockOneDrive.js");
    await mockOneDrive.ensureProjectTree(projectId);
  }

  const row = await prisma.quotation.update({
    where: { id: qtn.id },
    data: { status: "Awarded", awardedAt: new Date(), awardedProjectId: projectId, projectId },
  });

  res.json({ quotation: row, projectId });
});

export const hrmRouter = Router();
const hrmUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
hrmRouter.use(requireAuth);

hrmRouter.get("/dashboard", async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    headcount,
    openOffers,
    pendingLeave,
    punchesToday,
    openReqs,
    activeCandidates,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { not: "admin" } } }),
    prisma.offer.count({ where: { status: { in: ["Draft", "Approved", "Sent"] } } }),
    prisma.leaveRequest.count({ where: { status: "Pending" } }),
    prisma.attendance.count({
      where: { date: { gte: today, lt: tomorrow }, checkIn: { not: null } },
    }),
    prisma.manpowerRequisition.count({ where: { status: { in: ["Draft", "PendingHR", "Approved"] } } }),
    prisma.candidate.count({ where: { status: { in: ["New", "Screened", "Shortlisted", "Interview", "Selected"] } } }),
  ]);

  res.json({
    headcount,
    openOffers,
    pendingLeave,
    punchesToday,
    openReqs,
    activeCandidates,
  });
});

hrmRouter.get("/employees", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["office", "site_employee", "employee", "admin", "vendor", "client"] } },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      portal: true,
      phone: true,
      isActive: true,
      memberships: { include: { project: { select: { id: true, code: true, name: true } } } },
    },
  });
  const profiles = await prisma.employeeProfile.findMany();
  res.json(users.map((u) => ({ ...u, profile: profiles.find((p) => p.userId === u.id) || null })));
});

hrmRouter.post("/employees", requireRoles("admin", "office"), async (req, res) => {
  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const { email, fullName, role, phone, empCode, department, designation, password } = req.body;
  if (!email || !fullName || !role) return res.status(400).json({ error: "email, fullName, role required" });
  const existing = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (existing) return res.status(409).json({ error: "Email already has a login" });
  const hash = await bcrypt.hash(password || process.env.SEED_PASSWORD || "Demo@1234", 10);
  const roleKey = role as import("@sharnam/shared").RoleKey;
  const user = await prisma.user.create({
    data: {
      email: String(email).trim().toLowerCase(),
      fullName,
      role: roleKey,
      portal: portalForRole(roleKey),
      phone,
      passwordHash: hash,
    },
  });
  if (role !== "client" && role !== "vendor") {
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: empCode || `EMP-${Date.now().toString().slice(-6)}`,
        department: department || null,
        designation: designation || null,
        joinDate: new Date(),
      },
    });
  }
  res.status(201).json(user);
});

hrmRouter.post("/assign", requireRoles("admin", "office"), async (req, res) => {
  const { projectId, userId, role } = req.body;
  if (!projectId || !userId) return res.status(400).json({ error: "projectId and userId required" });
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role || "member" },
    update: { role: role || "member" },
  });
  res.json(member);
});

hrmRouter.get("/attendance", async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  date.setHours(0, 0, 0, 0);
  const rows = await prisma.attendance.findMany({
    where: { date },
    include: { user: { select: { fullName: true, role: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
  const projects =
    projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, code: true, name: true, location: true },
        })
      : [];
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  res.json(
    rows.map((r) => ({
      ...r,
      project: r.projectId ? projectById[r.projectId] ?? null : null,
    }))
  );
});

/** Selfie + GPS punch — multipart: selfie (required), kind, lat, lng, accuracy, projectId */
hrmRouter.post(
  "/attendance/punch",
  requireRoles("admin", "office", "site_employee", "employee"),
  hrmUpload.single("selfie"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "selfie photo required" });

    const kind: "in" | "out" = req.body.kind === "out" ? "out" : "in";
    const lat = parseFloat(String(req.body.lat ?? ""));
    const lng = parseFloat(String(req.body.lng ?? ""));
    const acc = parseFloat(String(req.body.accuracy ?? ""));
    const projectId = typeof req.body.projectId === "string" ? req.body.projectId.trim() : "";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "GPS location required — allow location access on your device" });
    }

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const timeStr = new Date().toTimeString().slice(0, 5);

    let geofenceOk = false;
    let matchedSite: string | undefined;
    let projectCode = "OFFICE";
    if (projectId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      if (proj) {
        projectCode = proj.code;
        matchedSite = proj.location || proj.code;
        geofenceOk = true;
      }
    }

    const person = (req.user!.fullName || req.user!.email || "user").replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = "03_SUPPORT_AND_RESOURCES/03.02_Resources_and_Productivity/Attendance";
    const fname = `${kind}-${person}-${stamp}.jpg`;
    const saved = await mockOneDrive.upload(projectCode, folder, fname, req.file.buffer);
    const photoUrl = saved.url;

    const punchedAt = new Date().toISOString();

    const row = await prisma.attendance.upsert({
      where: { userId_date: { userId: req.user!.id, date } },
      create: {
        userId: req.user!.id,
        date,
        status: "Present",
        checkIn: kind === "in" ? timeStr : undefined,
        checkOut: kind === "out" ? timeStr : undefined,
        inLat: kind === "in" ? lat : null,
        inLng: kind === "in" ? lng : null,
        inAccuracy: kind === "in" && Number.isFinite(acc) ? acc : null,
        outLat: kind === "out" ? lat : null,
        outLng: kind === "out" ? lng : null,
        outAccuracy: kind === "out" && Number.isFinite(acc) ? acc : null,
        inSiteName: kind === "in" ? matchedSite ?? null : null,
        outSiteName: kind === "out" ? matchedSite ?? null : null,
        inGeofenceOk: kind === "in" ? geofenceOk : false,
        outGeofenceOk: kind === "out" ? geofenceOk : false,
        inPhotoUrl: kind === "in" ? photoUrl : null,
        outPhotoUrl: kind === "out" ? photoUrl : null,
        projectId: projectId || null,
      },
      update:
        kind === "in"
          ? {
              status: "Present",
              checkIn: timeStr,
              inLat: lat,
              inLng: lng,
              inAccuracy: Number.isFinite(acc) ? acc : undefined,
              inSiteName: matchedSite ?? undefined,
              inGeofenceOk: geofenceOk,
              inPhotoUrl: photoUrl,
              projectId: projectId || undefined,
            }
          : {
              checkOut: timeStr,
              outLat: lat,
              outLng: lng,
              outAccuracy: Number.isFinite(acc) ? acc : undefined,
              outSiteName: matchedSite ?? undefined,
              outGeofenceOk: geofenceOk,
              outPhotoUrl: photoUrl,
            },
    });

    await audit("hrm.attendance.punch", {
      userId: req.user!.id,
      entity: "Attendance",
      entityId: row.id,
      meta: {
        kind,
        punchedAt,
        localTime: timeStr,
        projectCode,
        projectId: projectId || null,
        siteName: matchedSite ?? null,
        lat,
        lng,
        accuracyM: Number.isFinite(acc) ? Math.round(acc) : null,
        mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
        geofenceOk,
        provider: saved.provider,
        photoPath: saved.path,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
      },
    });

    res.json({ ...row, provider: saved.provider, photoPath: saved.path });
  }
);

hrmRouter.post("/attendance", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const date = new Date(req.body.date || Date.now());
  date.setHours(0, 0, 0, 0);
  const kind: "in" | "out" = req.body.kind === "out" ? "out" : "in";
  const geo = req.body.geo || {};
  const lat = typeof geo.lat === "number" ? geo.lat : req.body.lat;
  const lng = typeof geo.lng === "number" ? geo.lng : req.body.lng;
  const acc = typeof geo.accuracy === "number" ? geo.accuracy : req.body.accuracy;
  const siteName: string | undefined = req.body.siteName;
  const projectId: string | undefined = req.body.projectId;

  let geofenceOk = false;
  let matchedSite: string | undefined = siteName;
  if (projectId && typeof lat === "number" && typeof lng === "number") {
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (proj) {
      matchedSite = matchedSite || proj.location || proj.code;
      geofenceOk = true;
    }
  }

  const row = await prisma.attendance.upsert({
    where: { userId_date: { userId: req.user!.id, date } },
    create: {
      userId: req.user!.id,
      date,
      status: req.body.status || "Present",
      checkIn: kind === "in" ? req.body.checkIn || new Date().toISOString() : undefined,
      checkOut: kind === "out" ? req.body.checkOut || new Date().toISOString() : undefined,
      inLat: kind === "in" ? lat ?? null : null,
      inLng: kind === "in" ? lng ?? null : null,
      inAccuracy: kind === "in" ? acc ?? null : null,
      outLat: kind === "out" ? lat ?? null : null,
      outLng: kind === "out" ? lng ?? null : null,
      outAccuracy: kind === "out" ? acc ?? null : null,
      inSiteName: kind === "in" ? matchedSite ?? null : null,
      outSiteName: kind === "out" ? matchedSite ?? null : null,
      inGeofenceOk: kind === "in" ? geofenceOk : false,
      outGeofenceOk: kind === "out" ? geofenceOk : false,
      inPhotoUrl: kind === "in" ? req.body.photoUrl || null : null,
      outPhotoUrl: kind === "out" ? req.body.photoUrl || null : null,
      projectId: projectId || null,
      notes: req.body.notes || null,
    },
    update:
      kind === "in"
        ? {
            status: req.body.status || undefined,
            checkIn: req.body.checkIn || new Date().toISOString(),
            inLat: lat ?? undefined,
            inLng: lng ?? undefined,
            inAccuracy: acc ?? undefined,
            inSiteName: matchedSite ?? undefined,
            inGeofenceOk: geofenceOk,
            inPhotoUrl: req.body.photoUrl || undefined,
            projectId: projectId || undefined,
          }
        : {
            status: req.body.status || undefined,
            checkOut: req.body.checkOut || new Date().toISOString(),
            outLat: lat ?? undefined,
            outLng: lng ?? undefined,
            outAccuracy: acc ?? undefined,
            outSiteName: matchedSite ?? undefined,
            outGeofenceOk: geofenceOk,
            outPhotoUrl: req.body.photoUrl || undefined,
          },
  });
  res.json(row);
});

/* ─── leave types, balances, holidays ─── */

hrmRouter.get("/leave-types", async (_req, res) => {
  const rows = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

hrmRouter.post("/leave-types", requireRoles("admin", "office"), async (req, res) => {
  const row = await prisma.leaveType.upsert({
    where: { code: String(req.body.code || req.body.name || "").toUpperCase() },
    create: {
      code: String(req.body.code || req.body.name).toUpperCase(),
      name: req.body.name,
      daysPerYear: Number(req.body.daysPerYear || 0),
      isPaid: req.body.isPaid !== false,
      carryForward: !!req.body.carryForward,
      requiresApproval: req.body.requiresApproval !== false,
      colour: req.body.colour || null,
    },
    update: {
      name: req.body.name,
      daysPerYear: Number(req.body.daysPerYear || 0),
      isPaid: req.body.isPaid !== false,
      carryForward: !!req.body.carryForward,
      requiresApproval: req.body.requiresApproval !== false,
      colour: req.body.colour || null,
    },
  });
  res.json(row);
});

hrmRouter.get("/holidays", async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const rows = await prisma.holiday.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
  res.json(rows);
});

hrmRouter.post("/holidays", requireRoles("admin", "office"), async (req, res) => {
  const rows: Array<{ date: string; name: string; region?: string; isOptional?: boolean }> = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  for (const r of rows) {
    if (!r.date || !r.name) continue;
    const date = new Date(r.date);
    date.setHours(0, 0, 0, 0);
    const row = await prisma.holiday.upsert({
      where: { date_name: { date, name: r.name } },
      create: { date, name: r.name, region: r.region || "India", isOptional: !!r.isOptional },
      update: { region: r.region || "India", isOptional: !!r.isOptional },
    });
    created.push(row);
  }
  res.status(201).json(created);
});

hrmRouter.delete("/holidays/:id", requireRoles("admin", "office"), async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

hrmRouter.get("/leave-balances", async (req: AuthedRequest, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const userId = String(req.query.userId || req.user!.id);
  const rows = await prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
  });
  res.json(rows);
});

hrmRouter.post("/leave-balances", requireRoles("admin", "office"), async (req, res) => {
  const { userId, leaveTypeId, year, entitled } = req.body;
  if (!userId || !leaveTypeId || !year) return res.status(400).json({ error: "userId, leaveTypeId, year required" });
  const row = await prisma.leaveBalance.upsert({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: Number(year) } },
    create: { userId, leaveTypeId, year: Number(year), entitled: Number(entitled || 0), used: 0, balance: Number(entitled || 0) },
    update: { entitled: Number(entitled || 0), balance: Number(entitled || 0) - (await prisma.leaveBalance.findUnique({ where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: Number(year) } } }))!.used },
  });
  res.json(row);
});

/* ─── employee documents (metadata only for now; upload endpoint later) ─── */

hrmRouter.get("/documents/:userId", async (req, res) => {
  const rows = await prisma.employeeDocument.findMany({ where: { userId: req.params.userId }, orderBy: { createdAt: "desc" } });
  res.json(rows);
});

hrmRouter.post("/documents", requireRoles("admin", "office"), async (req, res) => {
  const row = await prisma.employeeDocument.create({
    data: {
      userId: req.body.userId,
      category: req.body.category || "General",
      title: req.body.title,
      fileUrl: req.body.fileUrl,
      storagePath: req.body.storagePath || null,
      issuedOn: req.body.issuedOn ? new Date(req.body.issuedOn) : null,
      validTill: req.body.validTill ? new Date(req.body.validTill) : null,
    },
  });
  res.status(201).json(row);
});

hrmRouter.get("/leave", async (_req, res) => {
  const rows = await prisma.leaveRequest.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRouter.post("/leave", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const from = new Date(req.body.fromDate);
  const to = new Date(req.body.toDate);
  const halfDay = !!req.body.halfDay;
  const days = Number(req.body.days) || Math.max(halfDay ? 0.5 : 1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const row = await prisma.leaveRequest.create({
    data: {
      userId: req.user!.id,
      leaveTypeId: req.body.leaveTypeId || null,
      fromDate: from,
      toDate: to,
      days,
      halfDay,
      reason: req.body.reason,
    },
    include: { leaveType: true },
  });
  res.status(201).json(row);
});

hrmRouter.patch("/leave/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const status = String(req.body.status);
  const row = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: {
      status,
      approverId: req.user!.id,
      decidedAt: new Date(),
      decisionNote: req.body.decisionNote || null,
    },
  });
  if (status === "Approved" && before.status !== "Approved" && before.leaveTypeId) {
    const year = new Date(before.fromDate).getFullYear();
    const bal = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId: before.userId, leaveTypeId: before.leaveTypeId, year } },
    });
    if (bal) {
      const used = bal.used + before.days;
      await prisma.leaveBalance.update({
        where: { id: bal.id },
        data: { used, balance: bal.entitled - used },
      });
    }
  }
  res.json(row);
});

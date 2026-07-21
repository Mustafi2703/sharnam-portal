import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { buildDprPack, buildWprPack, renderDprHtml, renderWprHtml } from "../services/reportPacks.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

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

export const hrmRouter = Router();
hrmRouter.use(requireAuth);

hrmRouter.get("/employees", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["office", "site_employee", "employee", "admin", "vendor"] } },
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
  const hash = await bcrypt.hash(password || process.env.SEED_PASSWORD || "Demo@1234", 10);
  const roleKey = role as import("@sharnam/shared").RoleKey;
  const user = await prisma.user.create({
    data: {
      email,
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
    include: { user: { select: { fullName: true, role: true } } },
  });
  res.json(rows);
});

hrmRouter.post("/attendance", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const date = new Date(req.body.date || Date.now());
  date.setHours(0, 0, 0, 0);
  const row = await prisma.attendance.upsert({
    where: { userId_date: { userId: req.user!.id, date } },
    create: {
      userId: req.user!.id,
      date,
      status: req.body.status || "Present",
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
    },
    update: {
      status: req.body.status,
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
    },
  });
  res.json(row);
});

hrmRouter.get("/leave", async (_req, res) => {
  const rows = await prisma.leaveRequest.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRouter.post("/leave", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.leaveRequest.create({
    data: {
      userId: req.user!.id,
      fromDate: new Date(req.body.fromDate),
      toDate: new Date(req.body.toDate),
      reason: req.body.reason,
    },
  });
  res.status(201).json(row);
});

hrmRouter.patch("/leave/:id", requireRoles("admin", "office"), async (req, res) => {
  const row = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });
  res.json(row);
});

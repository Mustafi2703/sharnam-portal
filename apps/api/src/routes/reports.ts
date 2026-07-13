import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/daily/:projectId", async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  date.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const [diary, submissions, audits] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { projectId_logDate: { projectId: req.params.projectId, logDate: date } },
      include: { manpower: true, equipment: true, notes: true },
    }),
    prisma.checklistSubmission.findMany({
      where: {
        assignment: { projectId: req.params.projectId },
        createdAt: { gte: date, lt: next },
      },
      include: {
        assignment: { include: { template: true } },
        submittedBy: { select: { fullName: true } },
      },
    }),
    prisma.auditEvent.findMany({
      where: { createdAt: { gte: date, lt: next } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  res.json({
    type: "daily",
    date,
    diary,
    checklistSubmissions: submissions,
    activity: audits,
  });
});

reportsRouter.get("/weekly/:projectId", async (req, res) => {
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const [diaries, submissions, meetings, cost] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { projectId: req.params.projectId, logDate: { gte: start, lte: end } },
      include: { _count: { select: { manpower: true, notes: true } } },
    }),
    prisma.checklistSubmission.findMany({
      where: {
        assignment: { projectId: req.params.projectId },
        createdAt: { gte: start, lte: end },
      },
      include: { assignment: { include: { template: true } } },
    }),
    prisma.meeting.findMany({
      where: { projectId: req.params.projectId, meetingDate: { gte: start, lte: end } },
      include: { items: true },
    }),
    prisma.costCashflowPeriod.findMany({ where: { projectId: req.params.projectId } }),
  ]);

  res.json({
    type: "weekly",
    start,
    end,
    summary: {
      diaryDays: diaries.length,
      checklistsSubmitted: submissions.length,
      checklistsApproved: submissions.filter((s) => s.status === "Approved").length,
      meetings: meetings.length,
      openMeetingItems: meetings.flatMap((m) => m.items).filter((i) => i.resolutionStatus === "Open").length,
    },
    diaries,
    submissions,
    meetings,
    cashflow: cost,
    htmlStub: `<h1>Weekly Project Report</h1><p>${start.toDateString()} – ${end.toDateString()}</p><ul><li>Diary days: ${diaries.length}</li><li>Checklists: ${submissions.length}</li><li>Meetings: ${meetings.length}</li></ul>`,
  });
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

export const hrmRouter = Router();
hrmRouter.use(requireAuth);

hrmRouter.get("/employees", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["office", "site_employee", "employee", "admin"] } },
    select: { id: true, fullName: true, email: true, role: true, portal: true, phone: true, isActive: true },
  });
  const profiles = await prisma.employeeProfile.findMany();
  res.json(users.map((u) => ({ ...u, profile: profiles.find((p) => p.userId === u.id) || null })));
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

import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";

export const commsRouter = Router();
commsRouter.use(requireAuth);

commsRouter.get("/matrix/:projectId", async (req, res) => {
  const rows = await prisma.communicationMatrix.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { communicationType: "asc" },
  });
  res.json(rows);
});

commsRouter.post("/matrix/:projectId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.communicationMatrix.create({
    data: {
      projectId: req.params.projectId,
      communicationType: req.body.communicationType,
      fromRole: req.body.fromRole,
      toRole: req.body.toRole,
      frequency: req.body.frequency,
      channel: req.body.channel || "Email",
    },
  });
  await audit("comms.matrix.create", { userId: req.user!.id, entity: "CommunicationMatrix", entityId: row.id });
  res.status(201).json(row);
});

commsRouter.get("/logs/:projectId", async (req, res) => {
  const logs = await prisma.communicationLog.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { sentAt: "desc" },
  });
  res.json(logs);
});

commsRouter.get("/meetings/:projectId", async (req, res) => {
  const meetings = await prisma.meeting.findMany({
    where: { projectId: req.params.projectId },
    include: { items: true },
    orderBy: { meetingDate: "desc" },
  });
  res.json(meetings);
});

commsRouter.post("/meetings/:projectId", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const meeting = await prisma.meeting.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      meetingDate: new Date(req.body.meetingDate || Date.now()),
      location: req.body.location,
      status: req.body.status || "Scheduled",
    },
  });
  await audit("meeting.schedule", { userId: req.user!.id, entity: "Meeting", entityId: meeting.id });
  res.status(201).json(meeting);
});

commsRouter.post("/meetings/:id/items", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const item = await prisma.meetingItem.create({
    data: {
      meetingId: req.params.id,
      category: req.body.category || "Agenda",
      description: req.body.description,
      assignedToId: req.body.assignedToId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      priority: req.body.priority || "Medium",
    },
  });
  res.status(201).json(item);
});

commsRouter.post("/logs/:projectId", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const log = await prisma.communicationLog.create({
    data: {
      projectId: req.params.projectId,
      subject: req.body.subject,
      body: req.body.body,
      fromUser: req.user!.fullName,
      toRoles: Array.isArray(req.body.toRoles) ? req.body.toRoles.join(",") : String(req.body.toRoles || "client"),
      channel: req.body.channel || "In-App",
    },
  });
  await audit("comms.log", { userId: req.user!.id, entity: "CommunicationLog", entityId: log.id });
  res.status(201).json(log);
});

commsRouter.patch(
  "/meetings/items/:itemId",
  requireRoles("admin", "office", "site_employee"),
  async (req: AuthedRequest, res) => {
    const item = await prisma.meetingItem.update({
      where: { id: req.params.itemId },
      data: {
        resolutionStatus: req.body.resolutionStatus,
        priority: req.body.priority,
        description: req.body.description,
      },
    });
    res.json(item);
  }
);

commsRouter.patch("/meetings/:id", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      location: req.body.location,
    },
  });
  res.json(meeting);
});

commsRouter.post("/meetings/:id/carry-over", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const source = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!source) return res.status(404).json({ error: "Not found" });

  const openItems = source.items.filter((i) => i.resolutionStatus === "Open" || i.resolutionStatus === "Carried Over");
  const next = await prisma.meeting.create({
    data: {
      projectId: source.projectId,
      title: `${source.title} (Follow-up)`,
      meetingDate: new Date(req.body.meetingDate || Date.now()),
      location: source.location,
      status: "Follow-up",
      parentMeetingId: source.id,
      items: {
        create: openItems.map((i) => ({
          category: "Follow-up",
          description: i.description,
          assignedToId: i.assignedToId,
          dueDate: i.dueDate,
          priority: i.priority,
          resolutionStatus: "Open",
          carriedOverFrom: i.id,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.meeting.update({
    where: { id: source.id },
    data: { status: "Closed" },
  });

  await prisma.meetingItem.updateMany({
    where: { id: { in: openItems.map((i) => i.id) } },
    data: { resolutionStatus: "Carried Over" },
  });

  await audit("meeting.carry_over", { userId: req.user!.id, entity: "Meeting", entityId: next.id });
  res.status(201).json(next);
});

/** Seed agenda items BEFORE MoM (client video flow) */
commsRouter.post(
  "/meetings/:id/generate-agenda",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return res.status(404).json({ error: "Not found" });

    const defaults: string[] =
      req.body.items ||
      [
        "Safety / toolbox talk",
        "Drawing revisions & publish status",
        "Checklist / QI progress",
        "Open RFIs & concerns",
        "Site progress vs programme",
        "Vendor / material coordination",
        "AOB",
      ];

    const created = await prisma.$transaction(
      defaults.map((description: string) =>
        prisma.meetingItem.create({
          data: {
            meetingId: meeting.id,
            category: "Agenda",
            description,
            priority: "Medium",
            resolutionStatus: "Open",
          },
        })
      )
    );

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "Agenda", agendaNotes: req.body.agendaNotes || meeting.agendaNotes },
    });

    await audit("meeting.agenda_generate", { userId: req.user!.id, entity: "Meeting", entityId: meeting.id });
    res.status(201).json({ meetingId: meeting.id, items: created });
  }
);

/** Promote Agenda → MoM after agenda is ready */
commsRouter.post(
  "/meetings/:id/start-mom",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!meeting) return res.status(404).json({ error: "Not found" });
    const agendaCount = meeting.items.filter((i) => i.category === "Agenda").length;
    if (agendaCount === 0) {
      return res.status(400).json({ error: "Generate agenda items before starting MoM." });
    }
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "MoM" },
      include: { items: true },
    });
    await audit("meeting.start_mom", { userId: req.user!.id, entity: "Meeting", entityId: meeting.id });
    res.json(updated);
  }
);
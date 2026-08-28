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

/** Seed Meeting + RFI matrix rows so respond/fill parties are defined */
commsRouter.post("/matrix/:projectId/seed-standard", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const specs = [
    { communicationType: "RFI Update", fromRole: "office", toRole: "client", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "employee", toRole: "office", frequency: "As needed", channel: "RFI" },
    { communicationType: "Site Meeting", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Meeting" },
    { communicationType: "Site Meeting", fromRole: "office", toRole: "vendor", frequency: "Weekly", channel: "Meeting" },
    { communicationType: "Site Meeting", fromRole: "office", toRole: "site_employee", frequency: "Weekly", channel: "Meeting" },
    { communicationType: "Design Meeting", fromRole: "employee", toRole: "office", frequency: "Bi-weekly", channel: "Meeting" },
    { communicationType: "Design Meeting", fromRole: "office", toRole: "client", frequency: "Bi-weekly", channel: "Meeting" },
    { communicationType: "Checklist fill", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
    { communicationType: "Checklist fill", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
  ];
  let created = 0;
  for (const s of specs) {
    const exists = await prisma.communicationMatrix.findFirst({
      where: {
        projectId,
        communicationType: s.communicationType,
        fromRole: s.fromRole,
        toRole: s.toRole,
        channel: s.channel,
      },
    });
    if (exists) continue;
    await prisma.communicationMatrix.create({ data: { projectId, ...s, isActive: true } });
    created += 1;
  }
  await audit("comms.matrix.seed", { userId: req.user!.id, entity: "Project", entityId: projectId, meta: { created } });
  res.json({ ok: true, created });
});

/** BPCL-style contact matrix (TECHNICAL / COMMERCIAL) */
commsRouter.get("/contacts/:projectId", async (req, res) => {
  const kind = String(req.query.kind || "TECHNICAL").toUpperCase();
  const rows = await prisma.communicationContact.findMany({
    where: { projectId: req.params.projectId, matrixKind: kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(rows);
});

commsRouter.post("/contacts/:projectId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const count = await prisma.communicationContact.count({
    where: { projectId: req.params.projectId, matrixKind: req.body.matrixKind || "TECHNICAL" },
  });
  const row = await prisma.communicationContact.create({
    data: {
      projectId: req.params.projectId,
      matrixKind: req.body.matrixKind || "TECHNICAL",
      orgSection: req.body.orgSection || "Other",
      orgName: req.body.orgName || req.body.company || "—",
      isSectionHeader: !!req.body.isSectionHeader,
      sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) : count + 1,
      personName: req.body.personName,
      designation: req.body.designation,
      company: req.body.company,
      spoc: req.body.spoc,
      mobile: req.body.mobile,
      email: req.body.email,
      mailRole: req.body.mailRole,
      officeAddress: req.body.officeAddress,
    },
  });
  await audit("comms.contact.create", { userId: req.user!.id, entity: "CommunicationContact", entityId: row.id });
  res.status(201).json(row);
});

commsRouter.patch("/contacts/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.communicationContact.update({
    where: { id: req.params.id },
    data: {
      personName: req.body.personName,
      designation: req.body.designation,
      company: req.body.company,
      spoc: req.body.spoc,
      mobile: req.body.mobile,
      email: req.body.email,
      mailRole: req.body.mailRole,
      officeAddress: req.body.officeAddress,
      orgSection: req.body.orgSection,
      orgName: req.body.orgName,
    },
  });
  res.json(row);
});

commsRouter.delete("/contacts/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.communicationContact.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Seed demo BPCL-shaped contacts if empty */
commsRouter.post("/contacts/:projectId/seed-demo", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const kind = String(req.body.matrixKind || "TECHNICAL").toUpperCase();
  const existing = await prisma.communicationContact.count({ where: { projectId, matrixKind: kind } });
  if (existing > 0) return res.json({ ok: true, seeded: 0, message: "Contacts already exist" });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const blocks: Array<Parameters<typeof prisma.communicationContact.create>[0]["data"]> = [
    { projectId, matrixKind: kind, orgSection: "Client", orgName: project?.clientName || "Client", isSectionHeader: true, sortOrder: 1 },
    {
      projectId,
      matrixKind: kind,
      orgSection: "Client",
      orgName: project?.clientName || "Client",
      sortOrder: 2,
      personName: project?.clientContactName || "Client contact",
      designation: "Project lead",
      company: project?.clientName || "Client",
      spoc: project?.clientContactName || "—",
      mobile: project?.clientPhone || "",
      email: project?.clientEmail || "",
      mailRole: "TO",
      officeAddress: project?.clientAddress || "",
    },
    { projectId, matrixKind: kind, orgSection: "PMC", orgName: "Sharnam Project Development Consultants & Co.", isSectionHeader: true, sortOrder: 10 },
    {
      projectId,
      matrixKind: kind,
      orgSection: "PMC",
      orgName: "Sharnam Project Development Consultants & Co.",
      sortOrder: 11,
      personName: "Mr. Nirav Parekh",
      designation: "Director",
      company: "Sharnam PDC",
      spoc: "Project Co-ordinator (HO) / Site PM",
      mobile: "8160757201",
      email: "nirav@spdc.in",
      mailRole: "CC",
      officeAddress: "Vadodara",
    },
    {
      projectId,
      matrixKind: kind,
      orgSection: "PMC",
      orgName: "Sharnam Project Development Consultants & Co.",
      sortOrder: 12,
      personName: "Mr. Saurabh Prajapati",
      designation: "Project Co-ordinator",
      company: "Sharnam PDC",
      mobile: "9106945294",
      email: "operations@spdc.in",
      mailRole: "TO",
    },
    { projectId, matrixKind: kind, orgSection: "Consultant", orgName: project?.designConsultant || "Design consultant", isSectionHeader: true, sortOrder: 20 },
    {
      projectId,
      matrixKind: kind,
      orgSection: "Consultant",
      orgName: project?.designConsultant || "Design consultant",
      sortOrder: 21,
      personName: "Design lead",
      designation: "Project Manager",
      company: project?.designConsultant || "Consultant",
      mailRole: "CC",
    },
    { projectId, matrixKind: kind, orgSection: "Contractor", orgName: project?.contractorName || "Main contractor", isSectionHeader: true, sortOrder: 30 },
    {
      projectId,
      matrixKind: kind,
      orgSection: "Contractor",
      orgName: project?.contractorName || "Main contractor",
      sortOrder: 31,
      personName: "Site in-charge",
      designation: "Project Manager",
      company: project?.contractorName || "Contractor",
      mailRole: "TO",
    },
  ];

  for (const data of blocks) {
    await prisma.communicationContact.create({ data });
  }
  res.status(201).json({ ok: true, seeded: blocks.length });
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
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    select: { id: true, code: true, name: true, notificationEmails: true, notificationWhatsApp: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const durationMins = Math.max(15, Math.min(480, Number(req.body.durationMins) || 60));
  const meetingDate = new Date(req.body.meetingDate || Date.now());

  const meeting = await prisma.meeting.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      meetingDate,
      location: req.body.location,
      status: req.body.status || "Agenda",
      durationMins,
    },
  });
  await audit("meeting.schedule", { userId: req.user!.id, entity: "Meeting", entityId: meeting.id });

  const attendeeRaw =
    typeof req.body.attendeeEmails === "string" && req.body.attendeeEmails.trim()
      ? req.body.attendeeEmails.trim()
      : (project.notificationEmails || "").trim();

  const agendaFromBody = Array.isArray(req.body.agendaItems)
    ? req.body.agendaItems.map(String).filter(Boolean)
    : undefined;

  let invite: Record<string, unknown> | null = null;
  try {
    const { scheduleMeetingWithInvite } = await import("../services/meetingNotify.js");
    const result = await scheduleMeetingWithInvite({
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      meetingId: meeting.id,
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      durationMins,
      location: meeting.location,
      status: meeting.status,
      createdByName: req.user!.fullName || undefined,
      createdById: req.user!.id,
      attendeeEmails: attendeeRaw || undefined,
      createTeams: req.body.createTeams !== false,
      agendaItems: agendaFromBody,
    });

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        teamsJoinUrl: result.teamsJoinUrl,
        graphEventId: result.graphEventId,
        calendarWebLink: result.calendarWebLink,
      },
    });

    invite = {
      teamsJoinUrl: result.teamsJoinUrl,
      graphEventId: result.graphEventId,
      calendarWebLink: result.calendarWebLink,
      teamsProvider: result.teamsProvider,
      teamsNote: result.teamsNote,
      email: result.email,
      whatsApp: project.notificationWhatsApp ? "queued" : "no_numbers",
    };

    return res.status(201).json({ ...updated, invite });
  } catch (err) {
    invite = { error: err instanceof Error ? err.message : String(err) };
  }

  res.status(201).json({ ...meeting, invite });
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

/**
 * Sharnam-branded MoM one-pager · returns print-ready HTML (browser prints to PDF).
 * Includes attendees, agenda, discussion notes, action items, open follow-ups from
 * the parent meeting and signatory blocks for PMC / Client / Contractor.
 */
commsRouter.get("/meetings/:id/download.html", async (req, res) => {
  try {
    const { generateMomExport } = await import("../services/momExport.js");
    const { html } = await generateMomExport(req.params.id);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Same MoM data written to a branded XLSX (Cover · Attendees · Agenda · Discussion · Actions · Open follow-ups). */
commsRouter.get("/meetings/:id/download.xlsx", async (req, res) => {
  try {
    const { generateMomExport } = await import("../services/momExport.js");
    const { xlsx, filenameBase } = await generateMomExport(req.params.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MoM-${filenameBase}.xlsx"`);
    res.send(xlsx);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * Email the MoM to attendees as HTML.  Idempotent — same MoM sent twice will not
 * double-count; delivery events are recorded via audit log.
 */
commsRouter.post(
  "/meetings/:id/email",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    try {
      const { generateMomExport } = await import("../services/momExport.js");
      const { html, filenameBase } = await generateMomExport(req.params.id);
      const meeting = await prisma.meeting.findUnique({
        where: { id: req.params.id },
        include: { project: { select: { code: true, name: true } }, items: { include: { assignedTo: true } } },
      });
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });

      const bodyEmails = Array.isArray(req.body?.emails)
        ? req.body.emails.map(String)
        : String(req.body?.emails || "")
            .split(/[,;\s]+/)
            .filter(Boolean);
      const ownerEmails = meeting.items
        .map((it) => it.assignedTo?.email)
        .filter((e): e is string => Boolean(e));
      const to = Array.from(new Set([...bodyEmails, ...ownerEmails]));

      const { queueProjectEmail } = await import("../services/email.js");
      const result = await queueProjectEmail({
        projectId: meeting.projectId,
        subject: `MoM · ${meeting.title} · ${meeting.meetingDate.toDateString()}`,
        body: `Please find the Minutes of Meeting for ${meeting.title} held on ${meeting.meetingDate.toDateString()}. Full MoM opens in a browser at the attached link and can be printed to PDF from there.`,
        bodyHtml: html,
        context: `MoM ${meeting.id}`,
        toOverride: to.join(", "),
        createdById: req.user!.id,
      });

      await audit("meeting.email", {
        userId: req.user!.id,
        entity: "Meeting",
        entityId: meeting.id,
        meta: { to, filenameBase, status: result },
      });
      res.json({ ok: true, to, result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);
/**
 * SPDC live demo team — real communicator accounts + comms matrix + meetings +
 * design coordination + NCR/CAR on SPDC-DEMO-01.
 */
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { portalForRole, type RoleKey } from "@sharnam/shared";
import { prisma } from "../prisma.js";

const PASSWORD = process.env.SEED_PASSWORD || "Demo@1234";

export const LIVE_TEAM: { email: string; fullName: string; role: RoleKey; org: string }[] = [
  { email: "baibhabmustafi@gmail.com", fullName: "Baibhab Kumar Mustafi", role: "admin", org: "Twinoxis / SPDC UAT" },
  { email: "admin@twinoxis.com", fullName: "Twinoxis Admin", role: "vendor", org: "Twinoxis Demo Contractor" },
  { email: "hello@twinoxis.com", fullName: "Twinoxis Site Engineer", role: "site_employee", org: "Twinoxis" },
  { email: "nirav@spdc.in", fullName: "Nirav Parekh", role: "office", org: "SPDC" },
  { email: "operations@spdc.in", fullName: "Saurabh Prajapati", role: "office", org: "SPDC Operations" },
  { email: "saurabh@spdc.in", fullName: "Saurabh Prajapati", role: "office", org: "SPDC" },
  { email: "akshay.lad@spdc.in", fullName: "Akshay Lad", role: "office", org: "SPDC" },
  { email: "nitin.vankar@spdc.in", fullName: "Nitin Vankar", role: "office", org: "SPDC" },
  { email: "hitesh.rajput@spdc.in", fullName: "Hitesh Rajput", role: "office", org: "SPDC" },
  { email: "jaideep.parmar@spdc.in", fullName: "Jaideep Parmar", role: "office", org: "SPDC" },
  { email: "ravi.solanki@spdc.in", fullName: "Ravi Solanki", role: "office", org: "SPDC" },
  { email: "jaypal.rathod@spdc.in", fullName: "Jaypal Rathod", role: "office", org: "SPDC" },
  { email: "planning.estimation@spdc.in", fullName: "Planning & Estimation", role: "office", org: "SPDC Planning" },
  { email: "anushka.jha@spdc.in", fullName: "Anushka Jha (HR Head)", role: "office", org: "SPDC HR" },
  { email: "info@spdc.in", fullName: "SPDC Info Desk", role: "office", org: "SPDC" },
  { email: "pratik.solanki@spdc.in", fullName: "Pratik Solanki", role: "office", org: "SPDC" },
];

const ALL_NOTIFY = LIVE_TEAM.map((t) => t.email).join(", ");

async function ensureUsers(db: PrismaClient) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const out: Record<string, string> = {};
  for (const t of LIVE_TEAM) {
    const u = await db.user.upsert({
      where: { email: t.email.toLowerCase() },
      create: {
        email: t.email.toLowerCase(),
        fullName: t.fullName,
        role: t.role,
        portal: portalForRole(t.role),
        passwordHash: hash,
      },
      update: {
        fullName: t.fullName,
        role: t.role,
        portal: portalForRole(t.role),
        passwordHash: hash,
      },
    });
    out[t.email] = u.id;
  }
  return out;
}

async function ensureProjectMembers(db: PrismaClient, projectId: string, userIds: Record<string, string>) {
  for (const t of LIVE_TEAM) {
    const userId = userIds[t.email];
    if (!userId) continue;
    const role =
      t.role === "admin" || t.role === "office"
        ? "project_manager"
        : t.role === "site_employee"
          ? "site_engineer"
          : t.role === "client"
            ? "client_rep"
            : "viewer";
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role },
      update: { role },
    });
  }
}

async function seedCommsMatrix(db: PrismaClient, projectId: string) {
  const rows = [
    { communicationType: "Weekly Site Meeting", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Meeting" },
    { communicationType: "Design Coordination", fromRole: "employee", toRole: "office", frequency: "Bi-weekly", channel: "Meeting" },
    { communicationType: "RFI / Ask", fromRole: "site_employee", toRole: "employee", frequency: "As required", channel: "Email" },
    { communicationType: "NCR / CAR escalation", fromRole: "office", toRole: "vendor", frequency: "As required", channel: "Email" },
    { communicationType: "MoM follow-up", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Email" },
  ];
  for (const r of rows) {
    const existing = await db.communicationMatrix.findFirst({
      where: { projectId, communicationType: r.communicationType },
    });
    if (existing) await db.communicationMatrix.update({ where: { id: existing.id }, data: r });
    else await db.communicationMatrix.create({ data: { projectId, ...r } });
  }
}

async function seedContacts(db: PrismaClient, projectId: string) {
  const { seedBpclAllMatrices } = await import("./bpclMatrixSeed.js");
  await seedBpclAllMatrices(projectId, { force: true });
}

async function seedMeetings(db: PrismaClient, projectId: string, userIds: Record<string, string>) {
  const officeId = userIds["hello@twinoxis.com"] || userIds["nirav@spdc.in"];
  const meetDate = new Date(Date.now() + 2 * 86400000);
  meetDate.setHours(11, 0, 0, 0);

  let meeting = await db.meeting.findFirst({
    where: { projectId, title: "Weekly PMC coordination — UAT demo" },
  });
  if (!meeting) {
    meeting = await db.meeting.create({
      data: {
        projectId,
        title: "Weekly PMC coordination — UAT demo",
        meetingDate: meetDate,
        location: "Microsoft Teams / Site office",
        status: "Agenda",
        durationMins: 90,
        agendaNotes: `Attendees: ${ALL_NOTIFY}`,
        items: {
          create: [
            { category: "Agenda", description: "Progress vs plan — dormitory block & external works", priority: "High", resolutionStatus: "Open", assignedToId: officeId },
            { category: "Agenda", description: "Open RFIs — drawing checklist & quality inspection", priority: "High", resolutionStatus: "Open" },
            { category: "Agenda", description: "NCR / CAR status — cube failures & rebar cover", priority: "Medium", resolutionStatus: "Open" },
            { category: "Agenda", description: "Design coordination — AHU duct vs beam clash", priority: "High", resolutionStatus: "Open" },
          ],
        },
      },
    });
  }

  const momMeeting = await db.meeting.findFirst({
    where: { projectId, title: "Previous week MoM — action follow-up" },
  });
  if (!momMeeting) {
    await db.meeting.create({
      data: {
        projectId,
        title: "Previous week MoM — action follow-up",
        meetingDate: new Date(Date.now() - 7 * 86400000),
        location: "Teams",
        status: "Follow-up",
        durationMins: 45,
        items: {
          create: [
            { category: "Follow-up", description: "Confirm GFC publish for Block A elevations — still open", priority: "High", resolutionStatus: "Open", assignedToId: officeId },
            { category: "Follow-up", description: "Vendor induction Pearl Electricals — closed", priority: "Low", resolutionStatus: "Closed" },
          ],
        },
      },
    });
  }
  return meeting;
}

async function seedCoordination(db: PrismaClient, projectId: string, userIds: Record<string, string>) {
  const drawing = await db.drawing.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" } });
  const issues = [
    {
      title: "AHU duct vs beam clash — Level 3",
      description: "Structural beam B-12 conflicts with proposed AHU duct routing. Need revised GFC or site deviation approval.",
      discipline: "MEP",
      location: "Block A · L3",
      priority: "High",
      assignedToName: "MEP Design Engineer",
      assignedToEmail: "hello@twinoxis.com",
      followUpCount: 1,
    },
    {
      title: "Stair headroom clearance — Grid C4",
      description: "Finished floor level leaves 1980mm clear height vs 2100mm required. Escalate if no response by due date.",
      discipline: "Architectural",
      location: "Grid C4",
      priority: "Medium",
      assignedToEmail: "nirav@spdc.in",
      assignedToName: "Nirav Parekh",
      followUpCount: 0,
    },
  ];
  for (const iss of issues) {
    const existing = await db.designCoordinationIssue.findFirst({ where: { projectId, title: iss.title } });
    if (existing) {
      await db.designCoordinationIssue.update({
        where: { id: existing.id },
        data: { ...iss, linkedDrawingId: drawing?.id ?? existing.linkedDrawingId, assignedToId: userIds[iss.assignedToEmail] ?? existing.assignedToId },
      });
    } else {
      await db.designCoordinationIssue.create({
        data: {
          projectId,
          ...iss,
          linkedDrawingId: drawing?.id ?? null,
          assignedToId: userIds[iss.assignedToEmail] ?? null,
          dueDate: new Date(Date.now() + 5 * 86400000),
        },
      });
    }
  }
}

async function seedNcrCar(db: PrismaClient, projectId: string) {
  const ncrs = [
    { number: "NCR-Q-018", ncrType: "QualityNCR", description: "Cube test Block-1 Grid B3–B5: 22.4 N/mm² avg vs M25 spec. Hold further pour in bay until retest.", location: "Dormitory Block-1 · B3–B5", contractor: "Bhavna Infra", status: "Open" },
    { number: "CAR-007", ncrType: "QualityCAR", description: "Recurring inadequate rebar cover (15mm vs 40mm) footings F-12 to F-18. CAP required in 48h.", location: "Footings F-12–F18", contractor: "Bhavna Infra", status: "Open" },
  ];
  for (const n of ncrs) {
    const existing = await db.qualityNcr.findFirst({ where: { projectId, number: n.number } });
    if (existing) await db.qualityNcr.update({ where: { id: existing.id }, data: n });
    else await db.qualityNcr.create({ data: { projectId, ...n, issueDate: new Date(), plannedClosure: new Date(Date.now() + 7 * 86400000), source: "UAT seed" } });
  }
}

async function seedDemoRfi(db: PrismaClient, projectId: string, userId: string) {
  const number = "RFI-2026-UAT-142";
  let rfi = await db.rfi.findFirst({ where: { projectId, number } });
  if (!rfi) {
    rfi = await db.rfi.create({
      data: {
        projectId,
        number,
        subject: "UGWT waterproofing detail at plinth junction — AR-104",
        question: "Confirm membrane lap at UGWT–plinth junction per GFC AR-104. Contractor proposes alternate cold-joint treatment — advise if mock-up required before bulk pour.",
        rfiKind: "RequestForInformation",
        status: "Open",
        ballInCourt: "Design Consultant",
        createdById: userId,
        dueDate: new Date(Date.now() + 4 * 86400000),
        scheduleImpact: "Potential 3-day delay",
        costImpact: "None",
      },
    });
  }
  const hasResp = await db.rfiResponse.findFirst({ where: { rfiId: rfi.id, isOfficialResponse: true } });
  if (!hasResp) {
    await db.rfiResponse.create({
      data: {
        rfiId: rfi.id,
        respondedById: userId,
        responseText: "Proceed with detail 3 on sheet AR-104 Rev C. Mock-up required at one junction before bulk work — PMC to witness. (Automated UAT response — no human reply needed.)",
        isOfficialResponse: true,
        responseChannel: "Portal",
      },
    });
  }
  return rfi;
}

async function seedQapRow(db: PrismaClient, projectId: string) {
  const existing = await db.qapActivity.findFirst({ where: { projectId, activity: { contains: "UAT demo" } } });
  if (existing) return;
  await db.qapActivity.create({
    data: {
      projectId,
      weekLabel: "Week 50",
      srNo: "UAT-1",
      section: "UAT demo — quality walkdown",
      activity: "UAT demo — slab pour inspection Block A",
      description: "Witness test cube sampling & cover block audit",
      frequency: "Once",
      status: "Planned",
      contractorPerformer: "Site",
      pmcRole: "SPDC Ops",
    },
  });
}

export async function seedSpdcLiveTeam(db: PrismaClient = prisma) {
  const userIds = await ensureUsers(db);
  const project =
    (await db.project.findUnique({ where: { code: "SPDC-DEMO-01" } })) ||
    (await db.project.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!project) throw new Error("No demo project — run npm run db:seed first");

  await ensureProjectMembers(db, project.id, userIds);
  await seedCommsMatrix(db, project.id);
  await seedContacts(db, project.id);
  const meeting = await seedMeetings(db, project.id, userIds);
  await seedCoordination(db, project.id, userIds);
  await seedNcrCar(db, project.id);
  const officeId = userIds["hello@twinoxis.com"] || userIds["nirav@spdc.in"];
  const rfi = officeId ? await seedDemoRfi(db, project.id, officeId) : null;
  await seedQapRow(db, project.id);

  await db.project.update({ where: { id: project.id }, data: { notificationEmails: ALL_NOTIFY } }).catch(() => {});

  try {
    const { ensureVendorPortalLogin } = await import("./vendorPortal.js");
    let twinoxisVendor = await db.vendor.findFirst({ where: { email: "admin@twinoxis.com" } });
    if (!twinoxisVendor) {
      twinoxisVendor = await db.vendor.create({
        data: {
          name: "Twinoxis Demo Contractor",
          partyType: "Contractor",
          email: "admin@twinoxis.com",
          trade: "Civil,MEP,Structural",
          createdVia: "UAT seed",
        },
      });
    }
    const adminUser = await db.user.findUnique({ where: { email: "admin@twinoxis.com" } });
    if (adminUser && twinoxisVendor) {
      await db.user.update({ where: { id: adminUser.id }, data: { vendorId: twinoxisVendor.id } });
    }
    const bhavna = await db.vendor.findFirst({ where: { name: { contains: "Bhavna" } } });
    if (bhavna) {
      await db.vendorContact.upsert({
        where: { email: "hello@twinoxis.com" },
        create: { vendorId: bhavna.id, email: "hello@twinoxis.com", fullName: "Twinoxis Site — Bhavna liaison", role: "Site coordinator" },
        update: { vendorId: bhavna.id },
      });
    }
  } catch (e) {
    console.warn("Vendor portal links for UAT team:", e instanceof Error ? e.message : e);
  }

  return { project, userIds, meeting, rfi, password: PASSWORD, notify: ALL_NOTIFY };
}

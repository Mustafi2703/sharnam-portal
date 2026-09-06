/**
 * SPDC-UAT-LIVE walkthrough seed — stakeholders, HRMS links, NCR/CAR, Safety NCR,
 * open RFI, CRM bid package, project directory & demo logins.
 */
import type { PrismaClient } from "@prisma/client";
import { UAT_LIVE_CODE } from "./uatDemoProjectSeed.js";

const TAG = "uat-walkthrough-seed";
const CONTRACTOR = "M/s Nikhra Infra";
const CONTRACTOR_EMAIL = "nkinra@sharnam.demo";

const STAKEHOLDER_VENDORS = [
  {
    name: "AK Consultant",
    partyType: "Consultant",
    trade: "Project Consultant",
    email: "ak@consultant.demo",
    primaryContactName: "A. Kumar",
    city: "Ahmedabad",
  },
  {
    name: "Struct Design Associates",
    partyType: "Consultant",
    trade: "Structural Consultant",
    email: "struct@sharnam.demo",
    primaryContactName: "Structural Reviewer",
    city: "Ahmedabad",
  },
  {
    name: "MEP Design Studio",
    partyType: "Consultant",
    trade: "MEP Consultant",
    email: "mep@sharnam.demo",
    primaryContactName: "MEP Design Engineer",
    city: "Ahmedabad",
  },
  {
    name: "Partner PMC Alliance",
    partyType: "PMC",
    trade: "PMC Partner",
    email: "pmc@sharnam.demo",
    primaryContactName: "Partner PMC Lead",
    city: "Ahmedabad",
  },
  {
    name: "Arvind Limited",
    partyType: "Client",
    trade: "Client / Owner",
    email: "client@sharnam.demo",
    primaryContactName: "Client PM",
    city: "Ahmedabad",
  },
] as const;

const STAKEHOLDER_USERS = [
  { email: "ak@consultant.demo", fullName: "A. Kumar — AK Consultant", role: "employee" as const },
  { email: "struct@sharnam.demo", fullName: "Structural Reviewer", role: "employee" as const },
  { email: "mep@sharnam.demo", fullName: "MEP Design Engineer", role: "employee" as const },
  { email: "pmc@sharnam.demo", fullName: "Partner PMC Lead", role: "employee" as const },
];

async function ensureStakeholderUsers(db: PrismaClient) {
  const bcrypt = await import("bcryptjs");
  const { portalForRole } = await import("@sharnam/shared");
  const hash = await bcrypt.hash(process.env.SEED_PASSWORD || "Demo@1234", 10);
  const ids: Record<string, string> = {};
  for (const u of STAKEHOLDER_USERS) {
    const row = await db.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        portal: portalForRole(u.role),
        passwordHash: hash,
      },
      update: { fullName: u.fullName, role: u.role, passwordHash: hash },
    });
    ids[u.email] = row.id;
    const empCode = `EMP-${u.email.split("@")[0].toUpperCase().slice(0, 10)}`;
    await db.employeeProfile.upsert({
      where: { userId: row.id },
      create: { userId: row.id, empCode, department: "Consultant", designation: u.fullName },
      update: { department: "Consultant" },
    });
  }
  return ids;
}

async function assignProjectParties(db: PrismaClient, projectId: string, userIds: Record<string, string>) {
  for (const email of Object.keys(userIds)) {
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: userIds[email] } },
      create: {
        projectId,
        userId: userIds[email],
        role: email.includes("pmc") ? "project_manager" : "member",
      },
      update: {},
    });
  }

  for (const v of STAKEHOLDER_VENDORS) {
    let vendor = await db.vendor.findFirst({ where: { email: v.email } });
    if (!vendor) {
      vendor = await db.vendor.create({
        data: { ...v, country: "India", state: "Gujarat", createdVia: TAG, isPrequalified: true },
      });
    } else {
      vendor = await db.vendor.update({
        where: { id: vendor.id },
        data: { partyType: v.partyType, trade: v.trade, primaryContactName: v.primaryContactName },
      });
    }
    await db.projectVendor.upsert({
      where: { projectId_vendorId: { projectId, vendorId: vendor.id } },
      create: { projectId, vendorId: vendor.id, tradeRole: v.trade, assignedVia: TAG },
      update: { tradeRole: v.trade },
    });
  }

  const site = await db.user.findFirst({ where: { email: "site@sharnam.demo" } });
  const office =
    (await db.user.findFirst({ where: { email: "operations@spdc.in" } })) ||
    (await db.user.findFirst({ where: { email: "office@sharnam.demo" } }));
  if (site) {
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: site.id } },
      create: { projectId, userId: site.id, role: "site_engineer" },
      update: {},
    });
  }
  if (office) {
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: office.id } },
      create: { projectId, userId: office.id, role: "project_manager" },
      update: {},
    });
  }
}

async function seedQualityNcrCar(db: PrismaClient, projectId: string) {
  const formBase = {
    contractorEmail: CONTRACTOR_EMAIL,
    toParty: CONTRACTOR,
    contractor: CONTRACTOR,
  };
  const rows = [
    {
      number: "NCR-Q-UAT-018",
      ncrType: "QualityNCR",
      description:
        "Cube test Block-1 Grid B3–B5: 22.4 N/mm² avg vs M25 spec. Hold further pour until retest passes.",
      location: "Dormitory Block-1 · B3–B5",
      contractor: CONTRACTOR,
      status: "Open",
      formDataJson: JSON.stringify({
        ...formBase,
        actionRequired: "Retest cubes within 48h; submit lab report to PMC.",
        followUpCount: "0",
      }),
    },
    {
      number: "CAR-UAT-007",
      ncrType: "QualityCAR",
      description: "Recurring inadequate rebar cover (15mm vs 40mm) footings F-12 to F-18. CAP required in 48h.",
      location: "Footings F-12–F18",
      contractor: CONTRACTOR,
      status: "Open",
      formDataJson: JSON.stringify({
        ...formBase,
        actionRequired: "Submit corrective action plan with photos of spacer installation.",
        followUpCount: "0",
      }),
    },
  ];
  for (const n of rows) {
    const existing = await db.qualityNcr.findFirst({ where: { projectId, number: n.number } });
    if (existing) {
      await db.qualityNcr.update({ where: { id: existing.id }, data: n });
    } else {
      await db.qualityNcr.create({
        data: {
          projectId,
          ...n,
          issueDate: new Date(),
          plannedClosure: new Date(Date.now() + 7 * 86400000),
          source: TAG,
        },
      });
    }
  }
}

async function seedSafetyNcr(db: PrismaClient, projectId: string, reporterId: string) {
  const number = "SNCR-UAT-003";
  const existing = await db.safetyRecord.findFirst({ where: { projectId, ncrNumber: number } });
  const data = {
    projectId,
    recordType: "NCR",
    title: number,
    ncrNumber: number,
    description: "Worker without harness at L3 edge — stop-work until toolbox talk and harness audit.",
    severity: "High",
    status: "Open",
    location: "Block A · L3 slab edge",
    responsibleParty: CONTRACTOR,
    issuedTo: CONTRACTOR,
    correctiveAction: "Toolbox talk + harness inspection log required before resume.",
    targetCompletion: new Date(Date.now() + 3 * 86400000),
    source: TAG,
    reportedById: reporterId,
  };
  if (existing) await db.safetyRecord.update({ where: { id: existing.id }, data });
  else await db.safetyRecord.create({ data });
}

async function seedOpenRfi(db: PrismaClient, projectId: string, userId: string) {
  const number = "RFI-UAT-2026-142";
  let rfi = await db.rfi.findFirst({ where: { projectId, number } });
  if (!rfi) {
    rfi = await db.rfi.create({
      data: {
        projectId,
        number,
        subject: "UGWT waterproofing at plinth junction — AR-104",
        question:
          "Confirm membrane lap at UGWT–plinth junction per GFC AR-104. Contractor proposes alternate cold-joint treatment.",
        rfiKind: "RequestForInformation",
        status: "Open",
        ballInCourt: "Design Consultant",
        createdById: userId,
        dueDate: new Date(Date.now() + 5 * 86400000),
        scheduleImpact: "Potential 3-day delay",
      },
    });
  }
  return rfi;
}

async function linkCrmBidPackage(db: PrismaClient, projectId: string, officeUserId: string) {
  let pkg = await db.crmBidPackage.findFirst({
    where: { OR: [{ projectId }, { status: "Open" }] },
    orderBy: { createdAt: "desc" },
  });
  if (!pkg) {
    pkg = await db.crmBidPackage.create({
      data: {
        projectId,
        title: "UAT Live — Dormitory R2 comparative",
        status: "Open",
        revisionLabel: "R2",
        vendorNamesJson: JSON.stringify(["M/s Bhavna Infra", "M/s Nikhra Infra"]),
        notes: TAG,
      },
    });
  } else if (!pkg.projectId) {
    await db.crmBidPackage.update({ where: { id: pkg.id }, data: { projectId } });
  }

  try {
    const { seedBidPackageR2Boqs } = await import("./crmVendorBoqSeed.js");
    await seedBidPackageR2Boqs(db, pkg.id, officeUserId, { force: true });
    const { syncBidPackageToSharePoint } = await import("./crmBidSharePointSync.js");
    await syncBidPackageToSharePoint(db, pkg.id);
  } catch {
    /* optional */
  }
  return pkg.id;
}

async function seedCommsWalkthrough(db: PrismaClient, projectId: string) {
  try {
    const { seedBpclAllMatrices } = await import("./bpclMatrixSeed.js");
    await seedBpclAllMatrices(projectId, { force: false });
  } catch {
    /* optional */
  }
}

export async function seedUatDemoWalkthrough(db: PrismaClient) {
  const project = await db.project.findUnique({ where: { code: UAT_LIVE_CODE } });
  if (!project) throw new Error(`Project ${UAT_LIVE_CODE} not found — run uatLiveProject seed first`);

  const office =
    (await db.user.findFirst({ where: { email: "operations@spdc.in" } })) ||
    (await db.user.findFirst({ where: { role: "office" } }));
  if (!office) throw new Error("No office user");

  const userIds = await ensureStakeholderUsers(db);
  await assignProjectParties(db, project.id, userIds);
  await seedQualityNcrCar(db, project.id);
  await seedSafetyNcr(db, project.id, office.id);
  const rfi = await seedOpenRfi(db, project.id, office.id);
  const bidPackageId = await linkCrmBidPackage(db, project.id, office.id);
  await seedCommsWalkthrough(db, project.id);

  return {
    projectCode: project.code,
    stakeholders: STAKEHOLDER_VENDORS.length,
    stakeholderLogins: STAKEHOLDER_USERS.map((u) => u.email),
    contractorLogin: CONTRACTOR_EMAIL,
    ncrNumbers: ["NCR-Q-UAT-018", "CAR-UAT-007"],
    safetyNcr: "SNCR-UAT-003",
    rfiNumber: rfi.number,
    bidPackageId,
    stakeholderPortal: "/login/stakeholder",
  };
}

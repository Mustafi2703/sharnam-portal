/**
 * One candidate through the full HRMS path: requisition → posting → resume DB →
 * interviews → offer → join → staff login → appointment + promotion letters + HR policy.
 *
 * Usage: npm run db:seed-hrms-flow
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { portalForRole } from "../packages/shared/src/index.ts";
import { generateHrmsLetter, renderHrPolicyAcknowledgement, hrPersonFolder } from "../apps/api/src/services/hrmsLetter.ts";
import { mockOneDrive } from "../apps/api/src/services/mockOneDrive.ts";

export const HRMS_FLOW = {
  email: "riya.shah@sharnam.demo",
  fullName: "Riya Shah",
  password: process.env.SEED_PASSWORD || "Demo@1234",
  phone: "9876500123",
  requisitionNo: "SPDC/HR/MR/26-FLOW-RIYA",
  offerNo: "SPDC/HR/OF/26-FLOW-RIYA",
  appointmentRef: "SPDC/HR/OL/26-27/FLOW",
  promotionRef: "SPDC/HR/PR/26-27/FLOW",
  empCode: "EMP-RIYASHAH",
} as const;

export async function seedHrmsFlowDemo(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(HRMS_FLOW.password, 10);
  const actor =
    (await prisma.user.findUnique({ where: { email: "office@sharnam.demo" } })) ||
    (await prisma.user.findFirst({ where: { role: { in: ["admin", "office"] } } }));
  if (!actor) {
    throw new Error("Need office@sharnam.demo (or any office/admin user) before seeding the HRMS flow.");
  }

  const staff = await prisma.user.upsert({
    where: { email: HRMS_FLOW.email },
    create: {
      email: HRMS_FLOW.email,
      fullName: HRMS_FLOW.fullName,
      role: "site_employee",
      portal: portalForRole("site_employee"),
      passwordHash,
      isActive: true,
    },
    update: {
      fullName: HRMS_FLOW.fullName,
      role: "site_employee",
      portal: portalForRole("site_employee"),
      passwordHash,
      isActive: true,
    },
  });

  const joinDate = new Date("2026-04-01T00:00:00.000Z");
  const promoDate = new Date("2026-09-01T00:00:00.000Z");
  const oldCtc = 840000;
  const newCtc = 1020000;

  const existingProfile = await prisma.employeeProfile.findUnique({ where: { userId: staff.id } });
  if (existingProfile) {
    await prisma.employeeProfile.update({
      where: { userId: staff.id },
      data: {
        department: "Projects",
        designation: "Senior Site Engineer",
        joinDate,
        personalEmail: HRMS_FLOW.email,
        personalPhone: HRMS_FLOW.phone,
        ctcAnnual: newCtc,
        reportingManagerId: actor.id,
      },
    });
  } else {
    const taken = await prisma.employeeProfile.findUnique({ where: { empCode: HRMS_FLOW.empCode } });
    await prisma.employeeProfile.create({
      data: {
        userId: staff.id,
        empCode: taken ? `EMP-RIYA${String(Date.now()).slice(-4)}` : HRMS_FLOW.empCode,
        department: "Projects",
        designation: "Senior Site Engineer",
        joinDate,
        personalEmail: HRMS_FLOW.email,
        personalPhone: HRMS_FLOW.phone,
        ctcAnnual: newCtc,
        reportingManagerId: actor.id,
      },
    });
  }

  const project =
    (await prisma.project.findFirst({ where: { code: "ARVIND-DORM" } })) ||
    (await prisma.project.findFirst({ where: { code: "SPDC-DEMO-01" } })) ||
    (await prisma.project.findFirst({ orderBy: { createdAt: "asc" } }));
  if (project) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: staff.id } },
      create: { projectId: project.id, userId: staff.id, role: "member" },
      update: {},
    });
  }

  const req = await prisma.manpowerRequisition.upsert({
    where: { requisitionNo: HRMS_FLOW.requisitionNo },
    create: {
      requisitionNo: HRMS_FLOW.requisitionNo,
      department: "Projects",
      designation: "Site Engineer",
      count: 1,
      employmentType: "Permanent",
      reportingManager: actor.fullName,
      justification: "Site engineer for Arvind dormitory execution — HRMS flow demo.",
      urgency: "Normal",
      ctcRangeMin: 700000,
      ctcRangeMax: 900000,
      location: "Ahmedabad",
      requestedById: actor.id,
      approvedById: actor.id,
      approvedAt: new Date("2026-02-10T00:00:00.000Z"),
      status: "Approved",
    },
    update: { status: "Approved" },
  });

  let posting = await prisma.jobPosting.findFirst({
    where: { requisitionId: req.id, title: "Site Engineer — SPDC Projects" },
  });
  if (!posting) {
    posting = await prisma.jobPosting.create({
      data: {
        requisitionId: req.id,
        title: "Site Engineer — SPDC Projects",
        department: "Projects",
        location: "Ahmedabad",
        employmentType: "Permanent",
        description: "PMC site engineer for execution, DPR, and quality coordination.",
        requirements: "Civil BE, 4+ years PMC / contractor site experience.",
        channelsJson: JSON.stringify(["LinkedIn", "Naukri", "Company Website"]),
        postedAt: new Date("2026-02-12T00:00:00.000Z"),
        status: "Open",
        postedById: actor.id,
      },
    });
  }

  let candidate = await prisma.candidate.findFirst({ where: { email: HRMS_FLOW.email } });
  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        postingId: posting.id,
        fullName: HRMS_FLOW.fullName,
        email: HRMS_FLOW.email,
        phone: HRMS_FLOW.phone,
        sourceChannel: "LinkedIn",
        currentCompany: "L&T Construction",
        currentDesign: "Junior Site Engineer",
        currentCtc: 720000,
        expectedCtc: 840000,
        noticePeriodDays: 30,
        experienceYears: 4.5,
        skills: "RCC, shuttering, DPR, quality checklists, AutoCAD",
        location: "Ahmedabad",
        status: "Joined",
        screenedById: actor.id,
        notes: "Seeded HRMS walkthrough candidate — statuses visible on the recruitment register.",
      },
    });
  } else {
    candidate = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        postingId: posting.id,
        fullName: HRMS_FLOW.fullName,
        status: "Joined",
        screenedById: actor.id,
      },
    });
  }

  const techAt = new Date("2026-02-20T10:00:00.000Z");
  const hrAt = new Date("2026-02-24T15:00:00.000Z");
  const existingRounds = await prisma.interviewRound.findMany({ where: { candidateId: candidate.id } });
  if (!existingRounds.length) {
    await prisma.interviewRound.createMany({
      data: [
        {
          candidateId: candidate.id,
          roundNumber: 1,
          roundType: "Technical",
          panelJson: JSON.stringify([actor.fullName]),
          scheduledAt: techAt,
          durationMins: 60,
          mode: "Teams",
          status: "Completed",
          decision: "Advance",
          feedbackTechnical: "Strong RCC and site coordination. Ready for HR round.",
          scoreTechnical: 8,
          scoreCommunication: 7.5,
          scoreCulture: 8,
          scoreOverall: 8,
        },
        {
          candidateId: candidate.id,
          roundNumber: 2,
          roundType: "HR",
          panelJson: JSON.stringify(["HR — SPDC"]),
          scheduledAt: hrAt,
          durationMins: 45,
          mode: "Teams",
          status: "Completed",
          decision: "Advance",
          feedbackHr: "Notice 30 days. CTC discussion aligned.",
          scoreTechnical: 8,
          scoreCommunication: 8,
          scoreCulture: 8.5,
          scoreOverall: 8.2,
        },
      ],
    });
  }

  let offer = await prisma.offer.findUnique({ where: { offerNo: HRMS_FLOW.offerNo } });
  if (!offer) {
    offer = await prisma.offer.create({
      data: {
        candidateId: candidate.id,
        offerNo: HRMS_FLOW.offerNo,
        designation: "Site Engineer",
        department: "Projects",
        ctcAnnual: oldCtc,
        joiningDate: joinDate,
        probationMonths: 6,
        location: "Ahmedabad — Arvind dormitory",
        reportingManager: actor.fullName,
        status: "Joined",
        approvedById: actor.id,
        approvedAt: new Date("2026-03-01T00:00:00.000Z"),
        sentAt: new Date("2026-03-02T00:00:00.000Z"),
        acceptedAt: new Date("2026-03-05T00:00:00.000Z"),
        joinedAt: joinDate,
        notes: "HRMS flow demo offer.",
      },
    });
  } else {
    offer = await prisma.offer.update({
      where: { id: offer.id },
      data: { status: "Joined", candidateId: candidate.id, joinedAt: joinDate, ctcAnnual: oldCtc },
    });
  }

  const preJoin = await prisma.preJoiningChecklist.upsert({
    where: { offerId: offer.id },
    create: {
      offerId: offer.id,
      empCodeGenerated: HRMS_FLOW.empCode,
      docCollectionDone: true,
      docCollectionAt: new Date("2026-03-10T00:00:00.000Z"),
      bgvStatus: "Cleared",
      bgvAt: new Date("2026-03-18T00:00:00.000Z"),
      medicalStatus: "Cleared",
      medicalAt: new Date("2026-03-20T00:00:00.000Z"),
      itAssetRequested: true,
      emailCreated: true,
      emailAddress: HRMS_FLOW.email,
      idCardRequested: true,
      welcomeKitPrepared: true,
    },
    update: {
      empCodeGenerated: HRMS_FLOW.empCode,
      docCollectionDone: true,
      bgvStatus: "Cleared",
      medicalStatus: "Cleared",
      itAssetRequested: true,
      emailCreated: true,
      emailAddress: HRMS_FLOW.email,
      idCardRequested: true,
      welcomeKitPrepared: true,
    },
  });

  const policyHtml = renderHrPolicyAcknowledgement({
    employeeName: HRMS_FLOW.fullName,
    designation: "Site Engineer",
    department: "Projects",
    joinDate: joinDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    acknowledgedAt: joinDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
  });
  const policyFolder = `06_HR_AND_ADMIN/06.02_Employee_Files/${hrPersonFolder(HRMS_FLOW.fullName)}/Onboarding`;
  const policySaved = await mockOneDrive.upload(
    "_HR",
    policyFolder,
    "HR-Policy-Acknowledgement.html",
    Buffer.from(policyHtml, "utf8"),
    "text/html; charset=utf-8",
    { replace: true },
  );

  await prisma.onboardingChecklist.upsert({
    where: { offerId: offer.id },
    create: {
      offerId: offer.id,
      userId: staff.id,
      joiningFormalitiesDone: true,
      personalInfoDone: true,
      bankDetailsDone: true,
      panAadhaarDone: true,
      pfEsicDone: true,
      nomineeDone: true,
      docVerificationDone: true,
      departmentAllocated: true,
      reportingManagerAssigned: true,
      orientationDone: true,
      hrPolicyAcknowledged: true,
      itemsCompletedAtJson: JSON.stringify({
        joiningFormalitiesDone: joinDate.toISOString(),
        hrPolicyAcknowledged: joinDate.toISOString(),
        _hrPolicyUrl: policySaved.sharePointUrl || policySaved.url,
        _hrPolicyFolder: policyFolder,
      }),
    },
    update: {
      userId: staff.id,
      joiningFormalitiesDone: true,
      personalInfoDone: true,
      bankDetailsDone: true,
      panAadhaarDone: true,
      pfEsicDone: true,
      nomineeDone: true,
      docVerificationDone: true,
      departmentAllocated: true,
      reportingManagerAssigned: true,
      orientationDone: true,
      hrPolicyAcknowledged: true,
      itemsCompletedAtJson: JSON.stringify({
        joiningFormalitiesDone: joinDate.toISOString(),
        hrPolicyAcknowledged: joinDate.toISOString(),
        _hrPolicyUrl: policySaved.sharePointUrl || policySaved.url,
        _hrPolicyFolder: policyFolder,
      }),
    },
  });

  async function fileLetter(kind: "Appointment" | "Promotion", refNo: string, extra: Record<string, unknown>) {
    let row = await prisma.hrmsDocument.findUnique({ where: { kind_refNo: { kind, refNo } } });
    const dataJson = JSON.stringify({
      candidateName: HRMS_FLOW.fullName,
      empCode: HRMS_FLOW.empCode,
      location: "Ahmedabad — Arvind dormitory",
      reportingManager: actor.fullName,
      ...extra,
    });
    if (!row) {
      row = await prisma.hrmsDocument.create({
        data: {
          kind,
          refNo,
          employeeUserId: staff.id,
          employeeName: HRMS_FLOW.fullName,
          candidateEmail: HRMS_FLOW.email,
          designation: String(extra.newDesignation || extra.designation || "Site Engineer"),
          department: "Projects",
          effectiveDate: extra.effectiveDate instanceof Date ? extra.effectiveDate : joinDate,
          status: "Draft",
          createdById: actor.id,
          dataJson,
        },
      });
    } else {
      row = await prisma.hrmsDocument.update({
        where: { id: row.id },
        data: {
          employeeUserId: staff.id,
          employeeName: HRMS_FLOW.fullName,
          designation: String(extra.newDesignation || extra.designation || row.designation),
          effectiveDate: extra.effectiveDate instanceof Date ? extra.effectiveDate : row.effectiveDate,
          dataJson,
          status: "Draft",
        },
      });
    }
    const gen = await generateHrmsLetter(row);
    const updated = await prisma.hrmsDocument.update({
      where: { id: row.id },
      data: {
        generatedDocxUrl: gen.docxUrl,
        generatedPdfUrl: gen.pdfUrl,
        storagePath: gen.storagePath,
        sharePointUrl: gen.sharePointUrl,
        status: "Generated",
      },
    });
    const existingDoc = await prisma.employeeDocument.findFirst({
      where: { userId: staff.id, category: kind, title: { contains: refNo } },
    });
    const fileUrl = updated.sharePointUrl || updated.generatedPdfUrl || "";
    if (existingDoc) {
      await prisma.employeeDocument.update({
        where: { id: existingDoc.id },
        data: { fileUrl, storagePath: updated.storagePath, issuedOn: new Date() },
      });
    } else {
      await prisma.employeeDocument.create({
        data: {
          userId: staff.id,
          category: kind,
          title: `${kind} letter · ${HRMS_FLOW.fullName} · ${refNo}`,
          fileUrl,
          storagePath: updated.storagePath,
          issuedOn: extra.effectiveDate instanceof Date ? extra.effectiveDate : joinDate,
        },
      });
    }
    return updated;
  }

  const appointment = await fileLetter("Appointment", HRMS_FLOW.appointmentRef, {
    designation: "Site Engineer",
    joinDate,
    effectiveDate: joinDate,
    fixedCtcAnnual: oldCtc,
    ctcAnnual: oldCtc,
    probationMonths: 6,
  });
  await prisma.preJoiningChecklist.update({
    where: { id: preJoin.id },
    data: { appointmentLetterUrl: appointment.sharePointUrl || appointment.generatedPdfUrl },
  });

  const promotion = await fileLetter("Promotion", HRMS_FLOW.promotionRef, {
    previousDesignation: "Site Engineer",
    newDesignation: "Senior Site Engineer",
    designation: "Senior Site Engineer",
    previousCtc: oldCtc,
    newCtc,
    fixedCtcAnnual: newCtc,
    ctcAnnual: newCtc,
    effectiveDate: promoDate,
    joinDate: promoDate,
  });

  const policyDoc = await prisma.employeeDocument.findFirst({
    where: { userId: staff.id, title: "HR Policy Acknowledgement" },
  });
  if (!policyDoc) {
    await prisma.employeeDocument.create({
      data: {
        userId: staff.id,
        category: "Other",
        title: "HR Policy Acknowledgement",
        fileUrl: policySaved.sharePointUrl || policySaved.url,
        storagePath: policySaved.sharePointPath || policySaved.path,
        issuedOn: joinDate,
      },
    });
  }

  return {
    user: { email: staff.email, fullName: staff.fullName, id: staff.id },
    candidateId: candidate.id,
    offerId: offer.id,
    appointmentRef: appointment.refNo,
    promotionRef: promotion.refNo,
    folder: `06.02 Employee Files / ${hrPersonFolder(HRMS_FLOW.fullName)}`,
    projectCode: project?.code || null,
  };
}

applyDatabaseUrl();

const runningDirect = process.argv[1]?.includes("hrmsFlowDemo");
if (runningDirect) {
  const prisma = new PrismaClient();
  seedHrmsFlowDemo(prisma)
    .then((r) => {
      console.log("HRMS flow seeded:");
      console.log("  Staff login:", r.user.email, "/", HRMS_FLOW.password, "(site desk)");
      console.log("  HR login:    office@sharnam.demo /", HRMS_FLOW.password);
      console.log("  Candidate:  ", r.user.fullName, "→ Joined  offer", HRMS_FLOW.offerNo);
      console.log("  Letters:    ", r.appointmentRef, "+", r.promotionRef);
      console.log("  Drive:      ", r.folder);
      if (r.projectCode) console.log("  Project:    ", r.projectCode);
      console.log("Open /login/hr then Recruitment → Candidates, Onboarding, Letters.");
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

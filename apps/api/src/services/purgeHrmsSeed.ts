import type { Prisma, PrismaClient } from "@prisma/client";
import { isHiddenPortalListUser, isKeptPortalEmail } from "./keepPortalUsers.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type PurgeHrmsSeedResult = {
  loginsRemoved: number;
  loginEmails: string[];
  leaveRequests: number;
  hrmsDocuments: number;
  candidates: number;
  offers: number;
  requisitions: number;
  postings: number;
  projectMembers: number;
};

const DEMO_CANDIDATE_EMAILS = ["riya.shah@sharnam.demo", "uat.onboard.test@spdc.in"] as const;

/** Remove HRMS demo/UAT seed rows while keeping @spdc.in production staff. */
export async function purgeHrmsSeedData(tx: Db, actorUserId?: string): Promise<PurgeHrmsSeedResult> {
  const result: PurgeHrmsSeedResult = {
    loginsRemoved: 0,
    loginEmails: [],
    leaveRequests: 0,
    hrmsDocuments: 0,
    candidates: 0,
    offers: 0,
    requisitions: 0,
    postings: 0,
    projectMembers: 0,
  };

  const leave = await tx.leaveRequest.deleteMany({
    where: { OR: [{ reason: { contains: "hrms-demo-seed" } }, { reason: { contains: "HRMS flow demo" } }] },
  });
  result.leaveRequests = leave.count;

  const docs = await tx.hrmsDocument.deleteMany({
    where: {
      OR: [
        { refNo: { startsWith: "HB-DEMO" } },
        { refNo: { contains: "FLOW" } },
        { dataJson: { contains: "hrms-demo-seed" } },
        { dataJson: { contains: "HRMS flow demo" } },
        { employeeName: "Demo Employee" },
      ],
    },
  });
  result.hrmsDocuments = docs.count;

  const reqRows = await tx.manpowerRequisition.findMany({
    where: {
      OR: [
        { requisitionNo: { contains: "FLOW" } },
        { justification: { contains: "HRMS flow demo" } },
        { justification: { contains: "hrms-demo-seed" } },
      ],
    },
    select: { id: true },
  });
  if (reqRows.length) {
    const reqIds = reqRows.map((r) => r.id);
    const postings = await tx.jobPosting.deleteMany({ where: { requisitionId: { in: reqIds } } });
    result.postings = postings.count;
    const reqs = await tx.manpowerRequisition.deleteMany({ where: { id: { in: reqIds } } });
    result.requisitions = reqs.count;
  }

  const demoCandidates = await tx.candidate.findMany({
    where: {
      OR: [
        { email: { in: [...DEMO_CANDIDATE_EMAILS] } },
        { email: { endsWith: "@sharnam.demo" } },
        { notes: { contains: "HRMS flow demo" } },
        { notes: { contains: "Seeded HRMS" } },
        { fullName: { contains: "UAT Onboard Test" } },
      ],
    },
    select: { id: true },
  });
  if (demoCandidates.length) {
    const candidateIds = demoCandidates.map((c) => c.id);
    const offers = await tx.offer.findMany({ where: { candidateId: { in: candidateIds } }, select: { id: true } });
    const offerIds = offers.map((o) => o.id);
    if (offerIds.length) {
      await tx.onboardingChecklist.deleteMany({ where: { offerId: { in: offerIds } } });
      await tx.preJoiningChecklist.deleteMany({ where: { offerId: { in: offerIds } } });
      const deletedOffers = await tx.offer.deleteMany({ where: { id: { in: offerIds } } });
      result.offers = deletedOffers.count;
    }
    await tx.interviewRound.deleteMany({ where: { candidateId: { in: candidateIds } } });
    const deletedCandidates = await tx.candidate.deleteMany({ where: { id: { in: candidateIds } } });
    result.candidates = deletedCandidates.count;
  }

  const active = await tx.user.findMany({
    where: { isActive: true, NOT: { email: { startsWith: "deleted." } } },
    select: { id: true, email: true, fullName: true },
  });
  const loginTargets = active.filter((u) => isHiddenPortalListUser(u.email) && !isKeptPortalEmail(u.email));
  if (loginTargets.length) {
    const stamp = Date.now();
    for (const u of loginTargets) {
      if (actorUserId && u.id === actorUserId) continue;
      const retiredEmail = `deleted.${stamp}.${u.email.replace("@", "_at_")}`.slice(0, 180);
      const members = await tx.projectMember.deleteMany({ where: { userId: u.id } });
      result.projectMembers += members.count;
      await tx.employeeProfile.deleteMany({ where: { userId: u.id } });
      await tx.user.update({
        where: { id: u.id },
        data: {
          isActive: false,
          email: retiredEmail,
          fullName: `[Removed] ${u.fullName}`.slice(0, 200),
          vendorId: null,
        },
      });
      result.loginsRemoved++;
      result.loginEmails.push(u.email);
    }
  }

  return result;
}

/**
 * HRMS — Recruitment, Pre-joining, Onboarding, Pay Hike, Payslip.
 * Every mutation is written to AuditEvent so we get a per-employee timeline for free.
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";

export const hrmRecruitmentRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
hrmRecruitmentRouter.use(requireAuth);

const HR_ISO_FOLDER = "03_SUPPORT_AND_RESOURCES/03.01_Competence_and_Training";
const HR_STATUTORY_FOLDER = "06_STATUTORY_AND_LAND/06.03_Labour_and_Statutory_Compliance";

function n(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}
function s(v: unknown): string | null {
  return v === undefined || v === null || v === "" ? null : String(v);
}
function extOf(f: Express.Multer.File): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(f.originalname || "");
  return m ? `.${m[1].toLowerCase()}` : "";
}

/* ═════════════════════════════════════  MANPOWER REQUISITION  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/requisitions", async (_req, res) => {
  const rows = await prisma.manpowerRequisition.findMany({
    orderBy: { createdAt: "desc" },
    include: { postings: { select: { id: true, title: true, status: true } } },
  });
  res.json(rows);
});

hrmRecruitmentRouter.post("/requisitions", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const row = await prisma.manpowerRequisition.create({
    data: {
      requisitionNo: s(req.body.requisitionNo) || `MR-${Date.now()}`,
      department: s(req.body.department) || "General",
      designation: s(req.body.designation) || "Executive",
      count: Number(req.body.count || 1),
      employmentType: s(req.body.employmentType) || "Permanent",
      reportingManager: s(req.body.reportingManager),
      justification: s(req.body.justification),
      urgency: s(req.body.urgency) || "Normal",
      ctcRangeMin: n(req.body.ctcRangeMin),
      ctcRangeMax: n(req.body.ctcRangeMax),
      location: s(req.body.location),
      requestedById: req.user!.id,
      status: "Submitted",
    },
  });
  await audit("hrms.requisition.create", { userId: req.user!.id, entity: "ManpowerRequisition", entityId: row.id, meta: { department: row.department, designation: row.designation, count: row.count } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/requisitions/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.manpowerRequisition.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = s(req.body.status) || before.status;
  const isApproving = before.status !== "Approved" && nextStatus === "Approved";
  const isRejecting = before.status !== "Rejected" && nextStatus === "Rejected";
  const row = await prisma.manpowerRequisition.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      rejectionReason: s(req.body.rejectionReason) || before.rejectionReason,
      approvedById: isApproving ? req.user!.id : before.approvedById,
      approvedAt: isApproving ? new Date() : before.approvedAt,
    },
  });
  await audit(
    isApproving ? "hrms.requisition.approve" : isRejecting ? "hrms.requisition.reject" : "hrms.requisition.update",
    { userId: req.user!.id, entity: "ManpowerRequisition", entityId: row.id, meta: { from: before.status, to: nextStatus } }
  );
  res.json(row);
});

/* ═════════════════════════════════════  JOB POSTING  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/postings", async (_req, res) => {
  const rows = await prisma.jobPosting.findMany({
    include: { requisition: { select: { requisitionNo: true, status: true } }, _count: { select: { candidates: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRecruitmentRouter.post("/postings", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const channels = Array.isArray(req.body.channels) ? req.body.channels : req.body.channels ? String(req.body.channels).split(",").map((c: string) => c.trim()) : [];
  const row = await prisma.jobPosting.create({
    data: {
      requisitionId: s(req.body.requisitionId),
      title: s(req.body.title) || "Position",
      department: s(req.body.department),
      location: s(req.body.location),
      employmentType: s(req.body.employmentType) || "Permanent",
      description: s(req.body.description),
      requirements: s(req.body.requirements),
      channelsJson: JSON.stringify(channels),
      status: "Open",
      postedAt: new Date(),
      postedById: req.user!.id,
    },
  });
  await audit("hrms.posting.create", { userId: req.user!.id, entity: "JobPosting", entityId: row.id, meta: { title: row.title, channels } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/postings/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.jobPosting.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const channels = Array.isArray(req.body.channels) ? req.body.channels : undefined;
  const row = await prisma.jobPosting.update({
    where: { id: req.params.id },
    data: {
      title: s(req.body.title) || before.title,
      status: s(req.body.status) || before.status,
      description: s(req.body.description) ?? before.description,
      requirements: s(req.body.requirements) ?? before.requirements,
      channelsJson: channels ? JSON.stringify(channels) : before.channelsJson,
      closedAt: req.body.status === "Closed" ? new Date() : before.closedAt,
    },
  });
  await audit("hrms.posting.update", { userId: req.user!.id, entity: "JobPosting", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  CANDIDATES (Resume DB)  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/candidates", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const postingId = req.query.postingId ? String(req.query.postingId) : undefined;
  const search = req.query.q ? String(req.query.q).toLowerCase() : undefined;
  const rows = await prisma.candidate.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(postingId ? { postingId } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { skills: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      posting: { select: { title: true, department: true } },
      interviews: { select: { id: true, roundNumber: true, roundType: true, status: true, decision: true } },
      offers: { select: { id: true, offerNo: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRecruitmentRouter.post("/candidates", requireRoles("admin", "office"), upload.single("resume"), async (req: AuthedRequest, res) => {
  let resumeUrl: string | undefined;
  if (req.file) {
    const saved = await mockOneDrive.upload(
      "GLOBAL",
      HR_ISO_FOLDER,
      `resume-${s(req.body.fullName)?.replace(/[^a-zA-Z0-9._-]/g, "_") || "candidate"}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    resumeUrl = saved.url || `/uploads/onedrive/GLOBAL/${saved.path}`;
  }
  const row = await prisma.candidate.create({
    data: {
      postingId: s(req.body.postingId),
      fullName: s(req.body.fullName) || "Candidate",
      email: s(req.body.email),
      phone: s(req.body.phone),
      sourceChannel: s(req.body.sourceChannel),
      resumeUrl,
      currentCompany: s(req.body.currentCompany),
      currentDesign: s(req.body.currentDesign),
      currentCtc: n(req.body.currentCtc),
      expectedCtc: n(req.body.expectedCtc),
      noticePeriodDays: req.body.noticePeriodDays ? Number(req.body.noticePeriodDays) : null,
      experienceYears: n(req.body.experienceYears),
      skills: s(req.body.skills),
      location: s(req.body.location),
      status: "New",
    },
  });
  await audit("hrms.candidate.create", { userId: req.user!.id, entity: "Candidate", entityId: row.id, meta: { fullName: row.fullName, source: row.sourceChannel } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/candidates/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = s(req.body.status) || before.status;
  const row = await prisma.candidate.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      screenedById: nextStatus === "Screened" ? req.user!.id : before.screenedById,
      rejectionReason: s(req.body.rejectionReason) || before.rejectionReason,
      notes: s(req.body.notes) ?? before.notes,
      currentCtc: n(req.body.currentCtc) ?? before.currentCtc,
      expectedCtc: n(req.body.expectedCtc) ?? before.expectedCtc,
      noticePeriodDays: req.body.noticePeriodDays !== undefined ? Number(req.body.noticePeriodDays) || null : before.noticePeriodDays,
    },
  });
  await audit("hrms.candidate.status", { userId: req.user!.id, entity: "Candidate", entityId: row.id, meta: { from: before.status, to: nextStatus } });
  res.json(row);
});

/* ═════════════════════════════════════  INTERVIEW ROUNDS  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/candidates/:id/interviews", async (req, res) => {
  const rows = await prisma.interviewRound.findMany({
    where: { candidateId: req.params.id },
    orderBy: { roundNumber: "asc" },
  });
  res.json(rows);
});

hrmRecruitmentRouter.post("/candidates/:id/interviews", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!candidate) return res.status(404).json({ error: "not found" });
  const priorRounds = await prisma.interviewRound.count({ where: { candidateId: candidate.id } });
  const panel = Array.isArray(req.body.panel) ? req.body.panel : req.body.panel ? [req.body.panel] : [];
  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
  const mode = s(req.body.mode) || "Teams";

  // Teams meeting link: use provided one, or generate a deep-link stub (real link comes from Graph once Mail.Send + Calendars.ReadWrite are granted).
  let meetingLink = s(req.body.meetingLink);
  let meetingId = s(req.body.meetingId);
  if (!meetingLink && mode === "Teams" && scheduledAt) {
    meetingId = `sharnam-${candidate.id.slice(0, 8)}-r${priorRounds + 1}-${scheduledAt.getTime()}`;
    meetingLink = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${meetingId}%40thread.v2/0`;
  }

  const row = await prisma.interviewRound.create({
    data: {
      candidateId: candidate.id,
      roundNumber: Number(req.body.roundNumber) || priorRounds + 1,
      roundType: s(req.body.roundType) || "Technical",
      panelJson: JSON.stringify(panel),
      scheduledAt,
      durationMins: Number(req.body.durationMins) || 60,
      mode,
      meetingLink,
      meetingId,
      status: "Scheduled",
    },
  });
  await prisma.candidate.update({ where: { id: candidate.id }, data: { status: "Interview" } });
  await audit("hrms.interview.schedule", { userId: req.user!.id, entity: "InterviewRound", entityId: row.id, meta: { candidateId: candidate.id, roundNumber: row.roundNumber, mode } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/interviews/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.interviewRound.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const row = await prisma.interviewRound.update({
    where: { id: req.params.id },
    data: {
      status: s(req.body.status) || before.status,
      decision: s(req.body.decision) ?? before.decision,
      feedbackTechnical: s(req.body.feedbackTechnical) ?? before.feedbackTechnical,
      feedbackHr: s(req.body.feedbackHr) ?? before.feedbackHr,
      feedbackMgmt: s(req.body.feedbackMgmt) ?? before.feedbackMgmt,
      scoreTechnical: n(req.body.scoreTechnical) ?? before.scoreTechnical,
      scoreCommunication: n(req.body.scoreCommunication) ?? before.scoreCommunication,
      scoreCulture: n(req.body.scoreCulture) ?? before.scoreCulture,
      scoreOverall: n(req.body.scoreOverall) ?? before.scoreOverall,
    },
  });

  // Auto-advance candidate to "Selected" if the last decision advance
  if (row.decision === "Advance") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Shortlisted" } });
  } else if (row.decision === "Reject") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Rejected" } });
  }

  await audit("hrms.interview.feedback", { userId: req.user!.id, entity: "InterviewRound", entityId: row.id, meta: { decision: row.decision, score: row.scoreOverall } });
  res.json(row);
});

/* ═════════════════════════════════════  OFFER LETTER  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/offers", async (_req, res) => {
  const rows = await prisma.offer.findMany({
    include: { candidate: { select: { fullName: true, email: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

hrmRecruitmentRouter.get("/offers/:id", async (req, res) => {
  const row = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, preJoin: true, onboard: true },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

hrmRecruitmentRouter.post("/offers", requireRoles("admin", "office"), upload.single("letter"), async (req: AuthedRequest, res) => {
  const candidateId = String(req.body.candidateId);
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return res.status(400).json({ error: "candidateId required / not found" });

  let offerLetterUrl: string | undefined;
  if (req.file) {
    const saved = await mockOneDrive.upload(
      "GLOBAL",
      HR_STATUTORY_FOLDER,
      `offer-${candidate.fullName.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    offerLetterUrl = saved.url || `/uploads/onedrive/GLOBAL/${saved.path}`;
  }

  const row = await prisma.offer.create({
    data: {
      candidateId,
      offerNo: s(req.body.offerNo) || `OFR-${Date.now()}`,
      designation: s(req.body.designation) || "Executive",
      department: s(req.body.department),
      ctcAnnual: Number(req.body.ctcAnnual || 0),
      basicMonthly: n(req.body.basicMonthly),
      hraMonthly: n(req.body.hraMonthly),
      otherAllowMonthly: n(req.body.otherAllowMonthly),
      variablePayPct: n(req.body.variablePayPct),
      joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : null,
      probationMonths: req.body.probationMonths !== undefined ? Number(req.body.probationMonths) : 6,
      location: s(req.body.location),
      reportingManager: s(req.body.reportingManager),
      offerLetterUrl,
      notes: s(req.body.notes),
      status: "Draft",
    },
  });
  await prisma.candidate.update({ where: { id: candidateId }, data: { status: "Selected" } });
  await audit("hrms.offer.create", { userId: req.user!.id, entity: "Offer", entityId: row.id, meta: { candidateId, offerNo: row.offerNo, ctc: row.ctcAnnual } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/offers/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = s(req.body.status) || before.status;
  const isApproving = before.status !== "Approved" && nextStatus === "Approved";
  const row = await prisma.offer.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      approvedById: isApproving ? req.user!.id : before.approvedById,
      approvedAt: isApproving ? new Date() : before.approvedAt,
      sentAt: nextStatus === "Sent" ? new Date() : before.sentAt,
      acceptedAt: nextStatus === "Accepted" ? new Date() : before.acceptedAt,
      declinedAt: nextStatus === "Declined" ? new Date() : before.declinedAt,
      joinedAt: nextStatus === "Joined" ? new Date() : before.joinedAt,
      notes: s(req.body.notes) ?? before.notes,
    },
  });

  if (nextStatus === "Accepted") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Offered" } });
    await prisma.preJoiningChecklist.upsert({
      where: { offerId: row.id },
      create: { offerId: row.id },
      update: {},
    });
  }
  if (nextStatus === "Joined") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Joined" } });
    await prisma.onboardingChecklist.upsert({
      where: { offerId: row.id },
      create: { offerId: row.id },
      update: {},
    });
  }

  await audit(isApproving ? "hrms.offer.approve" : `hrms.offer.${nextStatus.toLowerCase()}`, { userId: req.user!.id, entity: "Offer", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  PRE-JOINING  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/pre-joining/:offerId", async (req, res) => {
  const row = await prisma.preJoiningChecklist.findUnique({
    where: { offerId: req.params.offerId },
    include: { offer: { include: { candidate: true } } },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

hrmRecruitmentRouter.patch("/pre-joining/:offerId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.preJoiningChecklist.upsert({
    where: { offerId: req.params.offerId },
    create: { offerId: req.params.offerId },
    update: {},
  });
  const row = await prisma.preJoiningChecklist.update({
    where: { id: existing.id },
    data: {
      empCodeGenerated: s(req.body.empCodeGenerated) ?? existing.empCodeGenerated,
      appointmentLetterUrl: s(req.body.appointmentLetterUrl) ?? existing.appointmentLetterUrl,
      docCollectionDone: req.body.docCollectionDone !== undefined ? !!req.body.docCollectionDone : existing.docCollectionDone,
      docCollectionAt: req.body.docCollectionDone && !existing.docCollectionAt ? new Date() : existing.docCollectionAt,
      bgvStatus: s(req.body.bgvStatus) ?? existing.bgvStatus,
      bgvAt: req.body.bgvStatus === "Cleared" && !existing.bgvAt ? new Date() : existing.bgvAt,
      medicalStatus: s(req.body.medicalStatus) ?? existing.medicalStatus,
      medicalAt: req.body.medicalStatus === "Cleared" && !existing.medicalAt ? new Date() : existing.medicalAt,
      itAssetRequested: req.body.itAssetRequested !== undefined ? !!req.body.itAssetRequested : existing.itAssetRequested,
      itAssetIssuedAt: req.body.itAssetIssued && !existing.itAssetIssuedAt ? new Date() : existing.itAssetIssuedAt,
      itAssetDetails: s(req.body.itAssetDetails) ?? existing.itAssetDetails,
      emailCreated: req.body.emailCreated !== undefined ? !!req.body.emailCreated : existing.emailCreated,
      emailCreatedAt: req.body.emailCreated && !existing.emailCreatedAt ? new Date() : existing.emailCreatedAt,
      emailAddress: s(req.body.emailAddress) ?? existing.emailAddress,
      idCardRequested: req.body.idCardRequested !== undefined ? !!req.body.idCardRequested : existing.idCardRequested,
      idCardIssuedAt: req.body.idCardIssued && !existing.idCardIssuedAt ? new Date() : existing.idCardIssuedAt,
      welcomeKitPrepared: req.body.welcomeKitPrepared !== undefined ? !!req.body.welcomeKitPrepared : existing.welcomeKitPrepared,
      welcomeKitAt: req.body.welcomeKitPrepared && !existing.welcomeKitAt ? new Date() : existing.welcomeKitAt,
      notes: s(req.body.notes) ?? existing.notes,
    },
  });
  await audit("hrms.preJoining.update", { userId: req.user!.id, entity: "PreJoiningChecklist", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  ONBOARDING  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/onboarding/:offerId", async (req, res) => {
  const row = await prisma.onboardingChecklist.findUnique({
    where: { offerId: req.params.offerId },
    include: { offer: { include: { candidate: true } } },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json({ ...row, itemsCompletedAt: JSON.parse(row.itemsCompletedAtJson || "{}") });
});

hrmRecruitmentRouter.patch("/onboarding/:offerId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.onboardingChecklist.upsert({
    where: { offerId: req.params.offerId },
    create: { offerId: req.params.offerId },
    update: {},
  });
  const stamps = JSON.parse(existing.itemsCompletedAtJson || "{}") as Record<string, string>;
  const now = new Date().toISOString();
  const bools = [
    "joiningFormalitiesDone",
    "personalInfoDone",
    "bankDetailsDone",
    "panAadhaarDone",
    "pfEsicDone",
    "nomineeDone",
    "docVerificationDone",
    "departmentAllocated",
    "reportingManagerAssigned",
    "orientationDone",
    "hrPolicyAcknowledged",
  ] as const;
  const patch: Record<string, unknown> = { notes: s(req.body.notes) ?? existing.notes, userId: s(req.body.userId) ?? existing.userId };
  for (const key of bools) {
    if (req.body[key] === undefined) continue;
    const val = !!req.body[key];
    patch[key] = val;
    if (val && !stamps[key]) stamps[key] = now;
    if (!val) delete stamps[key];
  }
  patch.itemsCompletedAtJson = JSON.stringify(stamps);
  const row = await prisma.onboardingChecklist.update({ where: { id: existing.id }, data: patch });
  await audit("hrms.onboarding.update", { userId: req.user!.id, entity: "OnboardingChecklist", entityId: row.id });
  res.json({ ...row, itemsCompletedAt: stamps });
});

/* ═════════════════════════════════════  PAY HIKE  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/pay-hikes", async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const rows = await prisma.payHike.findMany({
    where: userId ? { userId } : {},
    orderBy: { effectiveDate: "desc" },
  });
  res.json(rows);
});

hrmRecruitmentRouter.post("/pay-hikes", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const oldCtc = Number(req.body.oldCtcAnnual || 0);
  const newCtc = Number(req.body.newCtcAnnual || 0);
  const hikePercent = oldCtc > 0 ? ((newCtc - oldCtc) / oldCtc) * 100 : 0;
  const row = await prisma.payHike.create({
    data: {
      userId: String(req.body.userId),
      effectiveDate: new Date(req.body.effectiveDate || Date.now()),
      oldCtcAnnual: oldCtc,
      newCtcAnnual: newCtc,
      hikePercent,
      oldBasicMonthly: n(req.body.oldBasicMonthly),
      newBasicMonthly: n(req.body.newBasicMonthly),
      oldHraMonthly: n(req.body.oldHraMonthly),
      newHraMonthly: n(req.body.newHraMonthly),
      reason: s(req.body.reason),
      performanceRating: s(req.body.performanceRating),
      status: "Submitted",
    },
  });
  await audit("hrms.payHike.submit", { userId: req.user!.id, entity: "PayHike", entityId: row.id, meta: { targetUserId: row.userId, oldCtc, newCtc, hikePercent } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/pay-hikes/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.payHike.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = s(req.body.status) || before.status;
  const isApproving = before.status !== "Approved" && nextStatus === "Approved";
  const row = await prisma.payHike.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      approvedById: isApproving ? req.user!.id : before.approvedById,
      approvedAt: isApproving ? new Date() : before.approvedAt,
      notes: s(req.body.notes) ?? before.notes,
    },
  });

  if (nextStatus === "Applied" && before.status !== "Applied") {
    await prisma.employeeProfile.updateMany({
      where: { userId: row.userId },
      data: {
        ctcAnnual: row.newCtcAnnual,
        basicMonthly: row.newBasicMonthly || undefined,
        hraMonthly: row.newHraMonthly || undefined,
      },
    });
  }

  await audit(isApproving ? "hrms.payHike.approve" : `hrms.payHike.${nextStatus.toLowerCase()}`, { userId: req.user!.id, entity: "PayHike", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  PAYSLIP  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/payslips", async (req: AuthedRequest, res) => {
  const isAdmin = ["admin", "office"].includes(req.user!.role);
  const filters: Record<string, unknown> = {};
  if (req.query.year) filters.year = Number(req.query.year);
  if (req.query.month) filters.month = Number(req.query.month);
  if (!isAdmin || req.query.userId) filters.userId = String(req.query.userId || req.user!.id);
  const rows = await prisma.payslip.findMany({ where: filters, orderBy: [{ year: "desc" }, { month: "desc" }] });
  res.json(rows);
});

/**
 * Generate payslip from EmployeeProfile CTC breakdown + paid-days.
 * Simple compute: monthly earnings from profile; deductions computed from statutory %.
 * Client can override any value on the returned draft before finalising.
 */
hrmRecruitmentRouter.post("/payslips/generate", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const userId = String(req.body.userId);
  const year = Number(req.body.year);
  const month = Number(req.body.month);
  const workingDays = Number(req.body.workingDays || 30);
  const lopDays = Number(req.body.lopDays || 0);
  const paidDays = Math.max(0, workingDays - lopDays);
  const factor = workingDays > 0 ? paidDays / workingDays : 1;

  const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
  if (!profile) return res.status(404).json({ error: "employee profile not found" });

  const basic = (profile.basicMonthly || (profile.ctcAnnual ? profile.ctcAnnual * 0.5 / 12 : 0)) * factor;
  const hra = (profile.hraMonthly || basic * 0.5) * factor;
  const conveyance = 1600 * factor;
  const medicalAllow = 1250 * factor;
  const specialAllow = Math.max(0, (profile.ctcAnnual ? profile.ctcAnnual / 12 : 0) * factor - basic - hra - conveyance - medicalAllow);
  const gross = basic + hra + conveyance + medicalAllow + specialAllow;
  const pfEmployee = Math.min(basic, 15000) * 0.12;
  const esicEmployee = gross <= 21000 ? gross * 0.0075 : 0;
  const professionalTax = 200;
  const incomeTax = Number(req.body.incomeTax || 0);
  const totalDeductions = pfEmployee + esicEmployee + professionalTax + incomeTax;
  const netPay = gross - totalDeductions;

  const row = await prisma.payslip.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      workingDays,
      paidDays,
      lopDays,
      basic,
      hra,
      conveyance,
      medicalAllow,
      specialAllow,
      grossEarnings: gross,
      pfEmployee,
      esicEmployee,
      professionalTax,
      incomeTax,
      totalDeductions,
      netPay,
      status: "Generated",
      generatedById: req.user!.id,
    },
    update: {
      workingDays,
      paidDays,
      lopDays,
      basic,
      hra,
      conveyance,
      medicalAllow,
      specialAllow,
      grossEarnings: gross,
      pfEmployee,
      esicEmployee,
      professionalTax,
      incomeTax,
      totalDeductions,
      netPay,
      status: "Generated",
      generatedById: req.user!.id,
      generatedAt: new Date(),
    },
  });
  await audit("hrms.payslip.generate", { userId: req.user!.id, entity: "Payslip", entityId: row.id, meta: { userId, year, month, netPay: row.netPay } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/payslips/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const before = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const overrides: Record<string, number> = {};
  for (const key of ["basic", "hra", "conveyance", "medicalAllow", "specialAllow", "otherEarnings", "pfEmployee", "esicEmployee", "professionalTax", "incomeTax", "otherDeduction"] as const) {
    if (req.body[key] !== undefined) overrides[key] = Number(req.body[key]);
  }
  const merged = { ...before, ...overrides };
  const gross = merged.basic + merged.hra + merged.conveyance + merged.medicalAllow + merged.specialAllow + merged.otherEarnings;
  const deductions = merged.pfEmployee + merged.esicEmployee + merged.professionalTax + merged.incomeTax + merged.otherDeduction;
  const row = await prisma.payslip.update({
    where: { id: req.params.id },
    data: {
      ...overrides,
      grossEarnings: gross,
      totalDeductions: deductions,
      netPay: gross - deductions,
      status: s(req.body.status) || before.status,
    },
  });
  await audit("hrms.payslip.update", { userId: req.user!.id, entity: "Payslip", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  EMPLOYEE AUDIT LOG  ═════════════════════════════════════ */

/**
 * Timeline of every HRMS + portal action tied to an employee.
 */
hrmRecruitmentRouter.get("/employees/:userId/timeline", async (req, res) => {
  const userId = req.params.userId;
  const [own, related] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditEvent.findMany({
      where: { entity: "User", entityId: userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const merged = [...own, ...related]
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(merged);
});

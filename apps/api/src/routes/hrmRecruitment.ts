/**
 * HRMS — Recruitment, Pre-joining, Onboarding, Pay Hike, Payslip.
 * Every mutation is written to AuditEvent so we get a per-employee timeline for free.
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { errorDetail, pushRuntimeLog } from "../services/runtimeLog.js";
import { createTeamsSchedule, downloadDriveFile, driveItemWebUrl, listDriveFiles, moveDriveItem, SHAREPOINT_SANDBOX_ROOT, uploadToProjectLibrary } from "../services/graph.js";
import { mimeForFileName, mockOneDrive } from "../services/mockOneDrive.js";
import { designationRow, isSpdcHiringRole, scorecardRoleForDesignation } from "@sharnam/shared";
import { INTERVIEW_PARAMS, INTERVIEW_ROLES, ROUND_FOCUS, ROUND_NOTE, scorecardRoundId, scorecardWorkbook, scoreInterviewRound } from "../services/interviewScorecard.js";
import {
  candidateRecruitmentFolder,
  employeeLetterFolder,
  HR_DRIVE,
  kycFolder,
  payslipRecordFolder,
} from "../services/spdcLibraryFolders.js";
import {
  computeCtcBreakdown,
  ctcMonthlyEarnings,
  buildAnnexureHtml,
  buildAnnexureXlsx,
  DEFAULT_CTC_INPUTS,
  type CtcInputs,
} from "../services/ctcAnnexure.js";

export const hrmRecruitmentRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
hrmRecruitmentRouter.use(requireAuth);

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

async function safeHrmList<T>(label: string, fn: () => Promise<T[]>, res: import("express").Response) {
  try {
    res.json(await fn());
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.list",
      message: `${label} failed`,
      detail: errorDetail(err),
    });
    res.status(500).json({ error: `Could not load ${label}` });
  }
}

/** Payslip and hike rows store only userId. Attach the staff name so the register does not depend on a filtered employee list. */
async function attachStaffNames<T extends { userId: string }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  if (!ids.length) return rows.map((r) => ({ ...r, staffName: "", empCode: "" }));
  const [users, profiles] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } }),
    prisma.employeeProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, empCode: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  const codes = new Map(profiles.map((p) => [p.userId, p.empCode || ""]));
  return rows.map((r) => ({
    ...r,
    staffName: names.get(r.userId) || "",
    empCode: codes.get(r.userId) || "",
  }));
}

/* ═════════════════════════════════════  MANPOWER REQUISITION  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/requisitions", async (_req, res) => {
  await safeHrmList("requisitions", () =>
    prisma.manpowerRequisition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        postings: { select: { id: true, title: true, status: true } },
        _count: { select: { candidates: true } },
      },
    }),
    res
  );
});

/** A requisition's role must be an open role in the HRMS roles master under the chosen department (built-in list for older rows). */
async function pickDesignation(title: string | null, department: string | null): Promise<{ title: string; department: string } | null> {
  if (!title || !department) return null;
  const row = await prisma.hrmDesignation.findFirst({ where: { title, isActive: true } }).catch(() => null);
  if (row) return row.department === department ? { title: row.title, department: row.department } : null;
  const legacy = designationRow(title);
  return legacy && legacy.department === department ? { title: legacy.title, department: legacy.department } : null;
}

hrmRecruitmentRouter.post("/requisitions", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const picked = await pickDesignation(s(req.body.designation), s(req.body.department));
  if (!picked) {
    return res.status(400).json({ error: "Choose a department and one of its designations." });
  }
  const row = await prisma.manpowerRequisition.create({
    data: {
      requisitionNo: s(req.body.requisitionNo) || `MR-${Date.now()}`,
      department: picked.department,
      designation: picked.title,
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

hrmRecruitmentRouter.patch("/requisitions/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.manpowerRequisition.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextStatus = s(req.body.status) || before.status;
  const isApproving = before.status !== "Approved" && nextStatus === "Approved";
  const isRejecting = before.status !== "Rejected" && nextStatus === "Rejected";
  const nextDesignation = s(req.body.designation) || before.designation;
  const nextDepartment = s(req.body.department) || before.department;
  if (req.body.designation !== undefined || req.body.department !== undefined) {
    const picked = await pickDesignation(nextDesignation, nextDepartment);
    if (!picked) {
      return res.status(400).json({ error: "Choose a department and one of its designations." });
    }
  }
  const row = await prisma.manpowerRequisition.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      department: nextDepartment,
      designation: nextDesignation,
      count: req.body.count !== undefined ? Number(req.body.count) || before.count : before.count,
      employmentType: s(req.body.employmentType) || before.employmentType,
      reportingManager: req.body.reportingManager !== undefined ? s(req.body.reportingManager) : before.reportingManager,
      justification: req.body.justification !== undefined ? s(req.body.justification) : before.justification,
      urgency: s(req.body.urgency) || before.urgency,
      location: req.body.location !== undefined ? s(req.body.location) : before.location,
      ctcRangeMin: req.body.ctcRangeMin !== undefined ? n(req.body.ctcRangeMin) : before.ctcRangeMin,
      ctcRangeMax: req.body.ctcRangeMax !== undefined ? n(req.body.ctcRangeMax) : before.ctcRangeMax,
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

hrmRecruitmentRouter.delete("/requisitions/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.manpowerRequisition.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!before) return res.status(404).json({ error: "not found" });
  await prisma.manpowerRequisition.delete({ where: { id: before.id } });
  await audit("hrms.requisition.delete", {
    userId: req.user!.id,
    entity: "ManpowerRequisition",
    entityId: before.id,
    meta: { requisitionNo: before.requisitionNo, candidatesDetached: before._count.candidates },
  });
  res.json({ ok: true, candidatesDetached: before._count.candidates });
});

/* ═════════════════════════════════════  JOB POSTING  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/postings", async (_req, res) => {
  await safeHrmList("job postings", () =>
    prisma.jobPosting.findMany({
      include: { requisition: { select: { requisitionNo: true, status: true } }, _count: { select: { candidates: true } } },
      orderBy: { createdAt: "desc" },
    }),
    res
  );
});

hrmRecruitmentRouter.post("/postings", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const title = s(req.body.title);
  if (!isSpdcHiringRole(title)) {
    return res.status(400).json({ error: "Choose a position from the SPDC hiring roles." });
  }
  const channels = Array.isArray(req.body.channels) ? req.body.channels : req.body.channels ? String(req.body.channels).split(",").map((c: string) => c.trim()) : [];
  const row = await prisma.jobPosting.create({
    data: {
      requisitionId: s(req.body.requisitionId),
      title,
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

hrmRecruitmentRouter.patch("/postings/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  void organizeRecruitmentFolders().catch((err) => {
    pushRuntimeLog({
      level: "error",
      source: "hrm.files",
      message: "Could not organise recruitment folders",
      detail: errorDetail(err),
    });
  });
  try {
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
        requisition: { select: { id: true, requisitionNo: true, department: true, designation: true, status: true } },
        interviews: { select: { id: true, roundNumber: true, roundType: true, status: true, decision: true, scoreOverall: true, scorecardJson: true } },
        offers: { select: { id: true, offerNo: true, status: true, onboard: { select: { userId: true } } } },
        documents: { select: { id: true, category: true, title: true, fileUrl: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    const emails = rows.map((row) => (row.email || "").trim().toLowerCase()).filter(Boolean);
    const users = emails.length
      ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
      : [];
    const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));
    const staffDocs = users.length
      ? await prisma.employeeDocument.findMany({
          where: { userId: { in: users.map((user) => user.id) } },
          select: { id: true, userId: true, category: true, title: true, fileUrl: true },
        })
      : [];
    const byUser = new Map<string, typeof staffDocs>();
    for (const doc of staffDocs) {
      const list = byUser.get(doc.userId) || [];
      list.push(doc);
      byUser.set(doc.userId, list);
    }
    res.json(rows.map((row) => {
      const userId = row.email ? byEmail.get(row.email.trim().toLowerCase()) : undefined;
      const extra = userId ? byUser.get(userId) || [] : [];
      const seen = new Set(row.documents.map((doc) => doc.fileUrl));
      const documents = [...row.documents];
      for (const doc of extra) {
        if (seen.has(doc.fileUrl)) continue;
        documents.push({ id: doc.id, category: doc.category, title: doc.title, fileUrl: doc.fileUrl });
      }
      return { ...row, documents, documentCount: documents.length };
    }));
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "hrm.list",
      message: "candidates failed",
      detail: errorDetail(err),
    });
    res.status(500).json({ error: "Could not load candidates" });
  }
});

hrmRecruitmentRouter.post("/registers/clear-ops", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  if (String(req.body?.confirm || "").trim() !== "CLEAR") {
    return res.status(400).json({ error: "Send confirm: CLEAR to empty this register." });
  }
  const which = String(req.body?.which || "");
  if (which === "payslips") {
    const year = Number(req.body.year) || undefined;
    const month = Number(req.body.month) || undefined;
    const deleted = await prisma.payslip.deleteMany({
      where: { ...(year ? { year } : {}), ...(month ? { month } : {}) },
    });
    await audit("hrms.payslip.clear", { userId: req.user!.id, entity: "Payslip", meta: { year, month, count: deleted.count } });
    return res.json({ ok: true, deleted: deleted.count });
  }
  if (which === "leave") {
    const deleted = await prisma.leaveRequest.deleteMany({});
    await audit("hrms.leave.clear", { userId: req.user!.id, entity: "LeaveRequest", meta: { count: deleted.count } });
    return res.json({ ok: true, deleted: deleted.count });
  }
  if (which === "vouchers") {
    const deleted = await prisma.expenseVoucher.deleteMany({});
    await audit("hrms.voucher.clear", { userId: req.user!.id, entity: "ExpenseVoucher", meta: { count: deleted.count } });
    return res.json({ ok: true, deleted: deleted.count });
  }
  if (which === "hikes") {
    const deleted = await prisma.payHike.deleteMany({});
    await audit("hrms.payHike.clear", { userId: req.user!.id, entity: "PayHike", meta: { count: deleted.count } });
    return res.json({ ok: true, deleted: deleted.count });
  }
  return res.status(400).json({ error: "which must be payslips, leave, vouchers, or hikes" });
});

hrmRecruitmentRouter.delete("/payslips/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  await prisma.payslip.delete({ where: { id: before.id } });
  await audit("hrms.payslip.delete", { userId: req.user!.id, entity: "Payslip", entityId: before.id });
  res.json({ ok: true });
});

hrmRecruitmentRouter.post("/registers/clear", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  if (String(req.body?.confirm || "").trim() !== "CLEAR") {
    return res.status(400).json({ error: "Send confirm: CLEAR to empty the HR registers." });
  }
  const interviews = await prisma.interviewRound.deleteMany({});
  const onboarding = await prisma.onboardingChecklist.deleteMany({});
  const preJoin = await prisma.preJoiningChecklist.deleteMany({});
  const offers = await prisma.offer.deleteMany({});
  const candidates = await prisma.candidate.deleteMany({});
  const postings = await prisma.jobPosting.deleteMany({});
  const requisitions = await prisma.manpowerRequisition.deleteMany({});
  const letters = await prisma.hrmsDocument.deleteMany({});
  const deleted = {
    interviews: interviews.count,
    onboarding: onboarding.count,
    preJoin: preJoin.count,
    offers: offers.count,
    candidates: candidates.count,
    postings: postings.count,
    requisitions: requisitions.count,
    letters: letters.count,
  };
  await audit("hrms.registers.clear", { userId: req.user!.id, entity: "Candidate", meta: deleted });
  res.json({ ok: true, deleted });
});

async function deleteCandidateTree(candidateId: string) {
  await prisma.candidateDocument.deleteMany({ where: { candidateId } });
  const offers = await prisma.offer.findMany({ where: { candidateId }, select: { id: true } });
  const offerIds = offers.map((o) => o.id);
  if (offerIds.length) {
    await prisma.onboardingChecklist.deleteMany({ where: { offerId: { in: offerIds } } });
    await prisma.preJoiningChecklist.deleteMany({ where: { offerId: { in: offerIds } } });
    await prisma.offer.deleteMany({ where: { id: { in: offerIds } } });
  }
  await prisma.interviewRound.deleteMany({ where: { candidateId } });
  await prisma.candidate.delete({ where: { id: candidateId } });
}

function candidateKeepScore(row: {
  status: string;
  resumeUrl: string | null;
  interviews: { scoreOverall: number | null }[];
  offers: { id: string }[];
}) {
  return (
    (row.status === "Joined" ? 40 : 0) +
    row.interviews.length * 10 +
    (row.interviews.some((r) => r.scoreOverall != null) ? 8 : 0) +
    row.offers.length * 8 +
    (row.resumeUrl ? 4 : 0)
  );
}

hrmRecruitmentRouter.post("/candidates/dedupe", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const rows = await prisma.candidate.findMany({
    include: {
      interviews: { select: { scoreOverall: true } },
      offers: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const email = (row.email || "").trim().toLowerCase();
    const key = email || `name:${row.fullName.trim().toLowerCase()}|${(row.phone || "").replace(/\s+/g, "")}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => candidateKeepScore(b) - candidateKeepScore(a) || a.createdAt.getTime() - b.createdAt.getTime());
    const keep = ranked[0];
    if (!keep.resumeUrl) {
      const withResume = list.find((r) => r.resumeUrl);
      if (withResume?.resumeUrl) {
        await prisma.candidate.update({ where: { id: keep.id }, data: { resumeUrl: withResume.resumeUrl } });
      }
    }
    for (const dup of ranked.slice(1)) {
      await deleteCandidateTree(dup.id);
      removed++;
    }
  }
  await audit("hrms.candidate.dedupe", { userId: req.user!.id, entity: "Candidate", meta: { removed } });
  res.json({ removed, remaining: rows.length - removed });
});

hrmRecruitmentRouter.post("/candidates", requireRoles("admin", "office", "hr"), upload.single("resume"), async (req: AuthedRequest, res) => {
  const email = s(req.body.email);
  if (email) {
    const existing = await prisma.candidate.findFirst({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: `${existing.fullName} is already in the resume database (${email}). Open that row instead of adding again.`,
      });
    }
  }
  const requisitionId = s(req.body.requisitionId);
  const requisition = requisitionId
    ? await prisma.manpowerRequisition.findUnique({ where: { id: requisitionId } })
    : null;
  if (!requisition || requisition.status !== "Approved") {
    return res.status(400).json({ error: "Approve the requisition first, then add the candidate to that requisition." });
  }
  let resumeUrl: string | undefined;
  if (req.file) {
    const folder = candidateRecruitmentFolder({
      fullName: s(req.body.fullName) || "Candidate",
      status: "New",
      requisitionNo: requisition.requisitionNo,
      designation: requisition.designation,
    });
    const saved = await mockOneDrive.upload(
      HR_DRIVE,
      folder,
      `resume-${s(req.body.fullName)?.replace(/[^a-zA-Z0-9._-]/g, "_") || "candidate"}${extOf(req.file)}`,
      req.file.buffer,
      req.file.mimetype,
      { replace: true },
    );
    resumeUrl = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}`;
  }
  const row = await prisma.candidate.create({
    data: {
      postingId: s(req.body.postingId),
      requisitionId: requisition.id,
      fullName: s(req.body.fullName) || "Candidate",
      email,
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
      status: resumeUrl ? "New" : "Upload",
    },
  });
  await audit("hrms.candidate.create", { userId: req.user!.id, entity: "Candidate", entityId: row.id, meta: { fullName: row.fullName, source: row.sourceChannel } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/candidates/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const nextEmail = req.body.email !== undefined ? s(req.body.email) : before.email;
  if (nextEmail && nextEmail !== before.email) {
    const clash = await prisma.candidate.findFirst({ where: { email: nextEmail, NOT: { id: before.id } } });
    if (clash) return res.status(409).json({ error: `${clash.fullName} already uses ${nextEmail}.` });
  }
  const nextStatus = s(req.body.status) || before.status;
  const row = await prisma.candidate.update({
    where: { id: req.params.id },
    data: {
      fullName: s(req.body.fullName) ?? before.fullName,
      email: nextEmail,
      phone: req.body.phone !== undefined ? s(req.body.phone) : before.phone,
      sourceChannel: req.body.sourceChannel !== undefined ? s(req.body.sourceChannel) : before.sourceChannel,
      currentCompany: req.body.currentCompany !== undefined ? s(req.body.currentCompany) : before.currentCompany,
      currentDesign: req.body.currentDesign !== undefined ? s(req.body.currentDesign) : before.currentDesign,
      location: req.body.location !== undefined ? s(req.body.location) : before.location,
      skills: req.body.skills !== undefined ? s(req.body.skills) : before.skills,
      postingId: req.body.postingId !== undefined ? s(req.body.postingId) : before.postingId,
      requisitionId: req.body.requisitionId !== undefined ? s(req.body.requisitionId) : before.requisitionId,
      status: nextStatus,
      screenedById: nextStatus === "Screened" ? req.user!.id : before.screenedById,
      rejectionReason: s(req.body.rejectionReason) || before.rejectionReason,
      notes: s(req.body.notes) ?? before.notes,
      currentCtc: n(req.body.currentCtc) ?? before.currentCtc,
      expectedCtc: n(req.body.expectedCtc) ?? before.expectedCtc,
      noticePeriodDays: req.body.noticePeriodDays !== undefined ? Number(req.body.noticePeriodDays) || null : before.noticePeriodDays,
      experienceYears: req.body.experienceYears !== undefined ? n(req.body.experienceYears) : before.experienceYears,
    },
  });
  await audit("hrms.candidate.status", { userId: req.user!.id, entity: "Candidate", entityId: row.id, meta: { from: before.status, to: nextStatus } });
  res.json(row);
});

hrmRecruitmentRouter.post("/candidates/:id/resume", requireRoles("admin", "office", "hr"), upload.single("resume"), async (req: AuthedRequest, res) => {
  const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  if (!req.file) return res.status(400).json({ error: "Choose a resume file." });
  const saved = await mockOneDrive.upload(
    HR_DRIVE,
    await recruitmentFolderFor(before.id),
    `resume-${before.fullName.replace(/[^a-zA-Z0-9._-]/g, "_")}${extOf(req.file)}`,
    req.file.buffer,
    req.file.mimetype,
    { replace: true },
  );
  const resumeUrl = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}`;
  const row = await prisma.candidate.update({
    where: { id: before.id },
    data: {
      resumeUrl,
      status: before.status === "Upload" ? "New" : before.status,
    },
  });
  await audit("hrms.candidate.resume", { userId: req.user!.id, entity: "Candidate", entityId: row.id });
  res.json(row);
});

const BGV_CATEGORIES = ["Passport photo", "Photo", "PAN", "Aadhaar", "Education", "Experience", "Salary slips", "Address proof", "Bank", "PF-ESIC", "Medical", "BGV", "Other"] as const;

function storedFileName(storagePath: string | null | undefined, fileUrl: string, fallback: string) {
  const raw = (storagePath || fileUrl || fallback).split("?")[0];
  const name = decodeURIComponent(raw.split("/").pop() || fallback);
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
  return safe || fallback;
}

async function readStoredFile(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  const path = storagePath.startsWith(`${SHAREPOINT_SANDBOX_ROOT}/`)
    ? storagePath
    : `${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${storagePath.replace(/^\/+/, "")}`;
  try {
    return await downloadDriveFile(path);
  } catch {
    return null;
  }
}

async function filedCopy(folder: string, fileName: string, storagePath: string | null | undefined) {
  const target = `${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${folder}/${fileName}`;
  const existing = await driveItemWebUrl(target);
  if (existing) return { fileUrl: existing, storagePath: target };
  const buf = await readStoredFile(storagePath);
  if (!buf) return null;
  const saved = await mockOneDrive.upload(HR_DRIVE, folder, fileName, buf, undefined, { replace: true });
  return {
    fileUrl: saved.sharePointUrl || saved.url || existing || "",
    storagePath: saved.sharePointPath || target,
  };
}

/** Shortlisted people live in their requisition folder. Once they have a staff login, the same files are copied into the employee vault. */
export async function ensurePersonRecords(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      requisition: { select: { requisitionNo: true, designation: true } },
      documents: true,
      interviews: { select: { id: true }, take: 1 },
    },
  });
  if (!candidate) return;
  const user = candidate.email
    ? await prisma.user.findUnique({ where: { email: candidate.email.trim().toLowerCase() } })
    : null;
  const profile = user ? await prisma.employeeProfile.findUnique({ where: { userId: user.id } }) : null;
  const recruitFolder = candidateRecruitmentFolder({
    fullName: candidate.fullName,
    status: candidate.status,
    requisitionNo: candidate.requisition?.requisitionNo,
    designation: candidate.requisition?.designation,
    interviewed: candidate.interviews.length > 0,
  });
  const { vaultSubfolderForCategory } = await import("../services/hrEmployeeVault.js");
  const { employeeRecordRoot } = await import("../services/spdcLibraryFolders.js");
  const empRoot = user ? employeeRecordRoot(profile?.empCode, user.fullName || candidate.fullName) : null;
  const staffDocs = user ? await prisma.employeeDocument.findMany({ where: { userId: user.id } }) : [];
  type Item = {
    category: string;
    title: string;
    fileUrl: string;
    storagePath: string | null;
    candidateDocId?: string;
    employeeDocId?: string;
  };
  const items = new Map<string, Item>();
  for (const doc of candidate.documents) {
    items.set(doc.fileUrl, {
      category: doc.category,
      title: doc.title,
      fileUrl: doc.fileUrl,
      storagePath: doc.storagePath,
      candidateDocId: doc.id,
    });
  }
  for (const doc of staffDocs) {
    const prev = items.get(doc.fileUrl);
    if (prev) prev.employeeDocId = doc.id;
    else {
      items.set(doc.fileUrl, {
        category: doc.category,
        title: doc.title,
        fileUrl: doc.fileUrl,
        storagePath: doc.storagePath,
        employeeDocId: doc.id,
      });
    }
  }
  for (const item of items.values()) {
    const name = storedFileName(item.storagePath, item.fileUrl, `${item.category || "file"}.bin`);
    const recruit = await filedCopy(recruitFolder, name, item.storagePath);
    const empFolder = empRoot ? `${empRoot}/${vaultSubfolderForCategory(item.category)}` : null;
    const employee = empFolder ? await filedCopy(empFolder, name, item.storagePath) : null;
    const canonical = employee?.fileUrl || recruit?.fileUrl || item.fileUrl;
    const storagePath = employee?.storagePath || recruit?.storagePath || item.storagePath;
    if (!canonical) continue;
    if (item.candidateDocId) {
      if (canonical !== item.fileUrl || storagePath !== item.storagePath) {
        await prisma.candidateDocument.update({
          where: { id: item.candidateDocId },
          data: { fileUrl: canonical, storagePath },
        });
      }
    } else {
      await prisma.candidateDocument.create({
        data: { candidateId, category: item.category || "Other", title: item.title, fileUrl: canonical, storagePath },
      });
    }
    if (!user) continue;
    if (item.employeeDocId) {
      if (canonical !== item.fileUrl || storagePath !== item.storagePath) {
        await prisma.employeeDocument.update({
          where: { id: item.employeeDocId },
          data: { fileUrl: canonical, storagePath },
        });
      }
    } else {
      await prisma.employeeDocument.create({
        data: { userId: user.id, category: item.category || "Other", title: item.title, fileUrl: canonical, storagePath },
      });
    }
  }
}

let recruitmentOrganizeStarted = false;

/** Loose files dumped in the recruitment buckets are moved into Requisition / Person. Images are rewritten so SharePoint can open them. */
export async function organizeRecruitmentFolders() {
  if (recruitmentOrganizeStarted) return;
  recruitmentOrganizeStarted = true;
  const people = await prisma.candidate.findMany({
    include: {
      requisition: { select: { requisitionNo: true, designation: true } },
      interviews: { select: { id: true }, take: 1 },
    },
  });
  const ranked = people
    .map((person) => {
      const rel = candidateRecruitmentFolder({
        fullName: person.fullName,
        status: person.status,
        requisitionNo: person.requisition?.requisitionNo,
        designation: person.requisition?.designation,
        interviewed: person.interviews.length > 0,
      });
      const token = rel.split("/").pop() || "";
      return { token, rel, full: `${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${rel}` };
    })
    .filter((row) => row.token.length > 2)
    .sort((a, b) => b.token.length - a.token.length);
  const buckets = [
    "05_Records_Recruitment/01_Resumes_Received",
    "05_Records_Recruitment/02_Shortlisted_and_Interviewed",
    "05_Records_Recruitment/03_Rejected",
  ];
  for (const bucket of buckets) {
    let files: { id: string; name: string }[] = [];
    try {
      files = await listDriveFiles(`${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${bucket}`);
    } catch {
      continue;
    }
    for (const file of files) {
      const hit = ranked.find((row) => file.name.includes(row.token));
      if (!hit) continue;
      const current = `${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${bucket}/${file.name}`;
      try {
        if (/\.(png|jpe?g|gif|webp)$/i.test(file.name) || /\b(png|jpe?g|photo)\b/i.test(file.name)) {
          const buf = await downloadDriveFile(current);
          let mime = mimeForFileName(file.name);
          let outName = file.name;
          if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) {
            mime = "image/png";
            if (!/\.png$/i.test(outName)) outName = `${outName}.png`;
          } else if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) {
            mime = "image/jpeg";
            if (!/\.jpe?g$/i.test(outName)) outName = `${outName}.jpg`;
          }
          await uploadToProjectLibrary(HR_DRIVE, hit.rel, outName, buf, mime, { replace: true });
        }
        if (!hit.full.startsWith(`${SHAREPOINT_SANDBOX_ROOT}/${HR_DRIVE}/${bucket}/`)) {
          await moveDriveItem(file.id, hit.full);
        } else if (hit.rel !== bucket) {
          await moveDriveItem(file.id, hit.full);
        }
      } catch (err) {
        pushRuntimeLog({
          level: "error",
          source: "hrm.files",
          message: `Could not file ${file.name} into the requisition folder`,
          detail: errorDetail(err),
        });
      }
    }
  }
}

async function recruitmentFolderFor(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      requisition: { select: { requisitionNo: true, designation: true } },
      interviews: { select: { id: true }, take: 1 },
    },
  });
  if (!candidate) return candidateRecruitmentFolder({ fullName: "Candidate" });
  return candidateRecruitmentFolder({
    fullName: candidate.fullName,
    status: candidate.status,
    requisitionNo: candidate.requisition?.requisitionNo,
    designation: candidate.requisition?.designation,
    interviewed: candidate.interviews.length > 0,
  });
}

/** Checklist and Employee files both read EmployeeDocument. Copy candidate uploads onto the staff login when one exists. SharePoint files stay; only the portal row is removed on delete. */
async function mirrorCandidateDocsToStaff(candidateId: string, userId: string) {
  const docs = await prisma.candidateDocument.findMany({ where: { candidateId } });
  if (!docs.length) return;
  const existing = await prisma.employeeDocument.findMany({
    where: { userId, fileUrl: { in: docs.map((d) => d.fileUrl) } },
    select: { fileUrl: true },
  });
  const have = new Set(existing.map((d) => d.fileUrl));
  for (const doc of docs) {
    if (have.has(doc.fileUrl)) continue;
    await prisma.employeeDocument.create({
      data: {
        userId,
        category: doc.category,
        title: doc.title,
        fileUrl: doc.fileUrl,
        storagePath: doc.storagePath,
      },
    });
  }
}

hrmRecruitmentRouter.post("/candidates/:id/documents", requireRoles("admin", "office", "hr"), upload.single("file"), async (req: AuthedRequest, res) => {
  const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  if (!req.file) return res.status(400).json({ error: "Choose a document." });
  const category = BGV_CATEGORIES.includes(String(req.body.category) as (typeof BGV_CATEGORIES)[number])
    ? String(req.body.category)
    : "Other";
  const employee = before.email
    ? await prisma.user.findUnique({ where: { email: before.email.trim().toLowerCase() } })
    : null;
  const profile = employee ? await prisma.employeeProfile.findUnique({ where: { userId: employee.id } }) : null;
  const safeName = before.fullName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `kyc-${category.replace(/\s+/g, "_")}-${safeName}${extOf(req.file)}`;
  const recruitSaved = await mockOneDrive.upload(
    HR_DRIVE,
    await recruitmentFolderFor(before.id),
    fileName,
    req.file.buffer,
    req.file.mimetype,
    { replace: true },
  );
  const saved = employee
    ? await mockOneDrive.upload(
        HR_DRIVE,
        kycFolder(profile?.empCode, before.fullName),
        fileName,
        req.file.buffer,
        req.file.mimetype,
        { replace: true },
      )
    : recruitSaved;
  const fileUrl = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}`;
  const doc = await prisma.candidateDocument.create({
    data: {
      candidateId: before.id,
      category,
      title: s(req.body.title) || `${category} · ${before.fullName}`,
      fileUrl,
      storagePath: saved.sharePointPath || saved.path,
    },
  });
  if (employee) await mirrorCandidateDocsToStaff(before.id, employee.id);
  await audit("hrms.candidate.document", { userId: req.user!.id, entity: "CandidateDocument", entityId: doc.id, meta: { candidateId: before.id, category } });
  res.status(201).json(doc);
});

hrmRecruitmentRouter.get("/stored-file/:id", async (req: AuthedRequest, res) => {
  const staff = await prisma.employeeDocument.findUnique({ where: { id: req.params.id } });
  const cand = staff ? null : await prisma.candidateDocument.findUnique({ where: { id: req.params.id } });
  const row = staff || cand;
  if (!row) return res.status(404).json({ error: "not found" });
  const name = storedFileName(row.storagePath, row.fileUrl, "file");
  const buf = await readStoredFile(row.storagePath);
  if (!buf) return res.status(404).json({ error: "File is not on SharePoint yet." });
  let mime = mimeForFileName(name);
  if (mime === "application/octet-stream") {
    if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) mime = "image/png";
    else if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
    else if (buf.length > 6 && buf.slice(0, 4).toString() === "GIF8") mime = "image/gif";
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `inline; filename="${name.replace(/"/g, "")}"`);
  res.send(buf);
});

hrmRecruitmentRouter.delete("/candidates/:id/documents/:docId", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const doc = await prisma.candidateDocument.findFirst({
    where: { id: req.params.docId, candidateId: req.params.id },
  });
  if (!doc) {
    const staffDoc = await prisma.employeeDocument.findUnique({ where: { id: req.params.docId } });
    if (!staffDoc) return res.status(404).json({ error: "not found" });
    await prisma.employeeDocument.delete({ where: { id: staffDoc.id } });
    if (staffDoc.fileUrl) {
      await prisma.candidateDocument.deleteMany({ where: { candidateId: req.params.id, fileUrl: staffDoc.fileUrl } });
    }
    await audit("hrms.candidate.document.delete", { userId: req.user!.id, entity: "EmployeeDocument", entityId: staffDoc.id, meta: { candidateId: req.params.id } });
    return res.json({ ok: true });
  }
  await prisma.candidateDocument.delete({ where: { id: doc.id } });
  if (doc.fileUrl) {
    await prisma.employeeDocument.deleteMany({ where: { fileUrl: doc.fileUrl } });
  }
  await audit("hrms.candidate.document.delete", { userId: req.user!.id, entity: "CandidateDocument", entityId: doc.id, meta: { candidateId: req.params.id } });
  res.json({ ok: true });
});

hrmRecruitmentRouter.delete("/candidates/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  await deleteCandidateTree(before.id);
  await audit("hrms.candidate.delete", { userId: req.user!.id, entity: "Candidate", entityId: before.id, meta: { fullName: before.fullName } });
  res.json({ ok: true });
});

hrmRecruitmentRouter.post("/candidates/:id/convert", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { offers: { include: { onboard: true } } },
  });
  if (!candidate) return res.status(404).json({ error: "not found" });
  const email = (candidate.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Add an email on this candidate before converting them to an employee." });
  const hiredAs = await prisma.candidate.findUnique({
    where: { id: candidate.id },
    select: { requisition: { select: { designation: true, department: true } }, currentDesign: true },
  });
  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;
  if (!user) {
    const bcrypt = await import("bcryptjs");
    const { portalForRole } = await import("@sharnam/shared");
    const hash = await bcrypt.hash(process.env.SEED_PASSWORD || "Demo@1234", 10);
    user = await prisma.user.create({
      data: {
        email,
        fullName: candidate.fullName,
        role: "employee",
        portal: portalForRole("employee"),
        phone: candidate.phone,
        passwordHash: hash,
      },
    });
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        empCode: `EMP-${Date.now().toString().slice(-6)}`,
        designation: hiredAs?.requisition?.designation || candidate.currentDesign,
        department: hiredAs?.requisition?.department || null,
        joinDate: new Date(),
      },
    });
    const { ensureDefaultLeaveBalancesForUser } = await import("../services/spdcLeaveSeed.js");
    await ensureDefaultLeaveBalancesForUser(user.id);
    created = true;
  }
  const kyc = await prisma.candidateDocument.findMany({ where: { candidateId: candidate.id } });
  for (const doc of kyc) {
    const already = await prisma.employeeDocument.findFirst({
      where: { userId: user.id, category: doc.category, fileUrl: doc.fileUrl },
    });
    if (already) continue;
    await prisma.employeeDocument.create({
      data: {
        userId: user.id,
        category: doc.category,
        title: doc.title,
        fileUrl: doc.fileUrl,
        storagePath: doc.storagePath,
      },
    });
  }
  const offer = candidate.offers.find((o) => o.status === "Accepted" || o.status === "Joined") || candidate.offers[0];
  if (offer) {
    await prisma.onboardingChecklist.upsert({
      where: { offerId: offer.id },
      create: { offerId: offer.id, userId: user.id },
      update: { userId: user.id },
    });
  }
  await prisma.candidate.update({ where: { id: candidate.id }, data: { status: "Joined" } });
  const desk = await openJoinerDesk(candidate.id, user.id);
  await audit("hrms.candidate.convert", {
    userId: req.user!.id,
    entity: "User",
    entityId: user.id,
    meta: { candidateId: candidate.id, created, email },
  });
  res.json({ userId: user.id, created, email: user.email, fullName: user.fullName, offerId: desk?.offerId || offer?.id || null });
});

const HIRED_STATUSES = new Set(["Joined", "Accepted", "Offered", "Selected"]);

/** Joined people get an offer row so the onboarding checklist has somewhere to live. Does not move them back to Selected. */
async function openJoinerDesk(candidateId: string, userId?: string | null) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      offers: { orderBy: { updatedAt: "desc" } },
      requisition: { select: { designation: true, department: true } },
      documents: { select: { id: true } },
    },
  });
  if (!candidate) return null;
  const email = (candidate.email || "").trim().toLowerCase();
  const staffUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const profile = staffUser ? await prisma.employeeProfile.findUnique({ where: { userId: staffUser.id } }) : null;
  let offer = candidate.offers.find((o) => o.status === "Accepted" || o.status === "Joined") || candidate.offers[0] || null;
  if (!offer) {
    offer = await prisma.offer.create({
      data: {
        candidateId: candidate.id,
        offerNo: `OFR-${Date.now().toString().slice(-6)}`,
        designation: candidate.requisition?.designation || profile?.designation || candidate.currentDesign || "Executive",
        department: candidate.requisition?.department || profile?.department || null,
        ctcAnnual: profile?.ctcAnnual || candidate.expectedCtc || 0,
        basicMonthly: profile?.basicMonthly ?? null,
        hraMonthly: profile?.hraMonthly ?? null,
        joiningDate: profile?.joinDate || new Date(),
        location: candidate.location,
        status: "Joined",
        acceptedAt: new Date(),
        joinedAt: new Date(),
      },
    });
  }
  const appointment = await prisma.hrmsDocument.findFirst({
    where: {
      kind: "Appointment",
      OR: [
        ...(staffUser ? [{ employeeUserId: staffUser.id }] : []),
        { employeeName: candidate.fullName },
        ...(email ? [{ candidateEmail: email }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  await prisma.preJoiningChecklist.upsert({
    where: { offerId: offer.id },
    create: {
      offerId: offer.id,
      empCodeGenerated: profile?.empCode || null,
      docCollectionDone: candidate.documents.length > 0,
      docCollectionAt: candidate.documents.length > 0 ? new Date() : null,
      appointmentLetterUrl: appointment?.sharePointUrl || appointment?.generatedDocxUrl || null,
      emailCreated: Boolean(staffUser?.email),
      emailAddress: staffUser?.email || null,
      emailCreatedAt: staffUser?.email ? new Date() : null,
    },
    update: {
      empCodeGenerated: profile?.empCode || undefined,
      ...(candidate.documents.length > 0 ? { docCollectionDone: true } : {}),
      ...(appointment?.sharePointUrl || appointment?.generatedDocxUrl
        ? { appointmentLetterUrl: appointment.sharePointUrl || appointment.generatedDocxUrl }
        : {}),
    },
  });
  await prisma.onboardingChecklist.upsert({
    where: { offerId: offer.id },
    create: { offerId: offer.id, userId: userId || staffUser?.id || null },
    update: { userId: userId || staffUser?.id || undefined },
  });
  const staffId = userId || staffUser?.id || null;
  if (staffId) await mirrorCandidateDocsToStaff(candidate.id, staffId);
  return { offerId: offer.id, userId: staffId };
}

hrmRecruitmentRouter.get("/onboarding-board", requireRoles("admin", "office", "hr"), async (_req, res) => {
  const people = await prisma.candidate.findMany({
    where: { status: { in: ["Joined", "Accepted"] } },
    include: {
      requisition: { select: { requisitionNo: true, department: true, designation: true } },
      documents: { select: { fileUrl: true } },
      offers: {
        include: { preJoin: true, onboard: true },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const emails = people.map((p) => (p.email || "").trim().toLowerCase()).filter(Boolean);
  const users = emails.length ? await prisma.user.findMany({ where: { email: { in: emails } } }) : [];
  const profiles = users.length
    ? await prisma.employeeProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } } })
    : [];
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const staffDocs = users.length
    ? await prisma.employeeDocument.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { userId: true, fileUrl: true },
      })
    : [];
  const staffUrls = new Map<string, string[]>();
  for (const doc of staffDocs) {
    const list = staffUrls.get(doc.userId) || [];
    list.push(doc.fileUrl);
    staffUrls.set(doc.userId, list);
  }
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), { user: u, profile: profileByUser.get(u.id) || null }]));
  res.json(
    people.map((p) => {
      const staff = p.email ? byEmail.get(p.email.trim().toLowerCase()) : undefined;
      const offer = p.offers.find((o) => o.status === "Accepted" || o.status === "Joined") || null;
      return {
        candidateId: p.id,
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        status: p.status,
        designation: p.requisition?.designation || staff?.profile?.designation || p.currentDesign,
        department: p.requisition?.department || staff?.profile?.department || null,
        requisitionNo: p.requisition?.requisitionNo || null,
        documentCount: new Set([
          ...p.documents.map((doc) => doc.fileUrl),
          ...(staff ? staffUrls.get(staff.user.id) || [] : []),
        ].filter(Boolean)).size,
        empCode: staff?.profile?.empCode || offer?.preJoin?.empCodeGenerated || null,
        userId: staff?.user.id || offer?.onboard?.userId || null,
        ctcAnnual: staff?.profile?.ctcAnnual ?? offer?.ctcAnnual ?? null,
        joinDate: staff?.profile?.joinDate || offer?.joiningDate || null,
        offerId: offer?.id || null,
        offerNo: offer?.offerNo || null,
      };
    }),
  );
});

hrmRecruitmentRouter.post("/candidates/:id/start-onboarding", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!candidate) return res.status(404).json({ error: "not found" });
  if (candidate.status === "Rejected" || candidate.status === "Withdrawn") {
    return res.status(400).json({ error: "This candidate was not selected. Convert the person you hired, then open onboarding." });
  }
  const desk = await openJoinerDesk(candidate.id);
  if (!desk) return res.status(404).json({ error: "not found" });
  if (!HIRED_STATUSES.has(candidate.status)) {
    await prisma.candidate.update({ where: { id: candidate.id }, data: { status: "Joined" } });
  }
  await audit("hrms.onboarding.open", { userId: req.user!.id, entity: "Offer", entityId: desk.offerId, meta: { candidateId: candidate.id } });
  res.json(desk);
});

/* ═════════════════════════════════════  INTERVIEW ROUNDS  ═════════════════════════════════════ */

type InterviewerSeat = {
  userId?: string;
  name: string;
  email?: string;
  designation?: string;
  seat: string;
};

type IntervieweeSeat = {
  candidateId?: string;
  name: string;
  email?: string;
  phone?: string;
  applyingFor?: string;
};

function decodeInterviewPanel(json: string | null | undefined, interviewee: IntervieweeSeat): {
  interviewers: InterviewerSeat[];
  interviewee: IntervieweeSeat;
} {
  try {
    const p = JSON.parse(json || "[]");
    if (Array.isArray(p)) {
      return {
        interviewers: p.filter(Boolean).map((name: unknown) => ({
          name: String(name),
          seat: "Technical",
        })),
        interviewee,
      };
    }
    if (p && typeof p === "object") {
      const interviewers = Array.isArray(p.interviewers) ? p.interviewers : [];
      return {
        interviewers: interviewers.map((row: InterviewerSeat) => ({
          userId: row.userId,
          name: String(row.name || ""),
          email: row.email,
          designation: row.designation,
          seat: String(row.seat || "Technical"),
        })),
        interviewee: { ...interviewee, ...(p.interviewee || {}) },
      };
    }
  } catch {
    /* legacy */
  }
  return { interviewers: [], interviewee };
}

function interviewPublic(row: { panelJson?: string | null; candidate?: { id?: string; fullName?: string; email?: string | null; phone?: string | null; posting?: { title?: string } | null } } & Record<string, unknown>) {
  const interviewee: IntervieweeSeat = {
    candidateId: row.candidate?.id,
    name: row.candidate?.fullName || "",
    email: row.candidate?.email || "",
    phone: row.candidate?.phone || "",
    applyingFor: row.candidate?.posting?.title || "",
  };
  const panel = decodeInterviewPanel(row.panelJson as string, interviewee);
  return { ...row, ...panel };
}

hrmRecruitmentRouter.get("/interviews", async (_req, res) => {
  await safeHrmList("interviews", () =>
    prisma.interviewRound
      .findMany({
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
              posting: { select: { title: true } },
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
        take: 200,
      })
      .then((rows) => rows.map((r) => interviewPublic(r))),
    res
  );
});

function canonicalInterviewRound(raw: string | null | undefined): "R1" | "R2" | "R3" | null {
  const t = String(raw || "").trim();
  if (/^R1\b/i.test(t) || /^hr\b/i.test(t) || /screen/i.test(t)) return "R1";
  if (/^R3\b/i.test(t) || /manag/i.test(t)) return "R3";
  if (/^R2\b/i.test(t) || /technical/i.test(t)) return "R2";
  return null;
}

function scorecardShareName(fullName: string, round: "R1" | "R2" | "R3") {
  const safe = (fullName || "candidate").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${safe}_${round}_scorecard.xlsx`;
}

hrmRecruitmentRouter.get("/candidates/:id/interviews", async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { posting: { select: { title: true } } },
  });
  if (!candidate) return res.status(404).json({ error: "not found" });
  const rows = await prisma.interviewRound.findMany({
    where: { candidateId: candidate.id },
    orderBy: { roundNumber: "asc" },
  });
  res.json(rows.map((r) => interviewPublic({ ...r, candidate })));
});

hrmRecruitmentRouter.post("/candidates/:id/interviews", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { posting: { select: { title: true } }, requisition: { select: { designation: true, department: true, status: true } } },
  });
  if (!candidate) return res.status(404).json({ error: "not found" });
  if (!candidate.resumeUrl) {
    return res.status(400).json({ error: "Upload the resume first. The stage moves to Resume received, then you can schedule the interview." });
  }
  const fromSheet = isSpdcHiringRole(s(req.body.position)) ? s(req.body.position) : null;
  const reqTitle = candidate.requisition?.designation || null;
  const masterRole = reqTitle
    ? await prisma.hrmDesignation.findUnique({ where: { title: reqTitle }, select: { scorecardRole: true } }).catch(() => null)
    : null;
  const fromReq = reqTitle
    ? isSpdcHiringRole(masterRole?.scorecardRole) ? masterRole!.scorecardRole! : scorecardRoleForDesignation(reqTitle)
    : null;
  const appliedRole = fromSheet || fromReq || "";
  if (!appliedRole) {
    return res.status(400).json({ error: "Attach the candidate to an approved requisition before scheduling the interview." });
  }
  const priorRounds = await prisma.interviewRound.findMany({
    where: { candidateId: candidate.id },
    select: { roundType: true },
  });
  const roundType = canonicalInterviewRound(s(req.body.roundType));
  if (!roundType) {
    return res.status(400).json({ error: "Schedule R1, R2, or R3 only. A candidate does not need every round." });
  }
  const usedRounds = new Set(
    priorRounds.map((row) => canonicalInterviewRound(row.roundType)).filter((id): id is "R1" | "R2" | "R3" => !!id),
  );
  if (usedRounds.size >= 3) {
    return res.status(400).json({ error: "This candidate already has R1, R2, and R3. Score the rounds they sat, then onboard." });
  }
  if (usedRounds.has(roundType)) {
    return res.status(400).json({ error: `${roundType} is already scheduled for this candidate. Open that card and save the score.` });
  }
  const interviewee: IntervieweeSeat = {
    candidateId: candidate.id,
    name: candidate.fullName,
    email: candidate.email || "",
    phone: candidate.phone || "",
    applyingFor: appliedRole,
  };
  const rawInterviewers = Array.isArray(req.body.interviewers) ? req.body.interviewers : [];
  const fromPanel = Array.isArray(req.body.panel) ? req.body.panel : req.body.panel ? [req.body.panel] : [];
  const interviewers: InterviewerSeat[] = rawInterviewers.length
    ? rawInterviewers
        .map((row: InterviewerSeat) => ({
          userId: s(row.userId) || undefined,
          name: String(row.name || "").trim(),
          email: s(row.email) || undefined,
          designation: s(row.designation) || undefined,
          seat: String(row.seat || "Technical"),
        }))
        .filter((row: InterviewerSeat) => row.name)
    : fromPanel.filter(Boolean).map((name: unknown) => ({ name: String(name), seat: "Technical" }));
  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
  const mode = s(req.body.mode) === "In-person" || s(req.body.mode) === "Phone" ? String(req.body.mode) : "Teams";
  const durationMins = Number(req.body.durationMins) || 60;
  const location = s(req.body.location) || (mode === "Teams" ? "Microsoft Teams" : "");

  let meetingLink = s(req.body.meetingLink);
  let meetingId = s(req.body.meetingId);
  let teamsNote: string | null = null;
  if (!meetingLink && scheduledAt && mode === "Teams") {
    try {
      const end = new Date(scheduledAt.getTime() + durationMins * 60_000);
      const interviewerLines = interviewers
        .map((p) => `<li>${p.seat}: <strong>${p.name}</strong>${p.designation ? ` · ${p.designation}` : ""}${p.email ? ` · ${p.email}` : ""}</li>`)
        .join("");
      const sch = await createTeamsSchedule({
        subject: `HR interview · ${candidate.fullName} · ${s(req.body.roundType) || "Technical"}`,
        start: scheduledAt,
        end,
        location: location || "Microsoft Teams",
        bodyHtml: `<p>Interview scheduled from Sharnam HRMS.</p>
          <p><strong>Interviewee:</strong> ${candidate.fullName}${candidate.email ? ` · ${candidate.email}` : ""}${interviewee.applyingFor ? ` · applying for ${interviewee.applyingFor}` : ""}</p>
          <p><strong>Interviewers</strong></p><ul>${interviewerLines || "<li>Panel to be confirmed</li>"}</ul>`,
      });
      meetingLink = sch.teamsJoinUrl;
      meetingId = sch.graphEventId;
      teamsNote = sch.note;
    } catch (err) {
      teamsNote = err instanceof Error ? err.message : "Teams schedule failed";
      pushRuntimeLog({
        level: "error",
        source: "hrm.interview",
        message: "Teams meeting create failed",
        detail: errorDetail(err),
      });
    }
  }

  let scorecardJson: string | null = null;
  try {
    const blank = scoreInterviewRound({
      position: appliedRole,
      round: roundType,
      scores: {},
    });
    const xlsx = await scorecardWorkbook(candidate.fullName, blank, {
      interviewDate: s(req.body.scheduledAt) || null,
      experienceYears: candidate.experienceYears,
      source: candidate.sourceChannel,
      panelists: interviewers.map((p) => p.name),
    });
    const filed = await mockOneDrive.upload(
      HR_DRIVE,
      await recruitmentFolderFor(candidate.id),
      scorecardShareName(candidate.fullName, roundType),
      xlsx,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      { replace: true },
    );
    scorecardJson = JSON.stringify({
      position: blank.position,
      round: roundType,
      scores: {},
      sharePointUrl: filed.sharePointUrl || null,
    });
  } catch (err) {
    console.warn("[HRMS] scorecard file:", err instanceof Error ? err.message : err);
  }

  const row = await prisma.interviewRound.create({
    data: {
      candidateId: candidate.id,
      roundNumber: roundType === "R1" ? 1 : roundType === "R3" ? 3 : 2,
      roundType,
      panelJson: JSON.stringify({ version: 1, interviewers, interviewee }),
      scheduledAt,
      durationMins,
      mode,
      meetingLink,
      meetingId,
      status: "Scheduled",
      scorecardJson,
    },
  });
  if (!HIRED_STATUSES.has(candidate.status)) {
    await prisma.candidate.update({ where: { id: candidate.id }, data: { status: "Interview" } });
  }
  await audit("hrms.interview.schedule", {
    userId: req.user!.id,
    entity: "InterviewRound",
    entityId: row.id,
    meta: { candidateId: candidate.id, roundNumber: row.roundNumber, mode, interviewers: interviewers.map((p) => p.name) },
  });
  res.status(201).json({ ...interviewPublic({ ...row, candidate }), teamsNote });
});

hrmRecruitmentRouter.get("/interview-framework", requireRoles("admin", "office", "hr"), (_req, res) => {
  res.json({
    roles: INTERVIEW_ROLES,
    params: INTERVIEW_PARAMS,
    rounds: ["R1", "R2", "R3"],
    roundFocus: ROUND_FOCUS,
    roundNote: ROUND_NOTE,
  });
});

hrmRecruitmentRouter.patch("/interviews/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.interviewRound.findUnique({
    where: { id: req.params.id },
    include: {
      candidate: {
        select: {
          fullName: true,
          status: true,
          experienceYears: true,
          sourceChannel: true,
        },
      },
    },
  });
  if (!before) return res.status(404).json({ error: "not found" });
  let scorecardJson = before.scorecardJson;
  let scoreOverall = n(req.body.scoreOverall) ?? before.scoreOverall;
  let decision = s(req.body.decision) ?? before.decision;
  let scorecardFile: { name: string; scored: ReturnType<typeof scoreInterviewRound>; payload: Record<string, unknown> } | null = null;
  if (req.body.scorecard && typeof req.body.scorecard === "object") {
    const scored = scoreInterviewRound({
      position: String(req.body.scorecard.position || ""),
      round: String(req.body.scorecard.round || before.roundType || "R2"),
      scores: req.body.scorecard.scores || {},
    });
    scorecardJson = JSON.stringify({
      ...req.body.scorecard,
      result: scored,
    });
    scoreOverall = scored.percent;
    if (!s(req.body.decision)) {
      decision = scored.grade === "D" ? "Reject" : scored.grade === "C" ? "Hold" : "Advance";
    }
    scorecardFile = {
      name: (before.candidate.fullName || "candidate").replace(/[^a-zA-Z0-9._-]+/g, "_"),
      scored,
      payload: req.body.scorecard,
    };
  }
  const currentRound = canonicalInterviewRound(before.roundType);
  const pickedRound = req.body.scorecard ? canonicalInterviewRound(String(req.body.scorecard.round || "")) : null;
  if (pickedRound && pickedRound !== currentRound) {
    const others = await prisma.interviewRound.findMany({
      where: { candidateId: before.candidateId, id: { not: before.id } },
      select: { roundType: true },
    });
    if (others.some((row) => canonicalInterviewRound(row.roundType) === pickedRound)) {
      return res.status(400).json({ error: `${pickedRound} is already on another meeting. Use that card, or pick a free round.` });
    }
  }
  const row = await prisma.interviewRound.update({
    where: { id: req.params.id },
    data: {
      ...(pickedRound ? { roundType: pickedRound, roundNumber: pickedRound === "R1" ? 1 : pickedRound === "R3" ? 3 : 2 } : {}),
      status: s(req.body.status) || before.status,
      decision,
      feedbackTechnical: s(req.body.feedbackTechnical) ?? before.feedbackTechnical,
      feedbackHr: s(req.body.feedbackHr) ?? before.feedbackHr,
      feedbackMgmt: s(req.body.feedbackMgmt) ?? before.feedbackMgmt,
      scoreTechnical: n(req.body.scoreTechnical) ?? before.scoreTechnical,
      scoreCommunication: n(req.body.scoreCommunication) ?? before.scoreCommunication,
      scoreCulture: n(req.body.scoreCulture) ?? before.scoreCulture,
      scoreOverall,
      scorecardJson,
    },
  });

  // Auto-advance candidate to "Selected" if the last decision advance
  if (row.decision === "Advance" && !HIRED_STATUSES.has(before.candidate.status)) {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Interviewed" } });
  } else if (row.decision === "Reject" && !HIRED_STATUSES.has(before.candidate.status)) {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Rejected" } });
  }

  if (scorecardFile) {
    try {
      const filedRound = scorecardRoundId(scorecardFile.scored.round);
      let panelists: string[] = [];
      try {
        const panel = JSON.parse(before.panelJson || "{}");
        const rows = Array.isArray(panel?.interviewers) ? panel.interviewers : [];
        panelists = rows.map((p: { name?: string }) => String(p?.name || "")).filter(Boolean);
      } catch {
        panelists = [];
      }
      const xlsx = await scorecardWorkbook(before.candidate.fullName || "candidate", scorecardFile.scored, {
        interviewDate: before.scheduledAt,
        experienceYears: before.candidate.experienceYears,
        source: before.candidate.sourceChannel,
        panelists,
      });
      const filed = await mockOneDrive.upload(
        HR_DRIVE,
        await recruitmentFolderFor(before.candidateId),
        scorecardShareName(before.candidate.fullName || "candidate", filedRound),
        xlsx,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        { replace: true },
      );
      const withLink = JSON.stringify({
        ...scorecardFile.payload,
        result: scorecardFile.scored,
        sharePointUrl: filed.sharePointUrl || null,
      });
      await prisma.interviewRound.update({ where: { id: row.id }, data: { scorecardJson: withLink } });
      row.scorecardJson = withLink;
    } catch (err) {
      console.warn("[HRMS] scorecard file:", err instanceof Error ? err.message : err);
    }
  }

  await audit("hrms.interview.feedback", { userId: req.user!.id, entity: "InterviewRound", entityId: row.id, meta: { decision: row.decision, score: row.scoreOverall } });
  const candidate = await prisma.candidate.findUnique({
    where: { id: row.candidateId },
    include: { posting: { select: { title: true } } },
  });
  res.json(interviewPublic({ ...row, candidate: candidate || undefined }));
});

/* ═════════════════════════════════════  OFFER LETTER  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/offers", async (_req, res) => {
  const { isPreJoinReadyForAppointmentLetter } = await import("../services/joiningPortal.js");
  await safeHrmList("offers", async () => {
    const rows = await prisma.offer.findMany({
      include: {
        candidate: { select: { fullName: true, email: true, phone: true, location: true } },
        onboard: { select: { userId: true } },
        preJoin: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ preJoin, ...o }) => ({
      ...o,
      appointmentReady: isPreJoinReadyForAppointmentLetter(preJoin),
      appointmentLetterUrl: preJoin?.appointmentLetterUrl || null,
      empCode: preJoin?.empCodeGenerated || null,
    }));
  }, res);
});

hrmRecruitmentRouter.get("/offers/:id", async (req: AuthedRequest, res) => {
  const { canAccessOffer } = await import("../services/joiningPortal.js");
  if (!(await canAccessOffer(req.user!, req.params.id))) {
    return res.status(404).json({ error: "not found" });
  }
  const row = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, preJoin: true, onboard: true },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

/** Fill the SPDC appointment letter from the accepted offer and file it on Drive. */
hrmRecruitmentRouter.post("/offers/:id/appointment-letter", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const { isPreJoinReadyForAppointmentLetter } = await import("../services/joiningPortal.js");
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, preJoin: true, onboard: true },
  });
  if (!offer) return res.status(404).json({ error: "offer not found" });
  if (!isPreJoinReadyForAppointmentLetter(offer.preJoin)) {
    return res.status(400).json({
      error: `Pre-joining is not complete: ${(await import("../services/joiningPortal.js")).missingForAppointmentLetter(offer.preJoin).join("; ")}.`,
    });
  }
  const employeeName = offer.candidate.fullName;
  const { hrLetterRefNo, loadOffer, offerLetterContext } = await import("../services/offerLetters.js");
  const refNo = hrLetterRefNo("OL");
  const full = await loadOffer(offer.id);
  const offerLetter = offer.offerLetterDocId ? await prisma.hrmsDocument.findUnique({ where: { id: offer.offerLetterDocId } }) : null;
  const letter = await prisma.hrmsDocument.create({
    data: {
      kind: "Appointment",
      refNo,
      employeeUserId: offer.onboard?.userId || null,
      employeeName,
      candidateEmail: offer.candidate.email,
      designation: offer.designation,
      department: offer.department,
      effectiveDate: offer.joiningDate,
      status: "Draft",
      createdById: req.user!.id,
      dataJson: JSON.stringify(
        offerLetterContext(full!, {
          appointmentRefNo: refNo,
          offerRefNo: offerLetter?.refNo || offer.offerNo,
          offerDate: offerLetter ? offerLetter.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
        }),
      ),
    },
  });
  const { generateHrmsLetter } = await import("../services/hrmsLetter.js");
  let gen: Awaited<ReturnType<typeof generateHrmsLetter>>;
  try {
    gen = await generateHrmsLetter(letter);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Letter generate failed", letterId: letter.id });
  }
  const updated = await prisma.hrmsDocument.update({
    where: { id: letter.id },
    data: {
      generatedDocxUrl: gen.docxUrl,
      generatedPdfUrl: gen.pdfUrl,
      storagePath: gen.storagePath,
      sharePointUrl: gen.sharePointUrl,
      dataJson: JSON.stringify({
        ...(letter.dataJson ? JSON.parse(letter.dataJson) : {}),
        ...(gen.annexureXlsxUrl ? { annexureXlsxUrl: gen.annexureXlsxUrl } : {}),
      }),
      status: "Generated",
    },
  });
  if (offer.preJoin) {
    await prisma.preJoiningChecklist.update({
      where: { id: offer.preJoin.id },
      data: { appointmentLetterUrl: updated.sharePointUrl || updated.generatedPdfUrl },
    });
  }
  if (offer.onboard?.userId) {
    const fileUrl = updated.sharePointUrl || updated.generatedPdfUrl || "";
    const { attachHrmsLetterToEmployeeVault } = await import("../services/hrmsLetter.js");
    await attachHrmsLetterToEmployeeVault(
      { ...updated, employeeUserId: offer.onboard.userId },
      { fileUrl, storagePath: updated.storagePath, signed: false },
    );
  }
  await audit("hrm.docs.generate", {
    userId: req.user!.id,
    entity: "HrmsDocument",
    entityId: updated.id,
    meta: { kind: "Appointment", offerId: offer.id, refNo },
  });
  res.status(201).json(updated);
});

/** Candidate returns signed appointment — files on letter register + employee HR DMS. */
hrmRecruitmentRouter.post(
  "/offers/:id/signed-appointment",
  requireRoles("admin", "office", "hr"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required (PDF or scan)" });
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { candidate: true, preJoin: true, onboard: true },
    });
    if (!offer) return res.status(404).json({ error: "offer not found" });

    const docs = await prisma.hrmsDocument.findMany({
      where: { kind: "Appointment", candidateEmail: offer.candidate.email || undefined },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    let letter =
      docs.find((d) => {
        try {
          const data = JSON.parse(d.dataJson || "{}");
          return data.offerId === offer.id;
        } catch {
          return false;
        }
      }) || docs[0];

    if (!letter) {
      return res.status(400).json({ error: "Generate the appointment letter first, then upload the signed copy." });
    }

    const safeRef = letter.refNo.replace(/[^a-zA-Z0-9._-]/g, "_");
    let profile = null;
    if (offer.onboard?.userId) {
      profile = await prisma.employeeProfile.findFirst({ where: { userId: offer.onboard.userId } });
    }
    const saved = await mockOneDrive.upload(
      HR_DRIVE,
      employeeLetterFolder(profile?.empCode, offer.candidate.fullName, letter.kind),
      `Appointment-${safeRef}-signed${extOf(req.file)}`,
      req.file.buffer,
    );
    const signedUrl = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}`;

    letter = await prisma.hrmsDocument.update({
      where: { id: letter.id },
      data: {
        uploadedFileUrl: signedUrl,
        sharePointUrl: saved.sharePointUrl || signedUrl,
        storagePath: saved.path,
        status: "Signed",
        employeeUserId: letter.employeeUserId || offer.onboard?.userId || null,
      },
    });

    const { attachHrmsLetterToEmployeeVault } = await import("../services/hrmsLetter.js");
    await attachHrmsLetterToEmployeeVault(letter, {
      fileUrl: signedUrl,
      storagePath: letter.storagePath,
      signed: true,
    });

    if (offer.preJoin) {
      await prisma.preJoiningChecklist.update({
        where: { id: offer.preJoin.id },
        data: { appointmentLetterUrl: signedUrl },
      });
    }

    await audit("hrm.docs.signed_appointment", {
      userId: req.user!.id,
      entity: "HrmsDocument",
      entityId: letter.id,
      meta: { offerId: offer.id, refNo: letter.refNo },
    });
    res.json({ ok: true, letter, signedUrl });
  },
);

/** Offers in hiring / onboarding — for HR employee DMS picker. */
hrmRecruitmentRouter.get("/hiring-pipeline", requireRoles("admin", "office", "hr"), async (_req, res) => {
  const offers = await prisma.offer.findMany({
    where: { status: { in: ["Accepted", "Onboarding", "Joined"] } },
    include: {
      candidate: { select: { fullName: true, email: true } },
      onboard: { select: { userId: true } },
      preJoin: { select: { appointmentLetterUrl: true, empCodeGenerated: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  res.json(offers);
});

hrmRecruitmentRouter.post("/offers", requireRoles("admin", "office", "hr"), upload.single("letter"), async (req: AuthedRequest, res) => {
  const candidateId = String(req.body.candidateId);
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return res.status(400).json({ error: "candidateId required / not found" });

  let offerLetterUrl: string | undefined;
  const joiningFolder = employeeLetterFolder(null, candidate.fullName, "Offer");
  if (req.file) {
    const saved = await mockOneDrive.upload(
      HR_DRIVE,
      joiningFolder,
      `offer-${candidate.fullName.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}${extOf(req.file)}`,
      req.file.buffer
    );
    offerLetterUrl = saved.url || `/uploads/onedrive/GLOBAL/${saved.path}`;
  }

  // 12-input CTC calculator payload: HR passes ctcInputsJson to auto-generate
  // Annexure I and persist the inputs so it can be re-computed on demand.
  let ctcInputsJson: string | undefined;
  let annexureUrl: string | undefined;
  let derivedCtc = Number(req.body.ctcAnnual || 0);
  let derivedBasicMonthly: number | null = n(req.body.basicMonthly);
  let derivedHraMonthly: number | null = n(req.body.hraMonthly);
  let derivedOtherMonthly: number | null = n(req.body.otherAllowMonthly);
  let derivedVarPct: number | null = n(req.body.variablePayPct);
  const { ctcInputsFrom, cleanLetterFields, generateOfferLetter } = await import("../services/offerLetters.js");
  const rawInputs =
    req.body.ctcInputsJson ||
    (Number(req.body.ctcAnnual) > 0
      ? JSON.stringify(ctcInputsFrom(null, { candidateName: candidate.fullName, designation: s(req.body.designation) || "Executive", fixedCtcAnnual: Number(req.body.ctcAnnual) }))
      : null);
  if (rawInputs) {
    try {
      const parsed = typeof rawInputs === "string" ? JSON.parse(rawInputs) : rawInputs;
      const inputs: CtcInputs = {
        candidateName: String(parsed.candidateName || candidate.fullName),
        designation: String(parsed.designation || req.body.designation || "Executive"),
        fixedCtcAnnual: Number(parsed.fixedCtcAnnual || parsed.fixedCtcAnnual || 0),
        basicPctOfGross: Number(parsed.basicPctOfGross ?? DEFAULT_CTC_INPUTS.basicPctOfGross),
        hraPctOfBasic: Number(parsed.hraPctOfBasic ?? DEFAULT_CTC_INPUTS.hraPctOfBasic),
        restrictPfCeiling: Boolean(parsed.restrictPfCeiling ?? DEFAULT_CTC_INPUTS.restrictPfCeiling),
        gratuityPctOfBasic: Number(parsed.gratuityPctOfBasic ?? DEFAULT_CTC_INPUTS.gratuityPctOfBasic),
        ltaPctOfBasic: Number(parsed.ltaPctOfBasic ?? DEFAULT_CTC_INPUTS.ltaPctOfBasic),
        conveyanceAnnual: Number(parsed.conveyanceAnnual ?? DEFAULT_CTC_INPUTS.conveyanceAnnual),
        childrenEducationAnnual: Number(parsed.childrenEducationAnnual ?? DEFAULT_CTC_INPUTS.childrenEducationAnnual),
        mediclaimAnnual: Number(parsed.mediclaimAnnual ?? DEFAULT_CTC_INPUTS.mediclaimAnnual),
        performancePayPct: Number(parsed.performancePayPct ?? DEFAULT_CTC_INPUTS.performancePayPct),
        professionalTaxAnnual: Number(parsed.professionalTaxAnnual ?? DEFAULT_CTC_INPUTS.professionalTaxAnnual),
      };
      if (inputs.fixedCtcAnnual > 0) {
        const breakdown = computeCtcBreakdown(inputs);
        derivedCtc = inputs.fixedCtcAnnual;
        derivedBasicMonthly = breakdown.partA.rows[0].perMonth as number;
        derivedHraMonthly = breakdown.partA.rows[1].perMonth as number;
        // Other allowance monthly = conveyance + children + LTA + special
        derivedOtherMonthly =
          (breakdown.partA.rows[2].perMonth as number) +
          (breakdown.partA.rows[3].perMonth as number) +
          (breakdown.partA.rows[4].perMonth as number) +
          (breakdown.partA.rows[5].perMonth as number);
        derivedVarPct = inputs.performancePayPct * 100;
        ctcInputsJson = JSON.stringify(inputs);

        const xlsx = await buildAnnexureXlsx(breakdown);
        const savedAnnex = await mockOneDrive.upload(
          HR_DRIVE,
          joiningFolder,
          `Sharnam-Annexure-I-${candidate.fullName.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.xlsx`,
          xlsx
        );
        annexureUrl = savedAnnex.url || `/uploads/onedrive/GLOBAL/${savedAnnex.path}`;
      }
    } catch (err) {
      console.warn("[offers] ctcInputsJson invalid — offer created without Annexure I", err);
    }
  }

  const row = await prisma.offer.create({
    data: {
      candidateId,
      offerNo: s(req.body.offerNo) || `OFR-${Date.now()}`,
      designation: s(req.body.designation) || "Executive",
      department: s(req.body.department),
      ctcAnnual: derivedCtc,
      basicMonthly: derivedBasicMonthly,
      hraMonthly: derivedHraMonthly,
      otherAllowMonthly: derivedOtherMonthly,
      variablePayPct: derivedVarPct,
      joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : null,
      probationMonths: req.body.probationMonths !== undefined ? Number(req.body.probationMonths) : 6,
      location: s(req.body.location),
      reportingManager: s(req.body.reportingManager),
      offerLetterUrl,
      ctcInputsJson,
      annexureUrl,
      letterFieldsJson: JSON.stringify(cleanLetterFields(req.body.letterFieldsJson)),
      notes: s(req.body.notes),
      status: "Draft",
    },
  });
  await prisma.candidate.update({ where: { id: candidateId }, data: { status: "Selected" } });
  await audit("hrms.offer.create", { userId: req.user!.id, entity: "Offer", entityId: row.id, meta: { candidateId, offerNo: row.offerNo, ctc: row.ctcAnnual } });
  // The SPDC offer letter is generated from what was just filled in (uploaded PDF, if any, stays as well).
  let letterError: string | null = null;
  if (!req.file) {
    try {
      await generateOfferLetter(row.id, req.user!.id);
    } catch (err) {
      letterError = err instanceof Error ? err.message : "Offer letter could not be generated";
    }
  }
  const fresh = await prisma.offer.findUnique({ where: { id: row.id } });
  res.status(201).json({ ...fresh, letterError });
});

/**
 * Live 12-input CTC calculator — HR types values in the offer form and gets
 * the full Parts A/B/C breakdown back without saving anything.  Used by the
 * "Preview" button on the OffersTab.
 */
hrmRecruitmentRouter.post("/ctc/compute", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  try {
    const b = req.body || {};
    const inputs: CtcInputs = {
      candidateName: String(b.candidateName || "Candidate"),
      designation: String(b.designation || "Executive"),
      fixedCtcAnnual: Number(b.fixedCtcAnnual || 0),
      basicPctOfGross: Number(b.basicPctOfGross ?? DEFAULT_CTC_INPUTS.basicPctOfGross),
      hraPctOfBasic: Number(b.hraPctOfBasic ?? DEFAULT_CTC_INPUTS.hraPctOfBasic),
      restrictPfCeiling: Boolean(b.restrictPfCeiling ?? DEFAULT_CTC_INPUTS.restrictPfCeiling),
      gratuityPctOfBasic: Number(b.gratuityPctOfBasic ?? DEFAULT_CTC_INPUTS.gratuityPctOfBasic),
      ltaPctOfBasic: Number(b.ltaPctOfBasic ?? DEFAULT_CTC_INPUTS.ltaPctOfBasic),
      conveyanceAnnual: Number(b.conveyanceAnnual ?? DEFAULT_CTC_INPUTS.conveyanceAnnual),
      childrenEducationAnnual: Number(b.childrenEducationAnnual ?? DEFAULT_CTC_INPUTS.childrenEducationAnnual),
      mediclaimAnnual: Number(b.mediclaimAnnual ?? DEFAULT_CTC_INPUTS.mediclaimAnnual),
      performancePayPct: Number(b.performancePayPct ?? DEFAULT_CTC_INPUTS.performancePayPct),
      professionalTaxAnnual: Number(b.professionalTaxAnnual ?? DEFAULT_CTC_INPUTS.professionalTaxAnnual),
    };
    if (!(inputs.fixedCtcAnnual > 0)) {
      return res.status(400).json({ error: "fixedCtcAnnual must be > 0" });
    }
    res.json(computeCtcBreakdown(inputs));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "compute failed" });
  }
});

type AnnexureLoad =
  | { ok: true; breakdown: ReturnType<typeof computeCtcBreakdown> }
  | { ok: false; error: string; status: 400 | 404 };

async function loadOfferForAnnexure(id: string): Promise<AnnexureLoad> {
  const offer = await prisma.offer.findUnique({ where: { id }, include: { candidate: true } });
  if (!offer) return { ok: false, error: "offer not found", status: 404 };
  if (!offer.ctcInputsJson) return { ok: false, error: "offer has no CTC inputs — draft the offer with the calculator first", status: 400 };
  const inputs = JSON.parse(offer.ctcInputsJson) as CtcInputs;
  inputs.candidateName = inputs.candidateName || offer.candidate?.fullName || "Candidate";
  inputs.designation = inputs.designation || offer.designation;
  return { ok: true, breakdown: computeCtcBreakdown(inputs) };
}

hrmRecruitmentRouter.get("/offers/:id/annexure.html", async (req, res) => {
  const out = await loadOfferForAnnexure(req.params.id);
  if (!out.ok) return res.status(out.status).json({ error: out.error });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildAnnexureHtml(out.breakdown));
});

hrmRecruitmentRouter.get("/offers/:id/annexure.xlsx", async (req, res) => {
  const out = await loadOfferForAnnexure(req.params.id);
  if (!out.ok) return res.status(out.status).json({ error: out.error });
  const buf = await buildAnnexureXlsx(out.breakdown);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Sharnam-Annexure-I-${out.breakdown.inputs.candidateName.replace(/[^\w.-]+/g, "_")}.xlsx"`
  );
  res.send(buf);
});

/** (Re)generate the SPDC Offer Letter from the offer row. */
hrmRecruitmentRouter.post("/offers/:id/offer-letter", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const { generateOfferLetter } = await import("../services/offerLetters.js");
  const letter = await generateOfferLetter(req.params.id, req.user!.id);
  await audit("hrm.docs.generate", { userId: req.user!.id, entity: "HrmsDocument", entityId: letter.id, meta: { kind: "Offer", offerId: req.params.id } });
  res.status(201).json(letter);
});

/** Edit a draft offer (terms, CTC inputs, letter fields); re-generates the letter. */
hrmRecruitmentRouter.put("/offers/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { candidate: true } });
  if (!before) return res.status(404).json({ error: "not found" });
  if (!["Draft", "Approved"].includes(before.status)) {
    return res.status(400).json({ error: `This offer is ${before.status}. Only draft offers can be edited — withdraw it and draft a new one.` });
  }
  const { ctcInputsFrom, cleanLetterFields, generateOfferLetter } = await import("../services/offerLetters.js");
  const { computeCtcBreakdown } = await import("../services/ctcAnnexure.js");
  const designation = s(req.body.designation) || before.designation;
  const inputs = ctcInputsFrom(req.body.ctcInputsJson ?? before.ctcInputsJson, {
    candidateName: before.candidate.fullName,
    designation,
    fixedCtcAnnual: Number(req.body.ctcAnnual || before.ctcAnnual),
  });
  const b = inputs ? computeCtcBreakdown(inputs) : null;
  await prisma.offer.update({
    where: { id: before.id },
    data: {
      designation,
      department: req.body.department !== undefined ? s(req.body.department) : before.department,
      joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : before.joiningDate,
      probationMonths: req.body.probationMonths !== undefined ? Number(req.body.probationMonths) || 6 : before.probationMonths,
      location: req.body.location !== undefined ? s(req.body.location) : before.location,
      reportingManager: req.body.reportingManager !== undefined ? s(req.body.reportingManager) : before.reportingManager,
      notes: req.body.notes !== undefined ? s(req.body.notes) : before.notes,
      ...(inputs && b
        ? {
            ctcAnnual: inputs.fixedCtcAnnual,
            ctcInputsJson: JSON.stringify(inputs),
            basicMonthly: Number(b.partA.rows[0].perMonth),
            hraMonthly: Number(b.partA.rows[1].perMonth),
            variablePayPct: inputs.performancePayPct * 100,
          }
        : {}),
      ...(req.body.letterFieldsJson !== undefined ? { letterFieldsJson: JSON.stringify(cleanLetterFields(req.body.letterFieldsJson)) } : {}),
    },
  });
  let letterError: string | null = null;
  try {
    await generateOfferLetter(before.id, req.user!.id);
  } catch (err) {
    letterError = err instanceof Error ? err.message : "Offer letter could not be generated";
  }
  await audit("hrms.offer.update", { userId: req.user!.id, entity: "Offer", entityId: before.id });
  res.json({ ...(await prisma.offer.findUnique({ where: { id: before.id } })), letterError });
});

/** Accepted offer → staff login managed from HRMS · Users (one-time password returned once). */
hrmRecruitmentRouter.post("/offers/:id/portal-login", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const { createPortalLoginForOffer } = await import("../services/offerLetters.js");
  const out = await createPortalLoginForOffer(req.params.id);
  await audit("hrms.offer.portal_login", { userId: req.user!.id, entity: "User", entityId: out.userId, meta: { offerId: req.params.id, created: out.created } });
  res.status(out.created ? 201 : 200).json(out);
});

hrmRecruitmentRouter.patch("/offers/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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

  if (nextStatus === "Sent") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Offered" } });
  }
  if (nextStatus === "Accepted") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Accepted" } });
    await prisma.preJoiningChecklist.upsert({
      where: { offerId: row.id },
      create: { offerId: row.id },
      update: {},
    });
    await prisma.onboardingChecklist.upsert({
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

hrmRecruitmentRouter.get("/my-joining", async (req: AuthedRequest, res) => {
  const { findActiveJoiningForUser, isPreJoinComplete } = await import("../services/joiningPortal.js");
  const offer = await findActiveJoiningForUser(req.user!.id, req.user!.email);
  if (!offer) return res.json(null);
  res.json({
    offerId: offer.id,
    offerNo: offer.offerNo,
    designation: offer.designation,
    joiningDate: offer.joiningDate,
    status: offer.status,
    preJoinComplete: isPreJoinComplete(offer.preJoin),
    candidateName: offer.candidate.fullName,
  });
});

/** Fill a blank checklist from the staff record so every joinee opens the same way. */
async function hydratePreJoin(offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { candidate: true, onboard: true },
  });
  if (!offer) return null;
  const email = (offer.candidate.email || "").trim().toLowerCase();
  const staff = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const profile = staff ? await prisma.employeeProfile.findUnique({ where: { userId: staff.id } }) : null;
  const linkedUserId = offer.onboard?.userId || staff?.id || null;
  if (linkedUserId) {
    await prisma.onboardingChecklist.upsert({
      where: { offerId },
      create: { offerId, userId: linkedUserId },
      update: { userId: linkedUserId },
    });
  }
  const appointment = await prisma.hrmsDocument.findFirst({
    where: {
      kind: "Appointment",
      OR: [
        ...(staff ? [{ employeeUserId: staff.id }] : []),
        { employeeName: offer.candidate.fullName },
        ...(email ? [{ candidateEmail: email }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const existing = await prisma.preJoiningChecklist.upsert({
    where: { offerId },
    create: { offerId },
    update: {},
  });
  const data: Record<string, unknown> = {};
  if (!existing.empCodeGenerated && profile?.empCode) data.empCodeGenerated = profile.empCode;
  if (!existing.emailAddress && (staff?.email || email)) {
    data.emailAddress = staff?.email || email;
    data.emailCreated = true;
  }
  const letterUrl = appointment?.sharePointUrl || appointment?.generatedDocxUrl || "";
  if (!existing.appointmentLetterUrl && letterUrl) data.appointmentLetterUrl = letterUrl;
  if (!existing.docCollectionDone) {
    const docs = await prisma.candidateDocument.count({ where: { candidateId: offer.candidateId } });
    if (docs > 0) {
      data.docCollectionDone = true;
      data.docCollectionAt = new Date();
    }
  }
  const row = Object.keys(data).length
    ? await prisma.preJoiningChecklist.update({ where: { id: existing.id }, data })
    : existing;
  if (linkedUserId) await mirrorCandidateDocsToStaff(offer.candidateId, linkedUserId);
  // SharePoint copies must not block opening the checklist (that was hanging the Onboarding page).
  void ensurePersonRecords(offer.candidateId).catch((err) => {
    pushRuntimeLog({
      level: "error",
      source: "hrm.files",
      message: "Could not file this person's documents into the requisition and employee folders",
      detail: errorDetail(err),
    });
  });
  const candidateDocuments = await prisma.candidateDocument.findMany({
    where: { candidateId: offer.candidateId },
    orderBy: { createdAt: "desc" },
  });
  return { ...row, linkedUserId, candidateDocuments };
}

hrmRecruitmentRouter.get("/pre-joining/:offerId", async (req: AuthedRequest, res) => {
  const { canAccessOffer } = await import("../services/joiningPortal.js");
  if (!(await canAccessOffer(req.user!, req.params.offerId))) {
    return res.status(404).json({ error: "not found" });
  }
  const row = await hydratePreJoin(req.params.offerId);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

hrmRecruitmentRouter.patch("/pre-joining/:offerId", async (req: AuthedRequest, res) => {
  const { canAccessOffer, isHrOfferManager, splitPreJoinPatch } = await import("../services/joiningPortal.js");
  if (!(await canAccessOffer(req.user!, req.params.offerId))) {
    return res.status(404).json({ error: "not found" });
  }
  const asHr = isHrOfferManager(req.user!);
  const patch = splitPreJoinPatch(req.body as Record<string, unknown>, asHr);
  if (!Object.keys(patch).length) {
    return res.status(403).json({ error: asHr ? "No valid fields" : "You can only update document collection and IT / ID requests" });
  }
  const existing = await prisma.preJoiningChecklist.upsert({
    where: { offerId: req.params.offerId },
    create: { offerId: req.params.offerId },
    update: {},
  });
  const row = await prisma.preJoiningChecklist.update({
    where: { id: existing.id },
    data: {
      empCodeGenerated: s(patch.empCodeGenerated as string) ?? existing.empCodeGenerated,
      appointmentLetterUrl: s(patch.appointmentLetterUrl as string) ?? existing.appointmentLetterUrl,
      docCollectionDone:
        patch.docCollectionDone !== undefined ? !!patch.docCollectionDone : existing.docCollectionDone,
      docCollectionAt:
        patch.docCollectionDone && !existing.docCollectionAt ? new Date() : existing.docCollectionAt,
      bgvStatus: s(patch.bgvStatus as string) ?? existing.bgvStatus,
      bgvAt: patch.bgvStatus === "Cleared" && !existing.bgvAt ? new Date() : existing.bgvAt,
      medicalStatus: s(patch.medicalStatus as string) ?? existing.medicalStatus,
      medicalAt: patch.medicalStatus === "Cleared" && !existing.medicalAt ? new Date() : existing.medicalAt,
      itAssetRequested:
        patch.itAssetRequested !== undefined ? !!patch.itAssetRequested : existing.itAssetRequested,
      itAssetIssuedAt: patch.itAssetIssued && !existing.itAssetIssuedAt ? new Date() : existing.itAssetIssuedAt,
      itAssetDetails: s(patch.itAssetDetails as string) ?? existing.itAssetDetails,
      emailCreated: patch.emailCreated !== undefined ? !!patch.emailCreated : existing.emailCreated,
      emailCreatedAt: patch.emailCreated && !existing.emailCreatedAt ? new Date() : existing.emailCreatedAt,
      emailAddress: s(patch.emailAddress as string) ?? existing.emailAddress,
      idCardRequested:
        patch.idCardRequested !== undefined ? !!patch.idCardRequested : existing.idCardRequested,
      idCardIssuedAt: patch.idCardIssued && !existing.idCardIssuedAt ? new Date() : existing.idCardIssuedAt,
      welcomeKitPrepared:
        patch.welcomeKitPrepared !== undefined ? !!patch.welcomeKitPrepared : existing.welcomeKitPrepared,
      welcomeKitAt: patch.welcomeKitPrepared && !existing.welcomeKitAt ? new Date() : existing.welcomeKitAt,
      notes: s(patch.notes as string) ?? existing.notes,
    },
  });
  await audit("hrms.preJoining.update", { userId: req.user!.id, entity: "PreJoiningChecklist", entityId: row.id });
  res.json(row);
});

hrmRecruitmentRouter.post(
  "/pre-joining/:offerId/documents",
  upload.array("files", 8),
  async (req: AuthedRequest, res) => {
    const { canAccessOffer } = await import("../services/joiningPortal.js");
    if (!(await canAccessOffer(req.user!, req.params.offerId))) {
      return res.status(404).json({ error: "not found" });
    }
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.offerId },
      include: { candidate: true, onboard: true },
    });
    if (!offer) return res.status(404).json({ error: "not found" });
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) return res.status(400).json({ error: "Upload at least one file" });
    const category = String(req.body.category || "Pre-join");
    let userId = offer.onboard?.userId || null;
    if (!userId && offer.candidate?.email) {
      const linked = await prisma.user.findUnique({
        where: { email: offer.candidate.email.trim().toLowerCase() },
        select: { id: true },
      });
      userId = linked?.id || null;
      if (userId) {
        await prisma.onboardingChecklist.upsert({
          where: { offerId: offer.id },
          create: { offerId: offer.id, userId },
          update: { userId },
        });
      }
    }
    if (!userId) {
      return res.status(400).json({
        error: "No staff login linked to this offer. Create or assign the employee in HR → Users before filing pre-join documents.",
      });
    }

    const {
      employeeVaultRelPath,
      vaultSubfolderForCategory,
      vaultFileNameForUpload,
      ensureEmployeeVault,
    } = await import("../services/hrEmployeeVault.js");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "employee not found" });
    const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
    await ensureEmployeeVault({ userId, fullName: user.fullName, email: user.email, profile });
    const vaultRel = employeeVaultRelPath(profile, user.fullName);
    const subfolder = vaultSubfolderForCategory(category);
    const recruitFolder = await recruitmentFolderFor(offer.candidateId);
    const created = [];
    for (const file of files) {
      const safeName = vaultFileNameForUpload({
        category,
        profile,
        fullName: user.fullName,
        originalName: file.originalname,
      });
      const saved = await mockOneDrive.upload(HR_DRIVE, `${vaultRel}/${subfolder}`, safeName, file.buffer, file.mimetype, { replace: true });
      await mockOneDrive.upload(HR_DRIVE, recruitFolder, safeName, file.buffer, file.mimetype, { replace: true });
      const url = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}`;
      await prisma.candidateDocument.create({
        data: {
          candidateId: offer.candidateId,
          category,
          title: file.originalname || category,
          fileUrl: url,
          storagePath: saved.sharePointPath || saved.path,
        },
      });
      created.push(
        await prisma.employeeDocument.create({
          data: {
            userId,
            category,
            title: file.originalname || category,
            fileUrl: url,
            storagePath: saved.sharePointPath || saved.path,
            issuedOn: new Date(),
          },
        })
      );
    }
    res.status(201).json({ uploaded: created.length, documents: created });
  }
);

/* ═════════════════════════════════════  ONBOARDING  ═════════════════════════════════════ */

async function fileHrPolicyAcknowledgement(offerId: string, actorUserId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { candidate: true, onboard: true },
  });
  if (!offer) return null;
  const onboard = await prisma.onboardingChecklist.upsert({
    where: { offerId: offer.id },
    create: { offerId: offer.id, hrPolicyAcknowledged: true },
    update: { hrPolicyAcknowledged: true },
  });
  const stamps = JSON.parse(onboard.itemsCompletedAtJson || "{}") as Record<string, string>;
  stamps.hrPolicyAcknowledged = stamps.hrPolicyAcknowledged || new Date().toISOString();
  const { renderHrPolicyAcknowledgement } = await import("../services/hrmsLetter.js");
  const ackDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const html = renderHrPolicyAcknowledgement({
    employeeName: offer.candidate.fullName,
    designation: offer.designation || "",
    department: offer.department || "",
    joinDate: offer.joiningDate
      ? offer.joiningDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
      : "",
    acknowledgedAt: ackDate,
  });
  let profile = null;
  if (onboard.userId) {
    profile = await prisma.employeeProfile.findFirst({ where: { userId: onboard.userId } });
  }
  const folder = employeeLetterFolder(profile?.empCode, offer.candidate.fullName, "joining");
  const saved = await mockOneDrive.upload(
    HR_DRIVE,
    folder,
    `HR-Policy-Acknowledgement.html`,
    Buffer.from(html, "utf8"),
    "text/html; charset=utf-8",
    { replace: true },
  );
  const url = saved.sharePointUrl || saved.url;
  stamps._hrPolicyUrl = url;
  stamps._hrPolicyFolder = folder;
  await prisma.onboardingChecklist.update({
    where: { id: onboard.id },
    data: { hrPolicyAcknowledged: true, itemsCompletedAtJson: JSON.stringify(stamps) },
  });
  if (onboard.userId) {
    const existing = await prisma.employeeDocument.findFirst({
      where: { userId: onboard.userId, title: "HR Policy Acknowledgement" },
    });
    const doc = {
      fileUrl: url,
      storagePath: saved.sharePointPath || saved.path,
      issuedOn: new Date(),
    };
    if (existing) {
      await prisma.employeeDocument.update({ where: { id: existing.id }, data: doc });
    } else {
      await prisma.employeeDocument.create({
        data: {
          userId: onboard.userId,
          category: "Other",
          title: "HR Policy Acknowledgement",
          ...doc,
        },
      });
    }
  }
  await audit("hrms.onboarding.hr_policy", {
    userId: actorUserId,
    entity: "OnboardingChecklist",
    entityId: onboard.id,
    meta: { offerId: offer.id, path: saved.path, name: offer.candidate.fullName },
  });
  return { ok: true as const, acknowledged: true as const, url, folder, employeeName: offer.candidate.fullName, html };
}

hrmRecruitmentRouter.get("/onboarding/:offerId", async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.offerId } });
  if (!offer) return res.status(404).json({ error: "not found" });
  const row = await prisma.onboardingChecklist.upsert({
    where: { offerId: req.params.offerId },
    create: { offerId: req.params.offerId },
    update: {},
    include: { offer: { include: { candidate: true } } },
  });
  res.json({ ...row, itemsCompletedAt: JSON.parse(row.itemsCompletedAtJson || "{}") });
});

hrmRecruitmentRouter.patch("/onboarding/:offerId", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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

hrmRecruitmentRouter.get("/onboarding/:offerId/hr-policy", async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.offerId },
    include: { candidate: true, onboard: true },
  });
  if (!offer) return res.status(404).json({ error: "not found" });
  const { renderHrPolicyAcknowledgement } = await import("../services/hrmsLetter.js");
  const html = renderHrPolicyAcknowledgement({
    employeeName: offer.candidate.fullName,
    designation: offer.designation || "",
    department: offer.department || "",
    joinDate: offer.joiningDate ? offer.joiningDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "",
    acknowledgedAt: offer.onboard?.hrPolicyAcknowledged ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "",
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

hrmRecruitmentRouter.post("/onboarding/:offerId/hr-policy", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const filed = await fileHrPolicyAcknowledgement(req.params.offerId, req.user!.id);
  if (!filed) return res.status(404).json({ error: "not found" });
  res.json({
    ok: filed.ok,
    acknowledged: filed.acknowledged,
    url: filed.url,
    folder: filed.folder,
    employeeName: filed.employeeName,
  });
});

/* ═════════════════════════════════════  PAY HIKE  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/pay-hikes", async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  await safeHrmList("pay hikes", async () => {
    const rows = await prisma.payHike.findMany({
      where: userId ? { userId } : {},
      orderBy: { effectiveDate: "desc" },
    });
    return attachStaffNames(rows);
  }, res);
});

async function hikeLines(userId: string, newCtc: number) {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  const lines = newCtc > 0 ? ctcMonthlyEarnings(newCtc, profile?.designation || "") : null;
  return { profile, lines };
}

async function writeHikeOntoEmployee(row: { userId: string; newCtcAnnual: number; newBasicMonthly: number | null; newHraMonthly: number | null }) {
  const { lines } = await hikeLines(row.userId, row.newCtcAnnual);
  await prisma.employeeProfile.updateMany({
    where: { userId: row.userId },
    data: {
      ctcAnnual: row.newCtcAnnual,
      basicMonthly: row.newBasicMonthly || lines?.basic || undefined,
      hraMonthly: row.newHraMonthly || lines?.hra || undefined,
    },
  });
}

hrmRecruitmentRouter.post("/pay-hikes", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const userId = String(req.body.userId || "");
  const { profile, lines } = await hikeLines(userId, Number(req.body.newCtcAnnual || 0));
  const oldCtc = Number(req.body.oldCtcAnnual || profile?.ctcAnnual || 0);
  const newCtc = Number(req.body.newCtcAnnual || 0);
  const hikePercent = oldCtc > 0 ? ((newCtc - oldCtc) / oldCtc) * 100 : 0;
  const row = await prisma.payHike.create({
    data: {
      userId,
      effectiveDate: new Date(req.body.effectiveDate || Date.now()),
      oldCtcAnnual: oldCtc,
      newCtcAnnual: newCtc,
      hikePercent,
      oldBasicMonthly: n(req.body.oldBasicMonthly) ?? profile?.basicMonthly ?? null,
      newBasicMonthly: n(req.body.newBasicMonthly) ?? lines?.basic ?? null,
      oldHraMonthly: n(req.body.oldHraMonthly) ?? profile?.hraMonthly ?? null,
      newHraMonthly: n(req.body.newHraMonthly) ?? lines?.hra ?? null,
      reason: s(req.body.reason),
      performanceRating: s(req.body.performanceRating),
      status: "Submitted",
    },
  });
  await audit("hrms.payHike.submit", { userId: req.user!.id, entity: "PayHike", entityId: row.id, meta: { targetUserId: row.userId, oldCtc, newCtc, hikePercent } });
  res.status(201).json(row);
});

hrmRecruitmentRouter.patch("/pay-hikes/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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

  const writesPay = nextStatus === "Approved" || nextStatus === "Applied";
  const alreadyWritten = before.status === "Approved" || before.status === "Applied";
  if (writesPay && !alreadyWritten) {
    await writeHikeOntoEmployee(row);
  }

  await audit(isApproving ? "hrms.payHike.approve" : `hrms.payHike.${nextStatus.toLowerCase()}`, { userId: req.user!.id, entity: "PayHike", entityId: row.id });
  res.json(row);
});

/* ═════════════════════════════════════  PAYSLIP  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/payslips", async (req: AuthedRequest, res) => {
  const isAdmin = ["admin", "office", "hr"].includes(req.user!.role);
  const filters: Record<string, unknown> = {};
  if (req.query.year) filters.year = Number(req.query.year);
  if (req.query.month) filters.month = Number(req.query.month);
  if (!isAdmin || req.query.userId) filters.userId = String(req.query.userId || req.user!.id);
  const rows = await prisma.payslip.findMany({ where: filters, orderBy: [{ year: "desc" }, { month: "desc" }] });
  res.json(await attachStaffNames(rows));
});

/**
 * Generate payslip from EmployeeProfile CTC breakdown + paid-days.
 * Simple compute: monthly earnings from profile; deductions computed from statutory %.
 * Client can override any value on the returned draft before finalising.
 */
async function computeAndUpsertPayslip(
  reqUserId: string,
  userId: string,
  year: number,
  month: number,
  workingDays: number,
  lopDays: number,
  incomeTax: number,
  overrides?: Record<string, number>
) {
  const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
  if (!profile) throw new Error("employee profile not found");
  const paidDays = Math.max(0, workingDays - lopDays);
  const factor = workingDays > 0 ? paidDays / workingDays : 1;
  const fromCtc = profile.ctcAnnual ? ctcMonthlyEarnings(profile.ctcAnnual, profile.designation || "") : null;
  if (fromCtc) {
    await prisma.employeeProfile.update({
      where: { userId },
      data: { basicMonthly: fromCtc.basic, hraMonthly: fromCtc.hra },
    });
  }
  const scale = (full: number) => Math.round(full * factor);
  const basic = overrides?.basic ?? (fromCtc ? scale(fromCtc.basic) : (profile.basicMonthly || 0) * factor);
  const hra = overrides?.hra ?? (fromCtc ? scale(fromCtc.hra) : (profile.hraMonthly || basic * 0.4) * factor);
  const conveyance = overrides?.conveyance ?? (fromCtc ? scale(fromCtc.conveyance) : 1600 * factor);
  const medicalAllow = overrides?.medicalAllow ?? (fromCtc ? 0 : 1250 * factor);
  const specialAllow =
    overrides?.specialAllow ??
    (fromCtc
      ? Math.max(0, scale(fromCtc.gross) - basic - hra - conveyance - medicalAllow)
      : Math.max(0, (profile.ctcAnnual ? profile.ctcAnnual / 12 : 0) * factor - basic - hra - conveyance - medicalAllow));
  const otherEarnings = overrides?.otherEarnings ?? 0;
  const gross = basic + hra + conveyance + medicalAllow + specialAllow + otherEarnings;
  const pfEmployee = overrides?.pfEmployee ?? (fromCtc ? scale(fromCtc.pfEmployee) : Math.min(basic, 15000) * 0.12);
  const esicEmployee = overrides?.esicEmployee ?? (fromCtc ? (fromCtc.esicEmployee > 0 ? scale(fromCtc.esicEmployee) : 0) : gross <= 21000 ? gross * 0.0075 : 0);
  const professionalTax = overrides?.professionalTax ?? (fromCtc ? (paidDays > 0 ? fromCtc.professionalTax : 0) : 200);
  const otherDeduction = overrides?.otherDeduction ?? 0;
  const tds = overrides?.incomeTax ?? incomeTax;
  const totalDeductions = pfEmployee + esicEmployee + professionalTax + tds + otherDeduction;
  const netPay = gross - totalDeductions;
  return prisma.payslip.upsert({
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
      otherEarnings,
      grossEarnings: gross,
      pfEmployee,
      esicEmployee,
      professionalTax,
      incomeTax: tds,
      otherDeduction,
      totalDeductions,
      netPay,
      status: "Generated",
      generatedById: reqUserId,
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
      otherEarnings,
      grossEarnings: gross,
      pfEmployee,
      esicEmployee,
      professionalTax,
      incomeTax: tds,
      otherDeduction,
      totalDeductions,
      netPay,
      status: "Generated",
      generatedById: reqUserId,
      generatedAt: new Date(),
    },
  });
}

/**
 * Paid days for one person in a month from attendance + leave + holidays.
 * Present (not rejected) days, approved paid leave, Sundays and holidays are paid; the rest is loss of pay.
 * With no punches at all in the month the person is paid the full month and flagged for HR review.
 */
async function attendanceDaysForMonth(userId: string, year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const daysInMonth = last.getDate();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [att, leaves, holidays] = await Promise.all([
    prisma.attendance.findMany({ where: { userId, date: { gte: first, lte: new Date(year, month - 1, daysInMonth, 23, 59, 59) } } }),
    prisma.leaveRequest.findMany({ where: { userId, status: "Approved", fromDate: { lte: last }, toDate: { gte: first } } }),
    prisma.holiday.findMany({ where: { date: { gte: first, lte: new Date(year, month - 1, daysInMonth, 23, 59, 59) }, isOptional: false } }),
  ]);
  const leaveTypes = await prisma.leaveType.findMany({ select: { id: true, isPaid: true } });
  const paidType = new Map(leaveTypes.map((t) => [t.id, t.isPaid]));
  const holidaySet = new Set(holidays.map((h) => key(h.date)));
  const present = new Set(att.filter((a) => a.checkIn && a.reviewStatus !== "Rejected").map((a) => key(a.date)));
  const leaveDay = new Map<string, number>(); // day → paid fraction (1 / 0.5) or -1 for unpaid
  for (const l of leaves) {
    for (let d = new Date(Math.max(l.fromDate.getTime(), first.getTime())); d <= l.toDate && d <= last; d.setDate(d.getDate() + 1)) {
      const k = key(d);
      const paid = l.leaveTypeId ? paidType.get(l.leaveTypeId) !== false : true;
      leaveDay.set(k, paid ? (l.halfDay ? 0.5 : 1) : -1);
    }
  }
  let paid = 0;
  let presentDays = 0;
  let paidLeaveDays = 0;
  let offDays = 0;
  const today = new Date();
  const todayKey = key(today);
  let futureDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const k = key(d);
    if (k > todayKey) {
      // Month not finished: days still to come are not loss of pay.
      paid += 1;
      futureDays += 1;
      continue;
    }
    if (d.getDay() === 0 || holidaySet.has(k)) {
      paid += 1;
      offDays += 1;
      continue;
    }
    if (present.has(k)) {
      paid += 1;
      presentDays += 1;
      continue;
    }
    const lv = leaveDay.get(k);
    if (lv && lv > 0) {
      paid += lv;
      paidLeaveDays += lv;
    }
  }
  const hasAttendance = att.length > 0;
  const paidDays = hasAttendance ? Math.min(daysInMonth, paid) : daysInMonth;
  return {
    daysInMonth,
    presentDays,
    paidLeaveDays,
    offDays,
    paidDays,
    lopDays: Math.max(0, Math.round((daysInMonth - paidDays) * 2) / 2),
    hasAttendance,
    futureDays,
    needsReview: att.filter((a) => a.reviewStatus === "Needs review").length,
  };
}

async function filePayslipToDrive(row: { id: string; userId: string; year: number; month: number }) {
  const full = await prisma.payslip.findUniqueOrThrow({ where: { id: row.id } });
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return full;
  const profile = await prisma.employeeProfile.findFirst({ where: { userId: row.userId } });
  const { buildPayslipPdf } = await import("../services/payslipPdf.js");
  const pdf = await buildPayslipPdf({ payslip: full, user, profile });
  const emp = (profile?.empCode || user.fullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
  const saved = await mockOneDrive.upload(
    HR_DRIVE,
    payslipRecordFolder(new Date(row.year, row.month - 1, 1)),
    `${emp}-${ym}.pdf`,
    pdf,
    "application/pdf"
  );
  // Same PDF in the employee's own file (06_Records_Employee_Files/<emp>/06_Payslips).
  const { employeeRecordRoot } = await import("../services/spdcLibraryFolders.js");
  const own = await mockOneDrive
    .upload(HR_DRIVE, `${employeeRecordRoot(profile?.empCode, user.fullName)}/06_Payslips`, `Payslip-${ym}.pdf`, pdf, "application/pdf", { replace: true })
    .catch(() => null);
  return prisma.payslip.update({
    where: { id: row.id },
    data: { fileUrl: own?.sharePointUrl || saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_DRIVE}/${saved.path}` },
  }).then(async (updated) => {
    const url = updated.fileUrl;
    if (!url) return updated;
    const existing = await prisma.employeeDocument.findFirst({
      where: { userId: row.userId, category: "Payslip", title: { contains: ym } },
    });
    const doc = { fileUrl: url, storagePath: saved.path, issuedOn: new Date() };
    if (existing) {
      await prisma.employeeDocument.update({ where: { id: existing.id }, data: doc });
    } else {
      await prisma.employeeDocument.create({
        data: {
          userId: row.userId,
          category: "Payslip",
          title: `Payslip · ${ym} · ${user.fullName}`,
          ...doc,
        },
      });
    }
    return updated;
  });
}

/* ---------- Payroll-only staff (paid through HRMS, no portal login) ---------- */

const PAYROLL_STAFF_FIELDS = [
  "designation", "department", "panNumber", "uanNumber", "pfNumber", "esicNumber",
  "bankName", "bankAccountNo", "bankIfsc", "workLocation", "personalPhone", "personalEmail", "gender",
] as const;

function payrollProfileData(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of PAYROLL_STAFF_FIELDS) if (body[k] !== undefined) out[k] = String(body[k] ?? "").trim() || null;
  if (body.joinDate !== undefined) out.joinDate = body.joinDate ? new Date(String(body.joinDate)) : null;
  if (body.ctcAnnual !== undefined) out.ctcAnnual = Number(body.ctcAnnual) || null;
  if (body.basicMonthly !== undefined) out.basicMonthly = body.basicMonthly === "" ? null : Number(body.basicMonthly) || null;
  if (body.hraMonthly !== undefined) out.hraMonthly = body.hraMonthly === "" ? null : Number(body.hraMonthly) || null;
  return out;
}

hrmRecruitmentRouter.get("/payroll-staff", requireRoles("admin", "office", "hr"), async (_req, res) => {
  const profiles = await prisma.employeeProfile.findMany({ where: { payrollOnly: true }, orderBy: { empCode: "asc" } });
  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.userId) } },
    select: { id: true, fullName: true, email: true, role: true, isActive: true, phone: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json(
    profiles
      .filter((p) => byId.has(p.userId))
      .map((p) => ({ ...byId.get(p.userId)!, payrollOnly: true, profile: p })),
  );
});

/** Add someone to payroll who does not use the portal. Their login stays disabled. */
hrmRecruitmentRouter.post("/payroll-staff", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const fullName = String(req.body.fullName || "").trim();
  if (!fullName) return res.status(400).json({ error: "Name is required" });
  const empCode = String(req.body.empCode || "").trim() || `PAY-${Date.now().toString().slice(-6)}`;
  if (await prisma.employeeProfile.findFirst({ where: { empCode } })) return res.status(400).json({ error: `Emp code ${empCode} is already used` });
  const given = String(req.body.email || "").trim().toLowerCase();
  const email = given || `payroll.${empCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@no-login.spdc.in`;
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(400).json({ error: "A login with that email already exists — use Generate one for that person instead." });
  }
  const bcrypt = await import("bcryptjs");
  const { randomBytes } = await import("node:crypto");
  const { portalForRole } = await import("@sharnam/shared");
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      role: "employee",
      portal: portalForRole("employee"),
      phone: s(req.body.phone),
      isActive: false,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
    },
  });
  const profile = await prisma.employeeProfile.create({
    data: { userId: user.id, empCode, payrollOnly: true, ...(payrollProfileData(req.body) as object) },
  });
  await audit("hrms.payroll_staff.create", { userId: req.user!.id, entity: "User", entityId: user.id, meta: { fullName, empCode } });
  res.status(201).json({ ...user, payrollOnly: true, profile });
});

hrmRecruitmentRouter.put("/payroll-staff/:userId", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId: req.params.userId } });
  if (!profile?.payrollOnly) return res.status(404).json({ error: "Payroll-only staff record not found" });
  if (req.body.fullName !== undefined || req.body.phone !== undefined) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        ...(req.body.fullName ? { fullName: String(req.body.fullName).trim() } : {}),
        ...(req.body.phone !== undefined ? { phone: s(req.body.phone) } : {}),
      },
    });
  }
  const empCode = req.body.empCode ? String(req.body.empCode).trim() : profile.empCode;
  if (empCode !== profile.empCode && (await prisma.employeeProfile.findFirst({ where: { empCode } }))) {
    return res.status(400).json({ error: `Emp code ${empCode} is already used` });
  }
  const updated = await prisma.employeeProfile.update({ where: { userId: profile.userId }, data: { empCode, ...(payrollProfileData(req.body) as object) } });
  await audit("hrms.payroll_staff.update", { userId: req.user!.id, entity: "User", entityId: profile.userId });
  res.json(updated);
});

hrmRecruitmentRouter.delete("/payroll-staff/:userId", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId: req.params.userId } });
  if (!profile?.payrollOnly) return res.status(404).json({ error: "Payroll-only staff record not found" });
  const slips = await prisma.payslip.count({ where: { userId: profile.userId } });
  if (slips) return res.status(400).json({ error: `${slips} payslip(s) exist for this person. Delete those first, or keep the record.` });
  await prisma.employeeProfile.delete({ where: { userId: profile.userId } });
  await prisma.user.delete({ where: { id: profile.userId } }).catch(() => null);
  await audit("hrms.payroll_staff.delete", { userId: req.user!.id, entity: "User", entityId: profile.userId });
  res.json({ ok: true });
});

/** Attendance summary per staff member for a payroll month (what the payslip run will use). */
hrmRecruitmentRouter.get("/payslips/attendance-days", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) return res.status(400).json({ error: "year and month required" });
  const profiles = await prisma.employeeProfile.findMany({ select: { userId: true, empCode: true, payrollOnly: true } });
  const payrollOnlyIds = profiles.filter((p) => p.payrollOnly).map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: {
      id: { in: profiles.map((p) => p.userId) },
      role: { notIn: ["vendor", "client"] },
      OR: [{ isActive: true }, { id: { in: payrollOnlyIds } }],
    },
    select: { id: true, fullName: true },
  });
  const out = [];
  for (const u of users) {
    const prof = profiles.find((p) => p.userId === u.id);
    out.push({ userId: u.id, employee: u.fullName, empCode: prof?.empCode || "", payrollOnly: !!prof?.payrollOnly, ...(await attendanceDaysForMonth(u.id, year, month)) });
  }
  res.json(out.sort((a, b) => a.employee.localeCompare(b.employee)));
});

hrmRecruitmentRouter.post("/payslips/generate", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const userId = String(req.body.userId || "");
  const year = Number(req.body.year);
  const month = Number(req.body.month);
  if (!userId || !year || !month) return res.status(400).json({ error: "userId, year, month required" });
  try {
    const overrides: Record<string, number> = {};
    for (const key of ["basic", "hra", "conveyance", "medicalAllow", "specialAllow", "otherEarnings", "pfEmployee", "esicEmployee", "professionalTax", "incomeTax", "otherDeduction"] as const) {
      if (req.body[key] !== undefined && req.body[key] !== "") overrides[key] = Number(req.body[key]);
    }
    const fromAttendance = req.body.fromAttendance === true || req.body.fromAttendance === "true";
    const days = fromAttendance ? await attendanceDaysForMonth(userId, year, month) : null;
    const row = await computeAndUpsertPayslip(
      req.user!.id,
      userId,
      year,
      month,
      days ? days.daysInMonth : Number(req.body.workingDays || 30),
      days ? days.lopDays : Number(req.body.lopDays || 0),
      Number(req.body.incomeTax || 0),
      overrides
    );
    let filed = row;
    try {
      filed = await filePayslipToDrive(row);
    } catch (err) {
      pushRuntimeLog({
        level: "warn",
        source: "hrm.payslip",
        message: "Payslip generated but Drive file failed",
        detail: errorDetail(err),
      });
    }
    await audit("hrms.payslip.generate", { userId: req.user!.id, entity: "Payslip", entityId: filed.id, meta: { userId, year, month, netPay: filed.netPay } });
    res.status(201).json(filed);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Payslip generate failed" });
  }
});

hrmRecruitmentRouter.post("/payslips/generate-month", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const year = Number(req.body.year);
  const month = Number(req.body.month);
  if (!year || !month) return res.status(400).json({ error: "year and month required" });
  const workingDays = Number(req.body.workingDays || 30);
  const lopDays = Number(req.body.lopDays || 0);
  const incomeTax = Number(req.body.incomeTax || 0);
  const profiles = await prisma.employeeProfile.findMany();
  const created: unknown[] = [];
  const skipped: { userId: string; reason: string }[] = [];
  for (const profile of profiles) {
    const user = await prisma.user.findUnique({ where: { id: profile.userId } });
    if (!user || (!user.isActive && !profile.payrollOnly) || ["vendor", "client"].includes(user.role)) {
      skipped.push({ userId: profile.userId, reason: "not active staff" });
      continue;
    }
    if (!profile.ctcAnnual && !profile.basicMonthly) {
      skipped.push({ userId: profile.userId, reason: "no CTC on profile — set CTC then generate" });
      continue;
    }
    try {
      const useAttendance = req.body.fromAttendance !== false && req.body.fromAttendance !== "false";
      const days = useAttendance ? await attendanceDaysForMonth(profile.userId, year, month) : null;
      const row = await computeAndUpsertPayslip(
        req.user!.id,
        profile.userId,
        year,
        month,
        days ? days.daysInMonth : workingDays,
        days ? days.lopDays : lopDays,
        incomeTax,
      );
      const filed = await filePayslipToDrive(row);
      created.push({
        ...filed,
        employee: user.fullName,
        attendance: days,
        note: profile.payrollOnly
          ? "Payroll-only staff (no portal) — full month paid unless you edit the days."
          : days && !days.hasAttendance ? "No check-ins this month — full month paid. Review before sharing." : days?.needsReview ? `${days.needsReview} day(s) still need location review.` : null,
      });
    } catch (err) {
      skipped.push({ userId: profile.userId, reason: err instanceof Error ? err.message : "failed" });
    }
  }
  await audit("hrms.payslip.generate-month", {
    userId: req.user!.id,
    entity: "Payslip",
    meta: { year, month, count: created.length, skipped: skipped.length },
  });
  res.status(201).json({ created, skipped });
});

async function sendPayslipPdf(req: AuthedRequest, res: import("express").Response) {
  const row = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  if (req.user!.role !== "admin" && req.user!.role !== "office" && req.user!.role !== "hr" && req.user!.id !== row.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return res.status(404).json({ error: "user not found" });
  const profile = await prisma.employeeProfile.findFirst({ where: { userId: row.userId } });
  const { buildPayslipPdf } = await import("../services/payslipPdf.js");
  const pdf = await buildPayslipPdf({ payslip: row, user, profile });
  const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
  const emp = (profile?.empCode || user.fullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  if (!row.fileUrl || /\.html(\?|$)/i.test(row.fileUrl)) {
    void filePayslipToDrive(row).catch((err) => {
      pushRuntimeLog({
        level: "warn",
        source: "hrm.payslip",
        message: "Payslip PDF was opened but the SharePoint copy was not updated",
        detail: errorDetail(err),
      });
    });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${emp}-${ym}.pdf"`);
  res.send(pdf);
}

hrmRecruitmentRouter.get("/payslips/:id/file.pdf", requireRoles("admin", "office", "hr", "employee", "site_employee"), (req: AuthedRequest, res) => {
  void sendPayslipPdf(req, res);
});

hrmRecruitmentRouter.get("/payslips/:id/file.html", requireRoles("admin", "office", "hr", "employee", "site_employee"), (req: AuthedRequest, res) => {
  void sendPayslipPdf(req, res);
});

hrmRecruitmentRouter.patch("/payslips/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const before = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "not found" });
  const overrides: Record<string, number> = {};
  for (const key of ["basic", "hra", "conveyance", "medicalAllow", "specialAllow", "otherEarnings", "pfEmployee", "esicEmployee", "professionalTax", "incomeTax", "otherDeduction"] as const) {
    if (req.body[key] !== undefined) overrides[key] = Number(req.body[key]);
  }
  const days: Record<string, number> = {};
  for (const key of ["workingDays", "paidDays", "lopDays"] as const) {
    if (req.body[key] !== undefined && req.body[key] !== "") days[key] = Number(req.body[key]) || 0;
  }
  if (days.workingDays != null && days.lopDays != null && days.paidDays == null) days.paidDays = Math.max(0, days.workingDays - days.lopDays);
  const daysChanged =
    (days.workingDays != null && days.workingDays !== before.workingDays) || (days.lopDays != null && days.lopDays !== before.lopDays);
  const amountsChanged = Object.entries(overrides).some(([k, v]) => (before as Record<string, unknown>)[k] !== v);
  if (daysChanged && !amountsChanged) {
    // Only the days changed: prorate the salary again from the CTC (TDS kept).
    const redone = await computeAndUpsertPayslip(
      req.user!.id,
      before.userId,
      before.year,
      before.month,
      days.workingDays ?? before.workingDays,
      days.lopDays ?? before.lopDays,
      overrides.incomeTax ?? before.incomeTax,
      // Manual one-offs (arrears, advances) stay as they were.
      { otherEarnings: before.otherEarnings, otherDeduction: before.otherDeduction },
    );
    let filedAgain = redone;
    try {
      filedAgain = await filePayslipToDrive(redone);
    } catch {
      /* numbers saved even if the SharePoint copy fails */
    }
    await audit("hrms.payslip.update", { userId: req.user!.id, entity: "Payslip", entityId: redone.id, meta: { days } });
    return res.json(filedAgain);
  }
  const merged = { ...before, ...overrides };
  const gross = merged.basic + merged.hra + merged.conveyance + merged.medicalAllow + merged.specialAllow + merged.otherEarnings;
  const deductions = merged.pfEmployee + merged.esicEmployee + merged.professionalTax + merged.incomeTax + merged.otherDeduction;
  const row = await prisma.payslip.update({
    where: { id: req.params.id },
    data: {
      ...overrides,
      ...days,
      grossEarnings: gross,
      totalDeductions: deductions,
      netPay: gross - deductions,
      status: s(req.body.status) || before.status,
    },
  });
  let filed = row;
  try {
    filed = await filePayslipToDrive(row);
  } catch {
    /* keep numbers even if Drive write fails */
  }
  await audit("hrms.payslip.update", { userId: req.user!.id, entity: "Payslip", entityId: row.id });
  res.json(filed);
});

/* ═════════════════════════════════════  EMPLOYEE AUDIT LOG  ═════════════════════════════════════ */

/**
 * Timeline of every HRMS + portal action tied to an employee.
 */
hrmRecruitmentRouter.get("/employees/:userId/timeline", async (req, res) => {
  const userId = req.params.userId;
  const offerId = String(req.query.offerId || "");
  const candidateId = String(req.query.candidateId || "");
  try {
    const [own, related] = await Promise.all([
      prisma.auditEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.auditEvent.findMany({
        where: {
          OR: [
            { entityId: userId },
            ...(candidateId ? [{ entityId: candidateId }, { metaJson: { contains: candidateId } }] : []),
            ...(offerId ? [{ metaJson: { contains: offerId } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
    const merged = [...own, ...related]
      .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(merged);
  } catch (err) {
    console.error("[hrm.timeline]", err instanceof Error ? err.message : err);
    res.json([]);
  }
});

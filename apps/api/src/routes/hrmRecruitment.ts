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
import { createTeamsSchedule } from "../services/graph.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  computeCtcBreakdown,
  buildAnnexureHtml,
  buildAnnexureXlsx,
  DEFAULT_CTC_INPUTS,
  type CtcInputs,
} from "../services/ctcAnnexure.js";

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

/* ═════════════════════════════════════  MANPOWER REQUISITION  ═════════════════════════════════════ */

hrmRecruitmentRouter.get("/requisitions", async (_req, res) => {
  await safeHrmList("requisitions", () =>
    prisma.manpowerRequisition.findMany({
      orderBy: { createdAt: "desc" },
      include: { postings: { select: { id: true, title: true, status: true } } },
    }),
    res
  );
});

hrmRecruitmentRouter.post("/requisitions", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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

hrmRecruitmentRouter.patch("/requisitions/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  await safeHrmList("job postings", () =>
    prisma.jobPosting.findMany({
      include: { requisition: { select: { requisitionNo: true, status: true } }, _count: { select: { candidates: true } } },
      orderBy: { createdAt: "desc" },
    }),
    res
  );
});

hrmRecruitmentRouter.post("/postings", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  await safeHrmList("candidates", () =>
    prisma.candidate.findMany({
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
    }),
    res
  );
});

hrmRecruitmentRouter.post("/candidates", requireRoles("admin", "office", "hr"), upload.single("resume"), async (req: AuthedRequest, res) => {
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

hrmRecruitmentRouter.patch("/candidates/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
    include: { posting: { select: { title: true } } },
  });
  if (!candidate) return res.status(404).json({ error: "not found" });
  const priorRounds = await prisma.interviewRound.count({ where: { candidateId: candidate.id } });
  const interviewee: IntervieweeSeat = {
    candidateId: candidate.id,
    name: candidate.fullName,
    email: candidate.email || "",
    phone: candidate.phone || "",
    applyingFor: candidate.posting?.title || s(req.body.applyingFor) || "",
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

  const row = await prisma.interviewRound.create({
    data: {
      candidateId: candidate.id,
      roundNumber: Number(req.body.roundNumber) || priorRounds + 1,
      roundType: s(req.body.roundType) || "Technical",
      panelJson: JSON.stringify({ version: 1, interviewers, interviewee }),
      scheduledAt,
      durationMins,
      mode,
      meetingLink,
      meetingId,
      status: "Scheduled",
    },
  });
  await prisma.candidate.update({ where: { id: candidate.id }, data: { status: "Interview" } });
  await audit("hrms.interview.schedule", {
    userId: req.user!.id,
    entity: "InterviewRound",
    entityId: row.id,
    meta: { candidateId: candidate.id, roundNumber: row.roundNumber, mode, interviewers: interviewers.map((p) => p.name) },
  });
  res.status(201).json({ ...interviewPublic({ ...row, candidate }), teamsNote });
});

hrmRecruitmentRouter.patch("/interviews/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Interviewed" } });
  } else if (row.decision === "Reject") {
    await prisma.candidate.update({ where: { id: row.candidateId }, data: { status: "Rejected" } });
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
  await safeHrmList("offers", () =>
    prisma.offer.findMany({
      include: { candidate: { select: { fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
    res
  );
});

hrmRecruitmentRouter.get("/offers/:id", async (req, res) => {
  const row = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, preJoin: true, onboard: true },
  });
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

/** Fill the SPDC appointment letter from the accepted offer and file it on Drive. */
hrmRecruitmentRouter.post("/offers/:id/appointment-letter", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, preJoin: true, onboard: true },
  });
  if (!offer) return res.status(404).json({ error: "offer not found" });
  const employeeName = offer.candidate.fullName;
  const refNo = `SPDC/HR/OL/${String(new Date().getFullYear()).slice(-2)}-${String(Date.now()).slice(-4)}`;
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
      dataJson: JSON.stringify({
        candidateName: employeeName,
        joinDate: offer.joiningDate,
        fixedCtcAnnual: offer.ctcAnnual,
        ctcAnnual: offer.ctcAnnual,
        location: offer.location || offer.candidate.location || "SPDC Corporate Office, Vadodara",
        reportingManager: offer.reportingManager || "",
        probationMonths: offer.probationMonths || 6,
        empCode: offer.preJoin?.empCodeGenerated || "",
        candidateEmail: offer.candidate.email || "",
        phone: offer.candidate.phone || "",
        offerId: offer.id,
      }),
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
    const saved = await mockOneDrive.upload(
      "_HR",
      `06_HR_AND_ADMIN/06.02_Employee_Files/${offer.candidate.fullName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48)}/Letters`,
      `Appointment-${safeRef}-signed${extOf(req.file)}`,
      req.file.buffer,
    );
    const signedUrl = saved.sharePointUrl || saved.url || `/uploads/onedrive/_HR/${saved.path}`;

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
  if (req.file) {
    const saved = await mockOneDrive.upload(
      "GLOBAL",
      HR_STATUTORY_FOLDER,
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
  const rawInputs = req.body.ctcInputsJson;
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
          "GLOBAL",
          HR_STATUTORY_FOLDER,
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
      notes: s(req.body.notes),
      status: "Draft",
    },
  });
  await prisma.candidate.update({ where: { id: candidateId }, data: { status: "Selected" } });
  await audit("hrms.offer.create", { userId: req.user!.id, entity: "Offer", entityId: row.id, meta: { candidateId, offerNo: row.offerNo, ctc: row.ctcAnnual } });
  res.status(201).json(row);
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

hrmRecruitmentRouter.get("/pre-joining/:offerId", async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.offerId } });
  if (!offer) return res.status(404).json({ error: "not found" });
  const row = await prisma.preJoiningChecklist.upsert({
    where: { offerId: req.params.offerId },
    create: { offerId: req.params.offerId },
    update: {},
    include: { offer: { include: { candidate: true } } },
  });
  res.json(row);
});

hrmRecruitmentRouter.patch("/pre-joining/:offerId", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  const { renderHrPolicyAcknowledgement, hrPersonFolder } = await import("../services/hrmsLetter.js");
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
  const folder = `06_HR_AND_ADMIN/06.02_Employee_Files/${hrPersonFolder(offer.candidate.fullName)}/Onboarding`;
  const saved = await mockOneDrive.upload(
    "_HR",
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
  if (patch.hrPolicyAcknowledged === true) {
    const filed = await fileHrPolicyAcknowledgement(req.params.offerId, req.user!.id);
    if (filed) {
      return res.json({
        ...row,
        hrPolicyAcknowledged: true,
        itemsCompletedAt: { ...stamps, _hrPolicyUrl: filed.url, _hrPolicyFolder: filed.folder },
        hrPolicyUrl: filed.url,
        folder: filed.folder,
      });
    }
  }
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
  await safeHrmList("pay hikes", () =>
    prisma.payHike.findMany({
      where: userId ? { userId } : {},
      orderBy: { effectiveDate: "desc" },
    }),
    res
  );
});

hrmRecruitmentRouter.post("/pay-hikes", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  const isAdmin = ["admin", "office", "hr"].includes(req.user!.role);
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
  const basic = overrides?.basic ?? (profile.basicMonthly || (profile.ctcAnnual ? (profile.ctcAnnual * 0.5) / 12 : 0)) * factor;
  const hra = overrides?.hra ?? (profile.hraMonthly || basic * 0.4) * factor;
  const conveyance = overrides?.conveyance ?? 1600 * factor;
  const medicalAllow = overrides?.medicalAllow ?? 1250 * factor;
  const specialAllow =
    overrides?.specialAllow ??
    Math.max(0, (profile.ctcAnnual ? profile.ctcAnnual / 12 : 0) * factor - basic - hra - conveyance - medicalAllow);
  const otherEarnings = overrides?.otherEarnings ?? 0;
  const gross = basic + hra + conveyance + medicalAllow + specialAllow + otherEarnings;
  const pfEmployee = overrides?.pfEmployee ?? Math.min(basic, 15000) * 0.12;
  const esicEmployee = overrides?.esicEmployee ?? (gross <= 21000 ? gross * 0.0075 : 0);
  const professionalTax = overrides?.professionalTax ?? 200;
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

async function filePayslipToDrive(row: { id: string; userId: string; year: number; month: number }) {
  const full = await prisma.payslip.findUniqueOrThrow({ where: { id: row.id } });
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return full;
  const profile = await prisma.employeeProfile.findFirst({ where: { userId: row.userId } });
  const { buildPayslipHtml } = await import("../services/payslipPdf.js");
  const html = buildPayslipHtml({ payslip: full, user, profile });
  const emp = (profile?.empCode || user.fullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
  const saved = await mockOneDrive.upload(
    "_HR",
    `06_HR_AND_ADMIN/06.03_Payslips/${ym}`,
    `${emp}-${ym}.html`,
    Buffer.from(html, "utf8"),
    "text/html; charset=utf-8"
  );
  return prisma.payslip.update({
    where: { id: row.id },
    data: { fileUrl: saved.sharePointUrl || saved.url || `/uploads/onedrive/_HR/${saved.path}` },
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
    const row = await computeAndUpsertPayslip(
      req.user!.id,
      userId,
      year,
      month,
      Number(req.body.workingDays || 30),
      Number(req.body.lopDays || 0),
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
    if (!user || !user.isActive || ["vendor", "client"].includes(user.role)) {
      skipped.push({ userId: profile.userId, reason: "not active staff" });
      continue;
    }
    if (!profile.ctcAnnual && !profile.basicMonthly) {
      skipped.push({ userId: profile.userId, reason: "no CTC on profile — set CTC then generate" });
      continue;
    }
    try {
      const row = await computeAndUpsertPayslip(req.user!.id, profile.userId, year, month, workingDays, lopDays, incomeTax);
      created.push(await filePayslipToDrive(row));
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

hrmRecruitmentRouter.get("/payslips/:id/file.html", requireRoles("admin", "office", "hr", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not found" });
  if (req.user!.role !== "admin" && req.user!.role !== "office" && req.user!.role !== "hr" && req.user!.id !== row.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return res.status(404).json({ error: "user not found" });
  const profile = await prisma.employeeProfile.findFirst({ where: { userId: row.userId } });
  const { buildPayslipHtml } = await import("../services/payslipPdf.js");
  const html = buildPayslipHtml({ payslip: row, user, profile });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

hrmRecruitmentRouter.patch("/payslips/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
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
  try {
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
  } catch (err) {
    console.error("[hrm.timeline]", err instanceof Error ? err.message : err);
    res.json([]);
  }
});

/**
 * Offer → SPDC Offer Letter → Appointment Letter → portal login.
 * Every letter is built from the offer row so the letter always matches what HR filled in.
 */
import { prisma } from "../prisma.js";
import { DEFAULT_CTC_INPUTS, type CtcInputs } from "./ctcAnnexure.js";

export type OfferLetterFields = {
  gender?: string;
  address?: string;
  phone?: string;
  grade?: string;
  projectName?: string;
  workingHours?: string;
  reportingTime?: string;
  reportingAddress?: string;
  probationNotice?: string;
  employeeNotice?: string;
  companyNotice?: string;
  clDays?: string;
  slDays?: string;
  interviewDates?: string;
};

export const OFFER_LETTER_FIELD_KEYS: (keyof OfferLetterFields)[] = [
  "gender",
  "address",
  "phone",
  "grade",
  "projectName",
  "workingHours",
  "reportingTime",
  "reportingAddress",
  "probationNotice",
  "employeeNotice",
  "companyNotice",
  "clDays",
  "slDays",
  "interviewDates",
];

export function cleanLetterFields(raw: unknown): OfferLetterFields {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") obj = raw as Record<string, unknown>;
  const out: OfferLetterFields = {};
  for (const k of OFFER_LETTER_FIELD_KEYS) {
    const v = String(obj[k] ?? "").trim();
    if (v) out[k] = v.slice(0, 400);
  }
  return out;
}

/** The 12 CTC calculator inputs: from the calculator payload, else SPDC defaults on the fixed CTC. */
export function ctcInputsFrom(raw: unknown, fallback: { candidateName: string; designation: string; fixedCtcAnnual: number }): CtcInputs | null {
  let p: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      p = JSON.parse(raw);
    } catch {
      p = {};
    }
  } else if (raw && typeof raw === "object") p = raw as Record<string, unknown>;
  const fixed = Number(p.fixedCtcAnnual || fallback.fixedCtcAnnual || 0);
  if (!(fixed > 0)) return null;
  const defaults = DEFAULT_CTC_INPUTS as unknown as Record<string, number>;
  const num = (k: keyof CtcInputs) => (p[k] != null && p[k] !== "" ? Number(p[k]) : Number(defaults[k] ?? 0));
  return {
    candidateName: String(p.candidateName || fallback.candidateName),
    designation: String(p.designation || fallback.designation),
    fixedCtcAnnual: fixed,
    basicPctOfGross: num("basicPctOfGross"),
    hraPctOfBasic: num("hraPctOfBasic"),
    restrictPfCeiling: p.restrictPfCeiling != null ? Boolean(p.restrictPfCeiling) : DEFAULT_CTC_INPUTS.restrictPfCeiling,
    gratuityPctOfBasic: num("gratuityPctOfBasic"),
    ltaPctOfBasic: num("ltaPctOfBasic"),
    conveyanceAnnual: num("conveyanceAnnual"),
    childrenEducationAnnual: num("childrenEducationAnnual"),
    mediclaimAnnual: num("mediclaimAnnual"),
    performancePayPct: num("performancePayPct"),
    professionalTaxAnnual: num("professionalTaxAnnual"),
  };
}

export function hrLetterRefNo(code: "OF" | "OL"): string {
  const yy = new Date().getFullYear();
  return `SPDC/HR/${code}/${String(yy).slice(-2)}-${String(yy + 1).slice(-2)}/${String(Date.now()).slice(-4)}`;
}

type OfferFull = NonNullable<Awaited<ReturnType<typeof loadOffer>>>;

export async function loadOffer(offerId: string) {
  return prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      candidate: { include: { interviews: { select: { scheduledAt: true }, orderBy: { scheduledAt: "asc" } } } },
      preJoin: true,
      onboard: true,
    },
  });
}

const fmt = (d?: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

/** Letter data (dataJson) for the offer or appointment letter of this offer. */
export function offerLetterContext(offer: OfferFull, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const fields = cleanLetterFields(offer.letterFieldsJson);
  const inputs = ctcInputsFrom(offer.ctcInputsJson, {
    candidateName: offer.candidate.fullName,
    designation: offer.designation,
    fixedCtcAnnual: offer.ctcAnnual,
  });
  const interviews = offer.candidate.interviews
    .map((i) => i.scheduledAt)
    .filter((d): d is Date => !!d)
    .map((d) => fmt(d));
  return {
    ...(inputs || {}),
    candidateName: offer.candidate.fullName,
    employeeName: offer.candidate.fullName,
    designation: offer.designation,
    department: offer.department || "",
    candidateEmail: offer.candidate.email || "",
    phone: fields.phone || offer.candidate.phone || "",
    gender: fields.gender || "",
    address: fields.address || "",
    candidateAddress: fields.address || "",
    location: offer.location || offer.candidate.location || "SPDC Corporate Office, Vadodara",
    placeOfPosting: offer.location || "",
    reportingManager: offer.reportingManager || "",
    joinDate: fmt(offer.joiningDate),
    effectiveDate: fmt(offer.joiningDate),
    probationMonths: offer.probationMonths ?? 6,
    probationNotice: fields.probationNotice || "15",
    employeeNotice: fields.employeeNotice || "60",
    companyNotice: fields.companyNotice || "30",
    clDays: fields.clDays || "12",
    slDays: fields.slDays || "6",
    grade: fields.grade || "",
    projectName: fields.projectName || "",
    workingHours: fields.workingHours || "9:00 AM to 6:30 PM",
    reportingTime: fields.reportingTime || "9:30 AM",
    reportingAddress: fields.reportingAddress || offer.location || "",
    interviewDates: fields.interviewDates || interviews.join(", ") || "____________",
    selectionDate: interviews[interviews.length - 1] || fmt(offer.createdAt),
    applicationDate: fmt(offer.candidate.createdAt),
    fixedCtcAnnual: offer.ctcAnnual,
    ctcAnnual: offer.ctcAnnual,
    offerId: offer.id,
    offerNo: offer.offerNo,
    empCode: offer.preJoin?.empCodeGenerated || "",
    acceptanceDate: fmt(offer.acceptedAt),
    ...extra,
  };
}

/** Generate (or re-generate) the SPDC Offer Letter for this offer and link it on the offer row. */
export async function generateOfferLetter(offerId: string, userId: string) {
  const offer = await loadOffer(offerId);
  if (!offer) throw Object.assign(new Error("Offer not found"), { status: 404 });
  const refNo = hrLetterRefNo("OF");
  const data = offerLetterContext(offer, { offerDate: fmt(new Date()), offerRefNo: refNo });
  const letter = await prisma.hrmsDocument.create({
    data: {
      kind: "Offer",
      refNo,
      employeeName: offer.candidate.fullName,
      candidateEmail: offer.candidate.email,
      designation: offer.designation,
      department: offer.department,
      effectiveDate: offer.joiningDate,
      status: "Draft",
      createdById: userId,
      dataJson: JSON.stringify(data),
    },
  });
  const { generateHrmsLetter } = await import("./hrmsLetter.js");
  const gen = await generateHrmsLetter(letter);
  const updated = await prisma.hrmsDocument.update({
    where: { id: letter.id },
    data: {
      generatedDocxUrl: gen.docxUrl,
      generatedPdfUrl: gen.pdfUrl,
      storagePath: gen.storagePath,
      sharePointUrl: gen.sharePointUrl,
      dataJson: JSON.stringify({ ...data, ...(gen.annexureXlsxUrl ? { annexureXlsxUrl: gen.annexureXlsxUrl } : {}) }),
      status: "Generated",
    },
  });
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      offerLetterDocId: updated.id,
      offerLetterUrl: updated.generatedDocxUrl || updated.sharePointUrl || updated.generatedPdfUrl || offer.offerLetterUrl,
      ...(gen.annexureXlsxUrl ? { annexureUrl: gen.annexureXlsxUrl } : {}),
    },
  });
  return updated;
}

function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}#1`;
}

/**
 * Accepted offer → staff login + employee profile (designation, department, CTC, joining date, emp code).
 * The login type comes from the role in HRMS · Masters. Returns a one-time password when a login is created.
 */
export async function createPortalLoginForOffer(offerId: string) {
  const offer = await loadOffer(offerId);
  if (!offer) throw Object.assign(new Error("Offer not found"), { status: 404 });
  if (!["Accepted", "Onboarding", "Joined"].includes(offer.status)) {
    throw Object.assign(new Error("Mark the offer Accepted before creating the portal login."), { status: 400 });
  }
  const email = (offer.candidate.email || "").trim().toLowerCase();
  if (!email) throw Object.assign(new Error("Add the candidate's email first — it becomes their login."), { status: 400 });

  const role = await prisma.hrmDesignation
    .findUnique({ where: { title: offer.designation }, select: { loginRole: true } })
    .catch(() => null);
  const { suggestedLoginRoleForCompanyRole } = await import("@sharnam/shared");
  const loginRole = !role?.loginRole || role.loginRole === "employee" ? suggestedLoginRoleForCompanyRole(offer.designation) : role.loginRole;
  const inputs = ctcInputsFrom(offer.ctcInputsJson, { candidateName: offer.candidate.fullName, designation: offer.designation, fixedCtcAnnual: offer.ctcAnnual });
  let basicMonthly = offer.basicMonthly ?? null;
  let hraMonthly = offer.hraMonthly ?? null;
  if (inputs && (basicMonthly == null || hraMonthly == null)) {
    const { computeCtcBreakdown } = await import("./ctcAnnexure.js");
    const b = computeCtcBreakdown(inputs);
    basicMonthly = Number(b.partA.rows[0].perMonth) || basicMonthly;
    hraMonthly = Number(b.partA.rows[1].perMonth) || hraMonthly;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  let password: string | null = null;
  let created = false;
  if (!user) {
    const bcrypt = await import("bcryptjs");
    const { portalForRole } = await import("@sharnam/shared");
    password = tempPassword();
    user = await prisma.user.create({
      data: {
        email,
        fullName: offer.candidate.fullName,
        role: loginRole as never,
        portal: portalForRole(loginRole as never),
        phone: offer.candidate.phone,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    created = true;
  }
  const empCode = offer.preJoin?.empCodeGenerated || `EMP-${Date.now().toString().slice(-6)}`;
  const profileData = {
    designation: offer.designation,
    department: offer.department,
    joinDate: offer.joiningDate || new Date(),
    ctcAnnual: offer.ctcAnnual,
    basicMonthly,
    hraMonthly,
  };
  const existingProfile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
  if (existingProfile) {
    await prisma.employeeProfile.update({ where: { userId: user.id }, data: profileData });
  } else {
    await prisma.employeeProfile.create({ data: { userId: user.id, empCode, ...profileData } });
  }
  const { ensureDefaultLeaveBalancesForUser } = await import("./spdcLeaveSeed.js");
  await ensureDefaultLeaveBalancesForUser(user.id);
  await prisma.onboardingChecklist.upsert({
    where: { offerId: offer.id },
    create: { offerId: offer.id, userId: user.id },
    update: { userId: user.id },
  });
  if (offer.status === "Accepted") await prisma.offer.update({ where: { id: offer.id }, data: { status: "Onboarding" } });
  // Candidate documents follow the person into their HR file.
  const kyc = await prisma.candidateDocument.findMany({ where: { candidateId: offer.candidateId } });
  for (const doc of kyc) {
    const already = await prisma.employeeDocument.findFirst({ where: { userId: user.id, category: doc.category, fileUrl: doc.fileUrl } });
    if (!already) {
      await prisma.employeeDocument.create({
        data: { userId: user.id, category: doc.category, title: doc.title, fileUrl: doc.fileUrl, storagePath: doc.storagePath },
      });
    }
  }
  // Letters already generated for this offer move into the employee's HR file.
  const letters = await prisma.hrmsDocument.findMany({
    where: { kind: { in: ["Offer", "Appointment"] }, employeeUserId: null, candidateEmail: offer.candidate.email || undefined },
  });
  const { attachHrmsLetterToEmployeeVault } = await import("./hrmsLetter.js");
  for (const l of letters) {
    let forThisOffer = l.id === offer.offerLetterDocId;
    try {
      forThisOffer = forThisOffer || JSON.parse(l.dataJson || "{}").offerId === offer.id;
    } catch {
      /* ignore */
    }
    if (!forThisOffer) continue;
    const linked = await prisma.hrmsDocument.update({ where: { id: l.id }, data: { employeeUserId: user.id } });
    const fileUrl = linked.uploadedFileUrl || linked.sharePointUrl || linked.generatedPdfUrl || linked.generatedDocxUrl || "";
    if (fileUrl) {
      await attachHrmsLetterToEmployeeVault(linked, { fileUrl, storagePath: linked.storagePath, signed: linked.status === "Signed" }).catch(() => null);
    }
  }
  return { userId: user.id, email, fullName: user.fullName, role: user.role, created, password, empCode: existingProfile?.empCode || empCode };
}

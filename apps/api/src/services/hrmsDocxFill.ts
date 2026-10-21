/**
 * Fill SPDC HR letter .docx templates (apps/api/formats/hrms/<Kind>.docx).
 * Templates use {{TOKEN}} placeholders — see 00_SPDC_HR_Letters_Usage_Guide.docx.
 */
import JSZip from "jszip";
import type { HrmsDocument } from "@prisma/client";
import { HR_LETTER_TABLES, hrLetterTableHasData, parseHrLetterTable, type HrLetterTable } from "@sharnam/shared";
import type { CtcBreakdown } from "./ctcAnnexure.js";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "____________";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).trim() || "____________";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/** Date inputs send 2026-04-01. Letters print 01 April 2026, including dates inside a typed phrase. */
function formatIsoDatesIn(value: string): string {
  return value.replace(/\b(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?\b/g, (match, iso: string) => {
    const dt = new Date(`${iso}T12:00:00`);
    return Number.isNaN(dt.getTime()) ? match : fmtDate(dt);
  });
}

function withLetterDates(merged: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) out[k] = typeof v === "string" ? formatIsoDatesIn(v) : v;
  return out;
}

function inrPlain(v: unknown): string {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function inrOrNil(n: number): string {
  return n > 0 ? inrPlain(n) : "Nil";
}

function wholeNumber(v: unknown): number | null {
  const raw = String(v ?? "").trim();
  if (!raw || /nil|—|-/i.test(raw)) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inrLabel(v: unknown): string {
  const plain = inrPlain(v);
  return plain ? `INR ${plain}` : "INR ____________";
}

function parseRefNo(refNo: string) {
  const parts = refNo.split("/").filter(Boolean);
  return {
    fy: parts[3] || "",
    seq: parts[parts.length - 1] || "",
  };
}

function moneyFromBreakdown(breakdown: CtcBreakdown | null | undefined, labelIncludes: string, monthly: boolean): number {
  if (!breakdown) return 0;
  const all = [...breakdown.partA.rows, ...breakdown.partB.rows, ...breakdown.partC.rows];
  const hit = all.find((r) => r.label.toLowerCase().includes(labelIncludes.toLowerCase()));
  if (!hit) return 0;
  if (!monthly) return Math.abs(hit.perAnnum || 0);
  return typeof hit.perMonth === "number" ? Math.abs(hit.perMonth) : 0;
}

function deductionMonth(breakdown: CtcBreakdown | null | undefined): number {
  if (!breakdown) return 0;
  return breakdown.partC.rows
    .filter((r) => r.label.toLowerCase().startsWith("less"))
    .reduce((sum, r) => sum + (typeof r.perMonth === "number" ? Math.abs(r.perMonth) : 0), 0);
}

function noticeShortfall(merged: Record<string, unknown>): string {
  const required = wholeNumber(merged.noticeRequired);
  const served = wholeNumber(merged.noticeServed);
  if (required == null || served == null) return String(merged.shortfall || "Nil");
  const waived = wholeNumber(merged.waivedDays) ?? 0;
  const gap = Math.round(required - served - waived);
  return gap > 0 ? String(gap) : "Nil";
}

function genderTokens(gender: unknown) {
  const g = String(gender || "").trim().toLowerCase();
  if (g.startsWith("f")) {
    return { heShe: "She", himHer: "her", hisHer: "her", mrMs: "Ms." };
  }
  if (g.startsWith("m")) {
    return { heShe: "He", himHer: "him", hisHer: "his", mrMs: "Mr." };
  }
  return { heShe: "He/She", himHer: "him/her", hisHer: "his/her", mrMs: "Mr./Ms." };
}

/** Build {{TOKEN}} → value map for any SPDC HR letter template. */
export function buildHrmsDocxTokenMap(
  row: Pick<HrmsDocument, "refNo" | "kind" | "issueDate" | "effectiveDate" | "employeeName" | "designation" | "department" | "candidateEmail">,
  rawMerged: Record<string, unknown>,
  breakdown?: CtcBreakdown | null,
): Record<string, string> {
  const merged = withLetterDates(rawMerged);
  const ref = parseRefNo(row.refNo);
  const name = String(merged.employeeName || merged.candidateName || row.employeeName || "").trim();
  const designation = String(merged.designation || row.designation || "").trim();
  const department = String(merged.department || row.department || "").trim();
  const email = String(merged.candidateEmail || row.candidateEmail || "").trim();
  const phone = String(merged.phone || merged.mobile || "").trim();
  const location = String(merged.location || merged.placeOfPosting || "SPDC Corporate Office, Vadodara").trim();
  const address = String(merged.address || merged.addressAsPerRecords || merged.candidateAddress || "____________").trim();
  const issueDate = String(merged.issueDate || fmtDate(row.issueDate));
  const leaving = ["AssetReturn", "Exit", "Relieving", "Experience", "NdaPostEmployment"].includes(row.kind);
  const joinDate = leaving
    ? String(merged.joinDate || merged.joiningDate || "____________")
    : String(merged.joinDate || merged.effectiveDate || fmtDate(row.effectiveDate));
  const effectiveDate = String(merged.effectiveDate || (leaving ? "" : joinDate) || "____________");
  const lastWorking = String(merged.lastWorkingDate || (leaving ? effectiveDate : "") || "").trim();
  const lastWorkingPrint =
    lastWorking && lastWorking !== joinDate ? lastWorking : leaving ? "____________" : effectiveDate;
  const confirmationDate =
    row.kind === "Confirmation" ? String(merged.probationEndDate || "____________") : effectiveDate;
  const separation = String(merged.separationBasis || (merged.resignationDate ? "resignation" : "")).toLowerCase();
  const blank = "—";
  const reporting = String(merged.reportingManager || merged.reportingTo || "—").trim();
  const grade = String(merged.grade || merged.band || "As per SPDC Grade Structure").trim();
  const empCode = String(merged.empCode || "To be assigned on joining").trim();
  const projectName = String(merged.projectName || merged.project || "As assigned").trim();
  const reason = String(merged.reason || "").trim();
  const gender = genderTokens(merged.gender);

  const fixedCtc =
    breakdown?.inputs.fixedCtcAnnual ??
    Number(String(merged.fixedCtcAnnual ?? merged.ctcAnnual ?? merged.ctc ?? "").replace(/[^\d.]/g, ""));
  const currentCtc = Number(String(merged.previousCtc ?? merged.oldCtcAnnual ?? merged.currentCtc ?? "").replace(/[^\d.]/g, ""));
  const newCtc = Number(String(merged.newCtc ?? merged.newCtcAnnual ?? fixedCtc ?? "").replace(/[^\d.]/g, ""));

  // Offer, appointment and promotion tables are headed "Monthly". Medical allowance is not a
  // CTC line (mediclaim sits with employer benefits). Special is the residual so the lines add up to gross.
  const monthlyPay = row.kind === "Offer" || row.kind === "Appointment" || row.kind === "Promotion";
  const basic = moneyFromBreakdown(breakdown, "basic", monthlyPay);
  const hra = moneyFromBreakdown(breakdown, "house rent", monthlyPay);
  const conveyance = moneyFromBreakdown(breakdown, "conveyance", monthlyPay);
  const gross = monthlyPay ? breakdown?.partA.gross.perMonth ?? 0 : breakdown?.partA.gross.perAnnum ?? 0;
  const special = Math.max(0, Math.round(gross - basic - hra - conveyance));
  const net = monthlyPay ? breakdown?.partC.indicativeNet.perMonth ?? 0 : breakdown?.partC.indicativeNet.perAnnum ?? 0;
  const siteAllowance = 0;
  const deductions = monthlyPay
    ? deductionMonth(breakdown)
    : Math.abs(breakdown?.partC.rows.filter((r) => r.label.toLowerCase().startsWith("less")).reduce((s, r) => s + (r.perAnnum || 0), 0) ?? 0);
  const employerPf = moneyFromBreakdown(breakdown, "employer's provident", monthlyPay);
  const gratuityAmt = moneyFromBreakdown(breakdown, "gratuity", monthlyPay);
  const insuranceAmt = moneyFromBreakdown(breakdown, "mediclaim", monthlyPay);
  const employerContrib = monthlyPay ? breakdown?.partB.total.perMonth ?? 0 : breakdown?.partB.total.perAnnum ?? 0;
  const empPf = moneyFromBreakdown(breakdown, "employee's provident", monthlyPay) || moneyFromBreakdown(breakdown, "less: employee's provident", monthlyPay);
  const empEsi = moneyFromBreakdown(breakdown, "state insurance", monthlyPay);
  const professionalTax = moneyFromBreakdown(breakdown, "professional tax", monthlyPay);

  const probation = String(merged.probationMonths || "6").trim();
  const probationNotice = String(merged.probationNotice || "15").trim();
  const employeeNotice = String(merged.employeeNotice || "60").trim();
  const companyNotice = String(merged.companyNotice || "30").trim();
  const clDays = String(merged.clDays || "12").trim();
  const slDays = String(merged.slDays || "6").trim();

  const tokens: Record<string, string> = {
    FY: ref.fy,
    SEQ: ref.seq,
    REF: row.refNo,
    LETTER_DATE: issueDate,
    DATE: row.kind === "Warning" ? "—" : issueDate,
    EMPLOYEE_NAME: name,
    CANDIDATE_NAME: name,
    DESIGNATION: designation,
    DEPARTMENT: department,
    EMAIL: email,
    MOBILE: phone || "____________",
    BASE_LOCATION: location,
    LOCATION: location,
    PROJECT_NAME: projectName,
    PROJECT: projectName,
    "CLIENT / PROJECT": String(merged.clientProject || merged.projectName || projectName),
    CLIENT: String(merged.clientName || merged.client || projectName),
    REPORTING_MANAGER: reporting,
    GRADE: grade,
    EMP_CODE: empCode,
    ADDRESS_AS_PER_RECORDS: address,
    CANDIDATE_ADDRESS: address,
    PERMANENT_ADDRESS: String(merged.permanentAddress || address),
    POST_EXIT_ADDRESS: String(merged.postExitAddress || address),
    JOINING_DATE: joinDate,
    EFFECTIVE_DATE: effectiveDate,
    CONFIRMATION_DATE: confirmationDate,
    LAST_WORKING_DATE: lastWorkingPrint,
    RESIGNATION_DATE: separation.includes("resign") || merged.resignationDate ? String(merged.resignationDate || blank) : blank,
    PROBATION_END_DATE: String(merged.probationEndDate || (row.kind === "Confirmation" ? blank : effectiveDate)),
    OFFER_DATE: String(merged.offerDate || issueDate),
    OFFER_REF_NO: String(merged.offerRefNo || row.refNo),
    APPOINTMENT_DATE: String(merged.appointmentDate || joinDate),
    APPOINTMENT_REF_NO: String(merged.appointmentRefNo || row.refNo),
    APPLICATION_DATE: String(merged.applicationDate || issueDate),
    INTERVIEW_DATES: String(merged.interviewDates || merged.selectionDate || "____________"),
    SELECTION_DATE: String(merged.selectionDate || "____________"),
    ACCEPTANCE_DATE: String(merged.acceptanceDate || issueDate),
    ANNUAL_CTC: inrPlain(fixedCtc) || inrPlain(newCtc) || "____________",
    CURRENT_CTC: inrPlain(currentCtc) || "____________",
    NEW_CTC: inrPlain(newCtc) || inrPlain(fixedCtc) || "____________",
    "REVISED_CTC or \"No change\"": String(merged.revisedCtc || "").trim() || inrPlain(newCtc) || "No change",
    BASIC: inrOrNil(basic),
    HRA: inrOrNil(hra),
    GROSS: inrOrNil(gross),
    NET: inrOrNil(net),
    CONVEYANCE: inrOrNil(conveyance),
    MEDICAL: "Nil",
    SPECIAL: inrOrNil(special),
    SITE_ALLOWANCE: inrOrNil(siteAllowance),
    DEDUCTIONS: inrOrNil(deductions),
    EMPLOYER_CONTRIB: inrOrNil(employerContrib),
    PROBATION_MONTHS: probation,
    "PROBATION_MONTHS e.g. 6": probation,
    PROBATION_NOTICE: probationNotice,
    "PROBATION_NOTICE e.g. 15": probationNotice,
    EMPLOYEE_NOTICE: employeeNotice,
    "EMPLOYEE_NOTICE e.g. 60": employeeNotice,
    COMPANY_NOTICE: companyNotice,
    "COMPANY_NOTICE e.g. 30": companyNotice,
    CL_DAYS: clDays,
    "CL_DAYS e.g. 12": clDays,
    SL_DAYS: slDays,
    "SL_DAYS e.g. 6": slDays,
    WORKING_HOURS: String(merged.workingHours || "9:00 AM to 6:30 PM"),
    "WORKING_HOURS e.g. 9:00 AM to 6:30 PM": String(merged.workingHours || "9:00 AM to 6:30 PM"),
    REPORTING_TIME: String(merged.reportingTime || "9:30 AM"),
    REPORTING_ADDRESS: String(merged.reportingAddress || location),
    CURRENT_DESIGNATION: String(merged.previousDesignation || merged.fromDesignation || designation),
    NEW_DESIGNATION: String(merged.newDesignation || designation),
    CURRENT_DEPARTMENT: String(merged.previousDepartment || department),
    NEW_DEPARTMENT: department,
    CURRENT_GRADE: String(merged.previousGrade || grade),
    NEW_GRADE: String(merged.newGrade || grade),
    CURRENT_REPORTING: String(merged.previousReporting || reporting),
    NEW_REPORTING: reporting,
    REASON: reason,
    "REASON e.g. your separation / transfer to another project / replacement of asset": reason || "your separation",
    CORRECTIVE_ACTION: String(merged.correctiveAction || reason),
    ISSUE_IN_BRIEF: String(merged.issueInBrief || reason),
    IMPACT: String(merged.impact || reason),
    "CLAUSE / POLICY e.g. Clause 14 of your Appointment Letter / HSE Policy": String(
      merged.clausePolicy || "Clause 14 of your Appointment Letter",
    ),
    LETTER_TYPE: String(merged.letterType || row.kind),
    "REPLY_HOURS e.g. 72": String(merged.replyHours || "72"),
    ASSETS: String(merged.assets || "____________"),
    OTHER_ITEM:
      [
        String(merged.otherItem || "").trim(),
        [String(merged.assets || "").trim(), String(merged.serials || "").trim() && `Serial no. ${String(merged.serials).trim()}`]
          .filter(Boolean)
          .join(" — "),
      ]
        .filter(Boolean)
        .join("; ") || "____________",
    REMARKS: String(merged.notes || merged.remarks || "—"),
    SUBMISSION_DATE: String(merged.submissionDate || effectiveDate),
    FORWARD_TO: String(merged.forwardTo || "HR & Admin"),
    RECOVERY_AMOUNT: String(merged.recoveryAmount || "Nil"),
    EXIT_LETTER_REF: String(merged.exitLetterRef || "—"),
    ASSET_LETTER_REF: String(merged.assetLetterRef || "—"),
    FNF_STATUS: String(merged.fnfStatus || "Pending clearance"),
    NOTICE_SERVED: String(merged.noticeServed || "—"),
    NOTICE_REQUIRED: String(merged.noticeRequired || employeeNotice),
    WAIVER_REF: String(merged.waiverRef || "—"),
    SUCCESSOR_NAME: String(merged.successorName || "—"),
    SUCCESSOR_DESIGNATION: String(merged.successorDesignation || "—"),
    FOCUS_AREA_1: String(merged.focusArea1 || "Timely delivery of assigned work"),
    FOCUS_AREA_2: String(merged.focusArea2 || "Client communication and documentation"),
    FOCUS_AREA_3: String(merged.focusArea3 || "HSE and quality compliance"),
    NATURE_OF_WORK: String(merged.natureOfWork || "site supervision, planning, quality control and billing verification"),
    "NATURE_OF_WORK e.g. site supervision, planning, quality control and billing verification": String(
      merged.natureOfWork || "site supervision, planning, quality control and billing verification",
    ),
    PERIOD: String(merged.period || (lastWorkingPrint !== "____________" ? `${joinDate} to ${lastWorkingPrint}` : "____________")),
    FROM_1: String(merged.from1 || joinDate),
    TO_1: String(merged.to1 || (lastWorkingPrint !== "____________" ? lastWorkingPrint : "")),
    PROJECT_1: String(merged.project1 || projectName),
    DESIGNATION_1: String(merged.designation1 || designation),
    "DESIGNATION_2 (if promoted)": String(merged.designation2 || ""),
    "He/She": gender.heShe,
    "he/she": gender.heShe.toLowerCase(),
    "him/her": gender.himHer,
    "his/her": gender.hisHer,
    "MR/MS": gender.mrMs,
    PAN: String(merged.pan || merged.panNumber || "____________"),
    AGE: String(merged.age || "____________"),
    FATHER_OR_SPOUSE_NAME: String(merged.fatherOrSpouseName || merged.nomineeName || "____________"),
    BANK: String(merged.bank || merged.bankName || "As per employee records"),
    CHQ_NO: String(merged.chqNo || "—"),
    NO_OF_CHEQUES: String(merged.noOfCheques ?? "").trim() === "0" ? "0" : String(merged.noOfCheques || "—"),
    BONUS: "Not applicable",
    GRATUITY: inrOrNil(gratuityAmt),
    INSURANCE: inrOrNil(insuranceAmt),
    PT: inrOrNil(professionalTax),
    EMP_PF: inrOrNil(empPf),
    EMP_ESI: inrOrNil(empEsi),
    ER_PF_ESI: inrOrNil(employerPf),
    TOTAL_DED: inrOrNil(deductions),
    PAY_DAY: String(merged.payDay || "7th"),
    "PAY_DAY e.g. 7th": String(merged.payDay || "7th"),
    MONTH: String(merged.month || new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })),
    ACHIEVEMENT: String(merged.achievement || "Timely delivery of assigned project milestones"),
    "ACHIEVEMENT e.g. timely handover of the XYZ project": String(
      merged.achievement || "Timely delivery of assigned project milestones",
    ),
    KRA_1: String(merged.kra1 || "Deliver assigned projects to approved schedule"),
    KRA_2: String(merged.kra2 || "Client satisfaction and stakeholder communication"),
    KRA_3: String(merged.kra3 || "Cost control and billing accuracy"),
    KRA_4: String(merged.kra4 || "HSE performance and compliance"),
    KRA_5: String(merged.kra5 || "Team development and mentoring"),
    "KRA_1 e.g. Deliver assigned projects to approved schedule": String(
      merged.kra1 || "Deliver assigned projects to approved schedule",
    ),
    "KRA_2 e.g. Client satisfaction": String(merged.kra2 || "Client satisfaction and stakeholder communication"),
    "KRA_3 e.g. Cost control and billing accuracy": String(merged.kra3 || "Cost control and billing accuracy"),
    "KRA_4 e.g. HSE performance": String(merged.kra4 || "HSE performance and compliance"),
    "KRA_5 e.g. Team development": String(merged.kra5 || "Team development and mentoring"),
    REVIEW_DATE: String(merged.reviewDate || "—"),
    REVIEW_CYCLE: String(merged.reviewCycle || "Half-yearly"),
    REVIEWER: String(merged.reviewer || reporting),
    INSPECTION_DAYS: String(merged.inspectionDays || "7"),
    "INSPECTION_DAYS e.g. 7": String(merged.inspectionDays || "7"),
    OFFICIAL_EMAIL: String(merged.officialEmail || email || "____________"),
    CLIENT_NAME: String(merged.clientName || merged.client || projectName),
    APPROVER: String(merged.approver || reporting),
    HANDOVER_DATE: String(merged.handoverDate || effectiveDate),
    END_DATE: separation.includes("fixed") ? String(merged.endDate || blank) : blank,
    GARDEN_LEAVE_FROM: String(merged.gardenLeaveFrom || "—"),
    GARDEN_LEAVE_TO: String(merged.gardenLeaveTo || "—"),
    ABSENCE_NOTICE_DATE: separation.includes("abandon") ? String(merged.absenceNoticeDate || blank) : blank,
    TERMINATION_LETTER_DATE:
      separation.includes("termin") && !separation.includes("probation") ? String(merged.terminationLetterDate || blank) : blank,
    RETIREMENT_DATE: separation.includes("retir") ? String(merged.retirementDate || blank) : blank,
    "RETIREMENT_AGE e.g. 58": String(merged.retirementAge || "58"),
    WAIVED_DAYS: String(merged.waivedDays || "0"),
    WAIVER_DATE: String(merged.waiverDate || "—"),
    SHORTFALL: noticeShortfall(merged),
    DAYS: String(merged.days || "—"),
    LAST4: String(merged.last4 || "—"),
    FIELD: String(merged.field || department),
    LIMIT: String(merged.newLimit || merged.limit || "As per policy"),
    CURRENT_LIMIT: String(merged.currentLimit || "As per policy"),
    NEW_LIMIT: String(merged.newLimit || "As per policy"),
    CURRENT_NOTICE: String(merged.currentNotice || employeeNotice),
    NEW_NOTICE: String(merged.newNotice || employeeNotice),
    CURRENT_TEAM: String(merged.currentTeam || department),
    NEW_TEAM: String(merged.newTeam || department),
    "DUTY / AUTHORITY": String(merged.dutyAuthority || designation),
    "FACTS — state what happened, where, and who reported it; avoid opinions": String(
      merged.facts || merged.issueInBrief || reason || "As discussed with the employee",
    ),
    "IMPACT e.g. delay of 4 days in slab casting; Client escalation; safety risk to workers": String(
      merged.impact || "Impact on project delivery and team discipline",
    ),
    "CORRECTIVE_ACTION e.g. submit pending DPRs daily by 7 PM / ensure PPE compliance of your team": String(
      merged.correctiveAction || "Immediate corrective action and weekly review with reporting manager",
    ),
    "PREVIOUS_WARNINGS e.g. \"Verbal counselling on DD-MM-YYYY; Concern letter Ref. ... dated ...\" / \"None\"": String(
      merged.previousWarnings || "None",
    ),
    "Draft only / Sign within scope": String(merged.draftNote || "For approval"),
    Recommend: String(merged.recommend || "Yes"),
    Yes: String(merged.yes || "Yes"),
    "Yes / No": String(merged.yesNo || "Yes"),
    "Yes, as per QAP": String(merged.yesQap || "Yes, as per QAP"),
    "minor / major / gross": String(merged.severity || "minor"),
    "on resignation / on completion of engagement — strike out whichever is not applicable": String(
      merged.exitMode || "on resignation",
    ),
    "e.g. DPR, CCTV, email, witness": String(merged.evidence || "DPR, email records"),
    "e.g. No escalations; feedback ≥ 4/5": String(merged.clientFeedback || "No escalations; feedback ≥ 4/5"),
    "e.g. SPI ≥ 0.95": String(merged.spi || "SPI ≥ 0.95"),
    "e.g. Zero reportable incidents": String(merged.hseMetric || "Zero reportable incidents"),
    "Up to ₹ ___ per bill": String(merged.perBillLimit || "As per policy"),
    "Up to ₹ ___ per item": String(merged.perItemLimit || "As per policy"),
    "FOR OTHER ROLES, REPLACE WITH KRAs FROM PORTAL ROLE MASTER": String(
      merged.kraNote || "KRAs as per SPDC role master for this designation",
    ),
    "INSERT ROLE KRAs FROM PORTAL ROLE MASTER": String(
      merged.kraNote || "KRAs as per SPDC role master for this designation",
    ),
    "REVIEW_MONTHS e.g. 6": String(merged.reviewMonths || "6"),
    "LATE_MARKS e.g. 3": String(merged.lateMarks || "3"),
    GIFT_LIMIT: String(merged.giftLimit || "1,000"),
    "GIFT_LIMIT e.g. 1,000": String(merged.giftLimit || "1,000"),
    TRAINING_THRESHOLD: String(merged.trainingThreshold || "10,000"),
    "TRAINING_THRESHOLD e.g. 10,000": String(merged.trainingThreshold || "10,000"),
    "PROJECT_1 e.g. PEB industrial shed with admin building": String(merged.project1 || projectName),
    PROJECT_2: String(merged.project2 || "—"),
    FROM_2: String(merged.from2 || "—"),
    TO_2: String(merged.to2 || "—"),
    PERSONAL_EMAIL: String(merged.personalEmail || email),
    NDA_J_REF: String(merged.ndaJoiningRef || row.refNo),
    NDA_J_DATE: String(merged.ndaJoiningDate || joinDate),
    NEW_EMPLOYER: String(merged.newEmployer || "____________"),
    "FROM–TO": String(merged.fromTo || `${joinDate} – ${effectiveDate}`),
    "resignation / termination / completion of engagement / retirement": String(
      merged.separationReason || "resignation",
    ),
    "e.g. drawings, BOQ, rates, RA bills, claims": String(
      merged.confidentialItems || "drawings, BOQ, rates, RA bills, claims",
    ),
    "DISCLOSURE or \"None\"": String(merged.disclosure || "None"),
    "20": String(merged.assetPct20 || "20"),
    "25": String(merged.assetPct25 || "25"),
    "33.33": String(merged.assetPct33 || "33.33"),
  };

  // Allow HR to pass exact template tokens in the data blob.
  // Name tokens are applied again after this loop so a stale CANDIDATE_NAME
  // cannot print a different person under the letterhead.
  const locked = new Set([
    "EMPLOYEE_NAME",
    "CANDIDATE_NAME",
    "employeeName",
    "candidateName",
    "JOINING_DATE",
    "LAST_WORKING_DATE",
    "CONFIRMATION_DATE",
    "RESIGNATION_DATE",
    "END_DATE",
    "ABSENCE_NOTICE_DATE",
    "TERMINATION_LETTER_DATE",
    "RETIREMENT_DATE",
    "SHORTFALL",
    "BASIC",
    "HRA",
    "GROSS",
    "NET",
    "CONVEYANCE",
    "MEDICAL",
    "SPECIAL",
    "SITE_ALLOWANCE",
    "DEDUCTIONS",
    "EMPLOYER_CONTRIB",
    "EMP_PF",
    "EMP_ESI",
    "ER_PF_ESI",
    "GRATUITY",
    "BONUS",
    "INSURANCE",
    "PT",
    "TOTAL_DED",
    "ANNUAL_CTC",
    "LIMIT",
    "DATE",
    "REVIEW_DATE",
    "OFFICIAL_EMAIL",
    "CLIENT / PROJECT",
  ]);
  for (const [k, v] of Object.entries(merged)) {
    if (locked.has(k) || locked.has(k.toUpperCase())) continue;
    if (v == null || typeof v === "object") continue;
    const val = String(v).trim();
    if (!val) continue;
    tokens[k] = val;
    tokens[k.toUpperCase()] = val;
  }
  tokens.EMPLOYEE_NAME = name;
  tokens.CANDIDATE_NAME = name;
  tokens.employeeName = name;
  tokens.candidateName = name;
  const authority = String(merged.newLimit || "").trim();
  if (authority) {
    tokens.LIMIT = authority;
    tokens.NEW_LIMIT = authority;
    tokens["Up to ₹ ___ per bill"] = `Up to ₹ ${authority} per bill`;
    tokens["Up to ₹ ___ per item"] = `Up to ₹ ${authority} per item`;
  }
  if (row.kind === "Experience" && /samanvay|corporate office/i.test(location) && !String(merged.projectLocation || "").trim()) {
    tokens.LOCATION = "—";
  }
  tokens.SHORTFALL = noticeShortfall(merged);
  tokens.LAST_WORKING_DATE = lastWorkingPrint;
  tokens.JOINING_DATE = joinDate;
  tokens.CONFIRMATION_DATE = confirmationDate;

  // Helpful INR aliases used in offer / appointment templates.
  if (fixedCtc > 0) {
    tokens["INR [9,00,000] per annum"] = `INR ${inrPlain(fixedCtc)} per annum`;
    tokens["INR [______] per annum (Rupees [________________] only)"] =
      `INR ${inrPlain(fixedCtc)} per annum (Rupees ${inrPlain(fixedCtc)} only)`;
  }
  if (newCtc > 0) tokens["INR [9,90,000] per annum"] = `INR ${inrPlain(newCtc)} per annum`;

  return tokens;
}

/** Word often splits {{TOKEN}} across multiple <w:r> runs — strip inner tags to resolve the key. */
function tokenKeyFromDocxPlaceholder(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

function replacePlaceholderRuns(xml: string, tokens: Record<string, string>): string {
  // Word splits "{{" across runs, and sometimes puts a proofing tag between the two braces.
  const re = /\{(?:<[^>]+>)*\{([\s\S]*?)\}(?:<[^>]+>)*\}/g;
  return xml.replace(re, (match, rawKey: string) => {
    const key = tokenKeyFromDocxPlaceholder(rawKey).replace(/\s+/g, " ").trim();
    if (!key || key.includes("{")) return match;
    if (Object.prototype.hasOwnProperty.call(tokens, key)) return escapeXml(tokens[key] ?? "");
    return match;
  });
}

function decodeXmlText(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

/** Replace a phrase that Word has split across several <w:t> runs. */
function replaceVisibleText(xml: string, phrase: string, replacement: string): string {
  const re = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
  const nodes: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) nodes.push({ start: m.index, end: m.index + m[0].length, text: decodeXmlText(m[2] || "") });
  const joined = nodes.map((n) => n.text).join("");
  const at = joined.indexOf(phrase);
  if (at < 0) return xml;
  let cursor = 0;
  let startNode = -1;
  let startChar = 0;
  let endNode = -1;
  let endChar = 0;
  nodes.forEach((n, i) => {
    const next = cursor + n.text.length;
    if (startNode < 0 && at < next) {
      startNode = i;
      startChar = at - cursor;
    }
    if (endNode < 0 && at + phrase.length <= next) {
      endNode = i;
      endChar = at + phrase.length - cursor;
    }
    cursor = next;
  });
  if (startNode < 0 || endNode < 0) return xml;
  const pieces = nodes.map((n, i) => {
    if (i < startNode || i > endNode) return n.text;
    if (i === startNode && i === endNode) return n.text.slice(0, startChar) + replacement + n.text.slice(endChar);
    if (i === startNode) return n.text.slice(0, startChar) + replacement;
    if (i === endNode) return n.text.slice(endChar);
    return "";
  });
  let out = "";
  let last = 0;
  nodes.forEach((n, i) => {
    out += xml.slice(last, n.start);
    const open = xml.slice(n.start, xml.indexOf(">", n.start) + 1);
    out += `${open}${escapeXml(pieces[i] ?? "")}</w:t>`;
    last = n.end;
  });
  out += xml.slice(last);
  return out;
}

function tickLabel(xml: string, label: string, on: boolean): string {
  if (!on) return xml;
  const spaced = replaceVisibleText(xml, `☐ ${label}`, `☑ ${label}`);
  if (spaced !== xml) return spaced;
  return replaceVisibleText(xml, `☐${label}`, `☑${label}`);
}

function polishLetterXml(xml: string, kind: string, merged: Record<string, unknown>, tokens: Record<string, string>): string {
  let out = xml;
  out = replaceVisibleText(out, "( IF APPLY )", "(if applicable)");
  const g = String(merged.gender || "").trim().toLowerCase();
  const relation = g.startsWith("f") ? "daughter of" : g.startsWith("m") ? "son of" : "";
  if (relation) out = replaceVisibleText(out, "son / daughter / wife of", relation);
  const signatory = String(merged.signatoryName || "").trim();
  if (signatory) out = replaceVisibleText(out, "Nirav Parekh", signatory);

  if (kind === "Appointment") {
    const cheques = String(merged.noOfCheques ?? "").trim();
    if (cheques === "0") {
      out = replaceVisibleText(
        out,
        "0 undated cheque(s) drawn on my own bank account, details of which are given below, as security for the due discharge of my obligations under the Agreement.",
        "no security cheques. None have been handed over, and this schedule does not apply.",
      );
    }
    const designation = String(tokens.DESIGNATION || merged.designation || "");
    if (!/project manager\s*\(site/i.test(designation)) {
      out = replaceVisibleText(
        out,
        "The responsibilities below are for a Project Manager (Site, PMC) and are indicative, not exhaustive.",
        `Duties of the ${designation || "role"} are those assigned in writing by the reporting manager. The site Project Manager list is not part of this letter.`,
      );
      out = out.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
        const header = xmlText(tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/)?.[0] || "");
        return header.includes("Responsibilities") && header.includes("Area") ? "" : tbl;
      });
    }
  }

  if (kind === "Promotion") {
    out = replaceVisibleText(out, "Security cheque limit (if applicable)", "Authority limit");
  }

  if (kind === "Warning") {
    const type = String(merged.letterType || "Concern").toLowerCase();
    out = tickLabel(out, "Letter of Concern (performance / minor lapse)", /concern|performance/.test(type) && !/show|first|final/.test(type));
    out = tickLabel(out, "First Warning", /first/.test(type));
    out = tickLabel(out, "Final Warning", /final/.test(type));
    out = tickLabel(out, "Show-Cause Notice (major / gross misconduct)", /show/.test(type));
    const sev = String(merged.severity || "minor").toLowerCase();
    const printed = `${sev} misconduct under Schedule VI of your Appointment Letter / unsatisfactory performance`;
    const replacement = sev.startsWith("gro")
      ? "gross misconduct under Schedule VI of your Appointment Letter"
      : sev.startsWith("maj")
        ? "major misconduct under Schedule VI of your Appointment Letter"
        : "unsatisfactory performance";
    out = replaceVisibleText(out, printed, replacement);
  }

  if (kind === "Exit") {
    const basis = String(merged.separationBasis || (merged.resignationDate ? "resignation" : "")).toLowerCase();
    out = tickLabel(out, "Resignation dated", basis.includes("resign") || Boolean(merged.resignationDate));
    out = tickLabel(out, "Termination by notice", basis.includes("termin") && !basis.includes("probation"));
    out = tickLabel(out, "Termination during probation", basis.includes("probation"));
    out = tickLabel(out, "Completion of fixed-term", basis.includes("fixed"));
    out = tickLabel(out, "Deemed voluntary abandonment", basis.includes("abandon"));
    out = tickLabel(out, "Retirement on", basis.includes("retir"));
  }
  return out;
}

/** Templates mark {{TOKEN}} in yellow — remove highlight/shading after fill so only updated text shows. */
function stripPlaceholderHighlightFromXml(xml: string): string {
  let out = xml;
  out = out.replace(/<w:highlight\b[^/]*\/>/g, "");
  out = out.replace(/<w:highlight\b[^>]*>[\s\S]*?<\/w:highlight>/g, "");
  out = out.replace(/<w:shd\b(?=[^>]*\bw:fill="(?:FFFF00|ffff00|yellow|FFF2CC|fff2cc)")[^/]*\/>/g, "");
  out = out.replace(/<w:shd\b(?=[^>]*\bw:fill="(?:FFFF00|ffff00|yellow|FFF2CC|fff2cc)")[^>]*>[\s\S]*?<\/w:shd>/g, "");
  return out;
}

function xmlText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** Rewrite a cell keeping its borders, paragraph style and first run's font. */
function setCellText(tc: string, value: string): string {
  const open = tc.match(/^<w:tc\b[^>]*>/)?.[0] || "<w:tc>";
  const tcPr = tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] || "";
  const p = tc.match(/<w:p\b[\s\S]*?<\/w:p>/)?.[0] || "<w:p></w:p>";
  const pPr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const rPr = p.replace(pPr, "").match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || "";
  const runs = value
    .split(/\r?\n/)
    .map((line) => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join(`<w:r>${rPr}<w:br/></w:r>`);
  return `${open}${tcPr}<w:p>${pPr}${value ? runs : ""}</w:p></w:tc>`;
}

function rowCells(tr: string): string[] {
  return tr.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
}

function setRowCells(tr: string, values: Map<number, string>): string {
  let i = 0;
  return tr.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, (tc) => {
    const idx = i++;
    return values.has(idx) ? setCellText(tc, values.get(idx)!) : tc;
  });
}

function cellValue(spec: HrLetterTable, col: number, raw: string): string {
  const value = formatIsoDatesIn(raw);
  if (/last 4/i.test(spec.columns[col]?.label || "") && /^\d{4}$/.test(value)) return `XXXX${value}`;
  return value;
}

function fillTable(tbl: string, spec: HrLetterTable, rows: string[][]): string {
  const trs = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (trs.length < 2) return tbl;
  const header = trs[0]!;
  const last = trs[trs.length - 1]!;
  const body = trs.slice(1);
  const out: string[] = [];
  if (spec.fixedRows) {
    body.forEach((tr, i) => {
      const values = new Map<number, string>();
      (rows[i] || []).forEach((v, j) => {
        if (v) values.set(spec.startCol + j, cellValue(spec, j, v));
      });
      out.push(values.size ? setRowCells(tr, values) : tr);
    });
  } else {
    const data = rows.filter((r) => r.some(Boolean));
    const width = rowCells(last).length;
    const blankLast = setRowCells(last, new Map(Array.from({ length: width }, (_, k) => [k, ""])));
    data.forEach((r, i) => {
      const values = new Map<number, string>();
      if (spec.numbered) values.set(0, String(i + 1));
      spec.columns.forEach((_, j) => values.set(spec.startCol + j, cellValue(spec, j, r[j] || "")));
      out.push(setRowCells(body[i] ?? blankLast, values));
    });
    for (const tr of body.slice(data.length)) {
      const values = new Map<number, string>();
      rowCells(tr).forEach((tc, k) => {
        if (k >= spec.startCol && tc.includes("{{")) values.set(k, "");
      });
      out.push(values.size ? setRowCells(tr, values) : tr);
    }
  }
  const before = tbl.slice(0, tbl.indexOf(header));
  const after = tbl.slice(tbl.lastIndexOf(last) + last.length);
  return `${before}${header}${out.join("")}${after}`;
}

/** Multi-row tables (assets, KRAs, cheques, projects…) — see HR_LETTER_TABLES. */
export function fillHrmsTables(xml: string, kind: string, data: Record<string, unknown>): string {
  const specs = HR_LETTER_TABLES[kind] || [];
  if (!specs.length) return xml;
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const header = xmlText(tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/)?.[0] || "");
    const spec = specs.find((s) => header.includes(s.headerMatch));
    if (!spec) return tbl;
    if (spec.key === "chequeRows" && String(data.noOfCheques ?? "").trim() === "0") {
      return fillTable(tbl, spec, [["Not applicable", "—", "—", "—"]]);
    }
    const rows = parseHrLetterTable(data[spec.key]);
    return hrLetterTableHasData(rows) ? fillTable(tbl, spec, rows) : tbl;
  });
}

export async function fillHrmsDocx(
  template: Buffer,
  tokens: Record<string, string>,
  tables?: { kind: string; data: Record<string, unknown> },
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const xmlParts = Object.keys(zip.files).filter((k) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(k),
  );
  for (const part of xmlParts) {
    const entry = zip.file(part);
    if (!entry) continue;
    let xml = await entry.async("string");
    if (tables && part === "word/document.xml") xml = fillHrmsTables(xml, tables.kind, tables.data);
    xml = replacePlaceholderRuns(xml, tokens);
    if (tables && part === "word/document.xml") xml = polishLetterXml(xml, tables.kind, tables.data, tokens);
    xml = stripPlaceholderHighlightFromXml(xml);
    zip.file(part, xml);
  }
  const settings = zip.file("word/settings.xml");
  if (settings) {
    let settingsXml = await settings.async("string");
    if (!settingsXml.includes("<w:updateFields")) {
      settingsXml = settingsXml.replace("</w:settings>", '<w:updateFields w:val="true"/></w:settings>');
      zip.file("word/settings.xml", settingsXml);
    }
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

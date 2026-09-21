/**
 * Fill SPDC HR letter .docx templates (apps/api/formats/hrms/<Kind>.docx).
 * Templates use {{TOKEN}} placeholders — see 00_SPDC_HR_Letters_Usage_Guide.docx.
 */
import JSZip from "jszip";
import type { HrmsDocument } from "@prisma/client";
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

function inrPlain(v: unknown): string {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
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

function rowFromBreakdown(breakdown: CtcBreakdown | null | undefined, labelIncludes: string): number {
  if (!breakdown) return 0;
  const all = [...breakdown.partA.rows, ...breakdown.partB.rows, ...breakdown.partC.rows];
  const hit = all.find((r) => r.label.toLowerCase().includes(labelIncludes.toLowerCase()));
  return hit?.perAnnum ?? 0;
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
  merged: Record<string, unknown>,
  breakdown?: CtcBreakdown | null,
): Record<string, string> {
  const ref = parseRefNo(row.refNo);
  const name = String(merged.employeeName || merged.candidateName || row.employeeName || "").trim();
  const designation = String(merged.designation || row.designation || "").trim();
  const department = String(merged.department || row.department || "").trim();
  const email = String(merged.candidateEmail || row.candidateEmail || "").trim();
  const phone = String(merged.phone || merged.mobile || "").trim();
  const location = String(merged.location || merged.placeOfPosting || "SPDC Corporate Office, Vadodara").trim();
  const address = String(merged.address || merged.addressAsPerRecords || merged.candidateAddress || "____________").trim();
  const issueDate = String(merged.issueDate || fmtDate(row.issueDate));
  const joinDate = String(merged.joinDate || merged.effectiveDate || fmtDate(row.effectiveDate));
  const effectiveDate = String(merged.effectiveDate || joinDate);
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

  const basic = rowFromBreakdown(breakdown, "basic");
  const hra = rowFromBreakdown(breakdown, "house rent");
  const gross = breakdown?.partA.gross.perAnnum ?? 0;
  const net = breakdown?.partC.indicativeNet.perAnnum ?? 0;
  const conveyance = rowFromBreakdown(breakdown, "conveyance");
  const medical = rowFromBreakdown(breakdown, "mediclaim");
  const special = rowFromBreakdown(breakdown, "special");
  const siteAllowance = rowFromBreakdown(breakdown, "site");
  const deductions = breakdown?.partC.rows.reduce((s, r) => s + (r.perAnnum || 0), 0) ?? 0;
  const employerContrib = breakdown?.partB.total.perAnnum ?? 0;

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
    DATE: issueDate,
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
    "CLIENT / PROJECT": String(merged.clientProject || projectName),
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
    CONFIRMATION_DATE: effectiveDate,
    LAST_WORKING_DATE: effectiveDate,
    RESIGNATION_DATE: String(merged.resignationDate || effectiveDate),
    PROBATION_END_DATE: String(merged.probationEndDate || effectiveDate),
    OFFER_DATE: String(merged.offerDate || issueDate),
    OFFER_REF_NO: String(merged.offerRefNo || row.refNo),
    APPOINTMENT_DATE: String(merged.appointmentDate || joinDate),
    APPOINTMENT_REF_NO: String(merged.appointmentRefNo || row.refNo),
    APPLICATION_DATE: String(merged.applicationDate || issueDate),
    INTERVIEW_DATES: String(merged.interviewDates || merged.selectionDate || joinDate),
    SELECTION_DATE: String(merged.selectionDate || joinDate),
    ACCEPTANCE_DATE: String(merged.acceptanceDate || issueDate),
    ANNUAL_CTC: inrPlain(fixedCtc) || inrPlain(newCtc) || "____________",
    CURRENT_CTC: inrPlain(currentCtc) || "____________",
    NEW_CTC: inrPlain(newCtc) || inrPlain(fixedCtc) || "____________",
    "REVISED_CTC or \"No change\"": inrPlain(newCtc) || "No change",
    BASIC: inrPlain(basic),
    HRA: inrPlain(hra),
    GROSS: inrPlain(gross),
    NET: inrPlain(net),
    CONVEYANCE: inrPlain(conveyance),
    MEDICAL: inrPlain(medical),
    SPECIAL: inrPlain(special),
    SITE_ALLOWANCE: inrPlain(siteAllowance),
    DEDUCTIONS: inrPlain(deductions),
    EMPLOYER_CONTRIB: inrPlain(employerContrib),
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
    OTHER_ITEM: String(merged.otherItem || merged.assets || "____________"),
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
    PERIOD: String(merged.period || `${joinDate} to ${effectiveDate}`),
    FROM_1: String(merged.from1 || joinDate),
    TO_1: String(merged.to1 || effectiveDate),
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
    NO_OF_CHEQUES: String(merged.noOfCheques || "—"),
    BONUS: String(merged.bonus || inrPlain(rowFromBreakdown(breakdown, "performance")) || "As per policy"),
    GRATUITY: String(merged.gratuity || inrPlain(rowFromBreakdown(breakdown, "gratuity")) || "As per Gratuity Act"),
    INSURANCE: String(merged.insurance || inrPlain(medical) || "As per policy"),
    PT: String(merged.pt || inrPlain(rowFromBreakdown(breakdown, "professional tax")) || "As per state rules"),
    EMP_PF: String(merged.empPf || inrPlain(rowFromBreakdown(breakdown, "employee pf")) || "As per PF rules"),
    EMP_ESI: String(merged.empEsi || inrPlain(rowFromBreakdown(breakdown, "employee esi")) || "As applicable"),
    ER_PF_ESI: String(merged.erPfEsi || inrPlain(employerContrib) || "As per PF/ESI rules"),
    TOTAL_DED: String(merged.totalDed || inrPlain(deductions) || "As per Annexure I"),
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
    REVIEW_DATE: String(merged.reviewDate || issueDate),
    REVIEW_CYCLE: String(merged.reviewCycle || "Half-yearly"),
    REVIEWER: String(merged.reviewer || reporting),
    INSPECTION_DAYS: String(merged.inspectionDays || "7"),
    "INSPECTION_DAYS e.g. 7": String(merged.inspectionDays || "7"),
    OFFICIAL_EMAIL: String(merged.officialEmail || email),
    CLIENT_NAME: String(merged.clientName || merged.client || projectName),
    APPROVER: String(merged.approver || reporting),
    HANDOVER_DATE: String(merged.handoverDate || effectiveDate),
    END_DATE: String(merged.endDate || effectiveDate),
    GARDEN_LEAVE_FROM: String(merged.gardenLeaveFrom || "—"),
    GARDEN_LEAVE_TO: String(merged.gardenLeaveTo || "—"),
    ABSENCE_NOTICE_DATE: String(merged.absenceNoticeDate || effectiveDate),
    TERMINATION_LETTER_DATE: String(merged.terminationLetterDate || "—"),
    RETIREMENT_DATE: String(merged.retirementDate || "—"),
    "RETIREMENT_AGE e.g. 58": String(merged.retirementAge || "58"),
    WAIVED_DAYS: String(merged.waivedDays || "0"),
    WAIVER_DATE: String(merged.waiverDate || "—"),
    SHORTFALL: String(merged.shortfall || "Nil"),
    DAYS: String(merged.days || "—"),
    LAST4: String(merged.last4 || "—"),
    FIELD: String(merged.field || department),
    LIMIT: String(merged.limit || "As per policy"),
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
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || typeof v === "object") continue;
    const val = String(v).trim();
    if (!val) continue;
    tokens[k] = val;
    tokens[k.toUpperCase()] = val;
  }

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

export async function fillHrmsDocx(template: Buffer, tokens: Record<string, string>): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const xmlParts = Object.keys(zip.files).filter((k) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(k));
  for (const part of xmlParts) {
    const entry = zip.file(part);
    if (!entry) continue;
    let xml = await entry.async("string");
    xml = xml.replace(/\{\{((?:[^{}]|<[^>]*>)*?)\}\}/g, (match, rawKey: string) => {
      const key = tokenKeyFromDocxPlaceholder(rawKey);
      if (Object.prototype.hasOwnProperty.call(tokens, key)) return escapeXml(tokens[key] ?? "");
      return match;
    });
    zip.file(part, xml);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

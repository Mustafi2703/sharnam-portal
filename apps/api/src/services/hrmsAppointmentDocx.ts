/**
 * Fill SPDC_Letter_of_Appointment.docx bracket placeholders from HRMS form data.
 * Template: module_prompts/Sharnam_modules_docs 2/SPDC_Letter_of_Appointment.docx
 */
import JSZip from "jszip";
import type { CtcBreakdown } from "./ctcAnnexure.js";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inrPlain(v: unknown): string {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function splitAddress(data: Record<string, unknown>) {
  const line1 = String(data.addressLine1 || "").trim();
  const line2 = String(data.addressLine2 || "").trim();
  const city = String(data.city || "").trim();
  const pin = String(data.pin || data.pincode || "").trim();
  const state = String(data.state || "").trim();
  const raw = String(data.address || "").trim();
  if (line1 || line2 || city) return { line1: line1 || raw || "____________", line2, city, pin, state };
  if (!raw || raw === "____________") return { line1: "____________", line2: "", city: "", pin: "", state: "" };
  const parts = raw.split(/[,|\n]/).map((p) => p.trim()).filter(Boolean);
  return {
    line1: parts[0] || raw,
    line2: parts[1] || "",
    city: parts[2] || city,
    pin: parts[3]?.replace(/\D/g, "") || pin,
    state: parts[4] || state,
  };
}

/** Ordered replacements — longer / contextual strings first. */
export function buildAppointmentDocxReplacements(
  row: { refNo: string },
  merged: Record<string, unknown>,
  breakdown?: CtcBreakdown | null,
): Array<[string, string]> {
  const name = String(merged.employeeName || "").trim();
  const firstName = String(merged.firstName || name.split(/\s+/).filter(Boolean)[0] || "").trim();
  const designation = String(merged.designation || "").trim();
  const department = String(merged.department || "").trim();
  const location = String(merged.location || merged.placeOfPosting || "SPDC Corporate Office, Vadodara").trim();
  const issueDate = String(merged.issueDate || "");
  const joinDate = String(merged.joinDate || merged.effectiveDate || issueDate);
  const selectionDate = String(merged.selectionDate || joinDate);
  const email = String(merged.candidateEmail || "").trim();
  const phone = String(merged.phone || merged.mobile || "").trim();
  const reporting = String(merged.reportingManager || merged.reportingTo || "—").trim();
  const functional = String(merged.functionalManager || reporting).trim();
  const grade = String(merged.grade || merged.band || "As per SPDC Grade Structure").trim();
  const refNo = row.refNo.trim();
  const addr = splitAddress(merged);
  const projectSite = String(merged.projectSite || merged.siteLocation || "").trim();

  const fixedCtc =
    breakdown?.inputs.fixedCtcAnnual ??
    Number(String(merged.fixedCtcAnnual ?? merged.ctcAnnual ?? merged.ctc ?? "").replace(/[^\d.]/g, ""));
  const perfPct = breakdown ? Math.round(breakdown.inputs.performancePayPct * 100) : Number(merged.performancePayPct || 10) || 10;
  const perfPay = breakdown?.partB.performancePay.perAnnum ?? (fixedCtc > 0 ? Math.round(fixedCtc * (perfPct / 100)) : 0);
  const totalCtc = fixedCtc > 0 ? fixedCtc + perfPay : 0;
  const probation = String(merged.probationMonths || "6").trim();
  const probWords: Record<string, string> = { "3": "three (3)", "6": "six (6)", "12": "twelve (12)" };
  const probText = probWords[probation] || `${probation} (${probation})`;

  const cityLine =
    addr.city || addr.pin || addr.state
      ? `${addr.city || "____________"} – ${addr.pin || "____________"}, ${addr.state || "____________"}`
      : "____________ – ____________, ____________";

  const pairs: Array<[string, string]> = [
    ["SPDC/HR/OL/2026-27/[XXX]", refNo],
    [`Date:  [DD Month YYYY]`, `Date:  ${issueDate}`],
    [`concluded on [DD Month YYYY]`, `concluded on ${selectionDate}`],
    [`On or before [DD Month YYYY]`, `On or before ${joinDate}`],
    [`Effective: [DD Month YYYY]`, `Effective: ${joinDate}`],
    [
      `[Designation]  ·  [Discipline / Department]  ·  [Project / Base Location]`,
      `${designation}  ·  ${department}  ·  ${location}`,
    ],
    [
      `[Projects — Civil / Planning &amp; Controls / QS &amp; Billing / MEP / HSE / HR &amp; Admin]`,
      department || "Projects",
    ],
    [
      `[Name, Designation] — administratively; [Name, Designation] — functionally`,
      `${reporting} — administratively; ${functional} — functionally`,
    ],
    [
      `[SPDC Corporate Office, Vadodara] / [Project Site: ____________]`,
      projectSite ? `${location} / ${projectSite}` : location,
    ],
    [
      `Fixed Cost to Company: INR [9,00,000] per annum   Performance Pay: Up to [10]% of Fixed CTC   Total CTC: INR [9,90,000] per annum`,
      fixedCtc > 0
        ? `Fixed Cost to Company: INR ${inrPlain(fixedCtc)} per annum   Performance Pay: Up to ${perfPct}% of Fixed CTC   Total CTC: INR ${inrPlain(totalCtc)} per annum`
        : `Fixed Cost to Company: INR [9,00,000] per annum   Performance Pay: Up to [10]% of Fixed CTC   Total CTC: INR [9,90,000] per annum`,
    ],
    [
      `INR [______] per annum (Rupees [________________] only)`,
      fixedCtc > 0
        ? `INR ${inrPlain(fixedCtc)} per annum (Rupees ${inrPlain(fixedCtc)} only)`
        : `INR [______] per annum (Rupees [________________] only)`,
    ],
    [`INR [9,00,000] per annum`, fixedCtc > 0 ? `INR ${inrPlain(fixedCtc)} per annum` : `INR [9,00,000] per annum`],
    [`INR [9,90,000] per annum`, totalCtc > 0 ? `INR ${inrPlain(totalCtc)} per annum` : `INR [9,90,000] per annum`],
    [`Up to [__]% of Fixed CTC`, `Up to ${perfPct}% of Fixed CTC`],
    [`Up to [10]% of Fixed CTC`, `Up to ${perfPct}% of Fixed CTC`],
    [`Mobile: [ ]   |   E-mail: [ ]`, `Mobile: ${phone || "____________"}   |   E-mail: ${email || "____________"}`],
    [`Mr. / Ms. [Candidate Full Name]`, name ? `Mr. / Ms. ${name}` : `Mr. / Ms. [Candidate Full Name]`],
    [`Dear [Mr. / Ms. First Name],`, firstName ? `Dear Mr. / Ms. ${firstName},` : `Dear [Mr. / Ms. First Name],`],
    [`[e.g. Planning Engineer / Senior Site Engineer (Civil) / QA-QC Engineer]`, designation || "[Designation]"],
    [`[e.g. E2 — Engineer / M1 — Manager]`, grade],
    [`[six (6)]`, probText],
    [`[Address Line 1] , [Address Line 2]`, addr.line2 ? `${addr.line1} , ${addr.line2}` : addr.line1],
    [`[Address Line 1]`, addr.line1],
    [`[Address Line 2]`, addr.line2],
    [`[City] – [PIN], [State]`, cityLine],
    [`[Candidate Full Name]`, name],
    [`[Mr. / Ms. First Name]`, firstName],
    [`[Designation]`, designation],
    [`[Discipline / Department]`, department],
    [`[Project / Base Location]`, location],
    [`[Function]`, department],
    [`[Name]`, reporting.split(",")[0]?.trim() || "Authorised Signatory"],
    [`[Managing Partner / Head – Human Resources]`, "Managing Partner / Head – Human Resources"],
    [`[DD Month YYYY]`, issueDate],
  ];

  return pairs.filter(([from, to]) => from && from !== to);
}

export async function fillAppointmentDocx(template: Buffer, replacements: Array<[string, string]>): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const xmlParts = Object.keys(zip.files).filter((k) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(k));
  for (const part of xmlParts) {
    const entry = zip.file(part);
    if (!entry) continue;
    let xml = await entry.async("string");
    for (const [from, to] of replacements) {
      xml = xml.split(from).join(escapeXml(to));
    }
    zip.file(part, xml);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

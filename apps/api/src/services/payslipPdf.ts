/**
 * KGDPL-style payslip HTML — reference:
 * module_prompts/Sharnam_modules_docs 2/KGDPL_JUN_2026_9210100157_Payslip.pdf
 */
import type { Payslip, User, EmployeeProfile } from "@prisma/client";
import { sharnamLogoDataUri } from "./brandedExport.js";
import { ctcMonthlyEarnings } from "./ctcAnnexure.js";

export type PayslipRenderInput = {
  payslip: Payslip;
  user: Pick<User, "fullName" | "email">;
  profile: EmployeeProfile | null;
  companyName?: string;
};

function inr(v: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function monthShort(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function dash(v?: string | null) {
  const text = String(v || "").trim();
  return text || "—";
}

function istDate(d?: Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(dt);
}

/** Full-month lines from the SPDC CTC calculator. Payslip rows are these lines prorated by paid days. */
export function earningsFromProfile(profile: EmployeeProfile | null, paidFactor: number) {
  if (!profile?.ctcAnnual) return null;
  const full = ctcMonthlyEarnings(profile.ctcAnnual, profile.designation || "");
  const scale = (n: number) => Math.round(n * paidFactor);
  const basic = scale(full.basic);
  const hra = scale(full.hra);
  const conveyance = scale(full.conveyance);
  const gross = scale(full.gross);
  const specialAllow = Math.max(0, gross - basic - hra - conveyance);
  return {
    basic,
    hra,
    conveyance,
    medicalAllow: 0,
    specialAllow,
    gross,
    pfEmployee: scale(full.pfEmployee),
    esicEmployee: full.esicEmployee > 0 ? scale(full.esicEmployee) : 0,
    professionalTax: paidFactor > 0 ? full.professionalTax : 0,
  };
}

export function buildPayslipHtml(input: PayslipRenderInput): string {
  const { payslip: p, user, profile } = input;
  const company = input.companyName || "Sharnam Project Development Consultants & Co.";
  const logo = sharnamLogoDataUri();
  const stored =
    (p.basic || 0) + (p.hra || 0) + (p.grossEarnings || 0) + (p.netPay || 0);
  const factor = p.workingDays > 0 ? p.paidDays / p.workingDays : 1;
  const fromProfile = stored > 0 ? null : earningsFromProfile(profile, factor);

  const basic = p.basic || fromProfile?.basic || 0;
  const hra = p.hra || fromProfile?.hra || 0;
  const conveyance = p.conveyance || fromProfile?.conveyance || 0;
  const medicalAllow = p.medicalAllow || fromProfile?.medicalAllow || 0;
  const specialAllow = p.specialAllow || fromProfile?.specialAllow || 0;
  const otherEarnings = p.otherEarnings || 0;
  const gross = p.grossEarnings || fromProfile?.gross || basic + hra + conveyance + medicalAllow + specialAllow + otherEarnings;
  const pfEmployee = p.pfEmployee || fromProfile?.pfEmployee || 0;
  const esicEmployee = p.esicEmployee || fromProfile?.esicEmployee || 0;
  const professionalTax = p.professionalTax || fromProfile?.professionalTax || 0;
  const incomeTax = p.incomeTax || 0;
  const otherDeduction = p.otherDeduction || 0;
  const totalDeductions = p.totalDeductions || pfEmployee + esicEmployee + professionalTax + incomeTax + otherDeduction;
  const netPay = p.netPay || gross - totalDeductions;

  const empCode = profile?.empCode || user.email.split("@")[0].toUpperCase();
  const designation = profile?.designation || "—";
  const department = profile?.department || "—";
  const master = profile?.ctcAnnual ? ctcMonthlyEarnings(profile.ctcAnnual, profile.designation || "") : null;
  const periodTag = `${monthShort(p.year, p.month)}-${p.year}`;
  const checksum = `SPDC^PS^${empCode}^${monthShort(p.year, p.month)}^${p.year}`;
  const roundedNet = Math.round(netPay);
  const roundAdj = Math.round((roundedNet - netPay) * 100) / 100;
  const pair = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) =>
    `<tr><td class="lbl">${leftLabel}</td><td>${leftValue}</td><td class="lbl">${rightLabel}</td><td>${rightValue}</td></tr>`;
  const earn = (label: string, masterAmt: number, currentAmt: number, dedLabel: string, dedAmt: number) =>
    `<tr><td>${label}</td><td class="num">${inr(masterAmt)}</td><td class="num">${inr(currentAmt)}</td><td>${dedLabel}</td><td class="num">${dedLabel ? inr(dedAmt) : ""}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Payslip ${periodTag} — ${user.fullName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Courier New", Courier, monospace; color: #111; font-size: 9.5pt; margin: 0; background: #fff; }
  .sheet { max-width: 820px; margin: 0 auto; border: 1px solid #333; padding: 14px 16px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .top img { height: 44px; }
  .co { font-weight: 700; font-size: 11pt; line-height: 1.3; }
  .co small { display: block; font-weight: 400; font-size: 8.5pt; }
  .slip-title { text-align: center; font-weight: 700; font-size: 11pt; letter-spacing: 0.08em; margin: 8px 0; text-transform: uppercase; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
  .meta td { padding: 3px 6px; vertical-align: top; border: none; }
  .meta .lbl { width: 22%; font-weight: 700; }
  table.grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9pt; }
  table.grid th, table.grid td { border: 1px solid #333; padding: 4px 6px; }
  table.grid th { background: #eee; text-align: left; font-weight: 700; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .net-row td { font-weight: 700; background: #f5f5f5; }
  footer { margin-top: 10px; font-size: 8pt; color: #444; text-align: center; border-top: 1px dashed #999; padding-top: 6px; }
  .checksum { font-size: 7.5pt; color: #666; text-align: right; margin-top: 4px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <div class="co">
      ${company}
      <small>Salary slip · ${monthLabel(p.year, p.month)}</small>
    </div>
    ${logo ? `<img src="${logo}" alt="Sharnam"/>` : ""}
  </div>
  <div class="slip-title">Payslip for the month of ${monthLabel(p.year, p.month)}</div>
  <table class="meta">
    ${pair("Employee no.", empCode, "PAN", dash(profile?.panNumber))}
    ${pair("Name", user.fullName, "Bank name", dash(profile?.bankName))}
    ${pair("Joining date", istDate(profile?.joinDate), "Bank A/C no.", dash(profile?.bankAccountNo))}
    ${pair("Designation", designation, "IFSC", dash(profile?.bankIfsc))}
    ${pair("Grade", dash(profile?.grade), "ESI no.", dash(profile?.esicNumber))}
    ${pair("Band", dash(profile?.band), "Aadhaar", dash(profile?.aadhaarNumber))}
    ${pair("Cost center", dash(profile?.costCenter), "PF no.", dash(profile?.pfNumber))}
    ${pair("Payroll area", dash(profile?.payrollArea), "PF UAN", dash(profile?.uanNumber))}
    ${pair("Department", department, "Birth date", istDate(profile?.dateOfBirth))}
    ${pair("Location", dash(profile?.workLocation), "Pay days", `${p.paidDays} / ${p.workingDays}${p.lopDays ? ` · loss of pay ${p.lopDays}` : ""}`)}
  </table>
  <table class="grid">
    <thead>
      <tr>
        <th>Earnings</th><th class="num">Master (₹)</th><th class="num">This month (₹)</th>
        <th>Deductions</th><th class="num">This month (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${earn("Basic", master?.basic ?? basic, basic, "Statutory PF", pfEmployee)}
      ${earn("HRA", master?.hra ?? hra, hra, "Professional tax", professionalTax)}
      ${earn("Conveyance", master?.conveyance ?? conveyance, conveyance, "ESIC", esicEmployee)}
      ${earn("Special allowance", master?.specialAllowance ?? specialAllow, specialAllow, "TDS", incomeTax)}
      ${otherEarnings || otherDeduction ? earn("Other earnings", otherEarnings, otherEarnings, otherDeduction ? "Other deduction" : "", otherDeduction) : ""}
      <tr class="net-row"><td>Gross earnings</td><td class="num">${inr(master?.gross ?? gross)}</td><td class="num">${inr(gross)}</td><td>Total deductions</td><td class="num">${inr(totalDeductions)}</td></tr>
      <tr class="net-row"><td colspan="3">Net pay</td><td></td><td class="num">${inr(netPay)}</td></tr>
      ${roundAdj ? `<tr><td colspan="3">Rounding</td><td></td><td class="num">${inr(roundAdj)}</td></tr>` : ""}
      <tr class="net-row"><td colspan="3">Rounded net (Rupees ${roundedNet.toLocaleString("en-IN")} only)</td><td></td><td class="num">${inr(roundedNet)}</td></tr>
    </tbody>
  </table>
  <footer>System-generated payslip · Sharnam HRMS · Print → Save as PDF · Confidential</footer>
  <div class="checksum">${checksum}</div>
</div>
</body>
</html>`;
}

/**
 * KGDPL-style payslip HTML — reference:
 * module_prompts/Sharnam_modules_docs 2/KGDPL_JUN_2026_9210100157_Payslip.pdf
 */
import type { Payslip, User, EmployeeProfile } from "@prisma/client";
import { sharnamLogoDataUri } from "./brandedExport.js";

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

/** Derive monthly earnings from employee profile CTC when available. */
export function earningsFromProfile(profile: EmployeeProfile | null, paidFactor: number) {
  if (!profile) return null;
  const grossMonthly = profile.ctcAnnual ? profile.ctcAnnual / 12 : 0;
  const basic = profile.basicMonthly || grossMonthly * 0.5;
  const hra = profile.hraMonthly || basic * 0.4;
  const conveyance = 1600;
  const medical = 1250;
  const special = Math.max(0, (grossMonthly || basic + hra + conveyance + medical) - basic - hra - conveyance - medical);
  const pf = Math.min(basic, 15000) * 0.12;
  const pt = 200;
  const esic = grossMonthly <= 21000 ? grossMonthly * 0.0075 : 0;
  return {
    basic: basic * paidFactor,
    hra: hra * paidFactor,
    conveyance: conveyance * paidFactor,
    medicalAllow: medical * paidFactor,
    specialAllow: special * paidFactor,
    gross: (basic + hra + conveyance + medical + special) * paidFactor,
    pfEmployee: pf * paidFactor,
    esicEmployee: esic * paidFactor,
    professionalTax: pt,
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
  const empNo = empCode.replace(/[^0-9A-Z]/gi, "").slice(-10) || "0000000000";
  const designation = profile?.designation || "—";
  const department = profile?.department || "Operations";
  const bankAccount = profile?.bankAccountNo || "—";
  const pan = profile?.panNumber || "—";
  const uan = profile?.pfNumber || "—";
  const periodTag = `${monthShort(p.year, p.month)}-${p.year}`;
  const checksum = `KGDPL^PS^${empNo}^${monthShort(p.year, p.month)}^${p.year}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Payslip ${periodTag} — ${user.fullName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Courier New", Courier, monospace; color: #111; font-size: 9.5pt; margin: 0; background: #fff; }
  .sheet { max-width: 720px; margin: 0 auto; border: 1px solid #333; padding: 14px 16px; }
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
  <div class="slip-title">Pay Slip · ${periodTag}</div>
  <table class="meta">
    <tr><td class="lbl">Employee</td><td>${user.fullName}</td><td class="lbl">Emp. code</td><td>${empCode}</td></tr>
    <tr><td class="lbl">Designation</td><td>${designation}</td><td class="lbl">Department</td><td>${department}</td></tr>
    <tr><td class="lbl">PAN</td><td>${pan}</td><td class="lbl">UAN / PF</td><td>${uan}</td></tr>
    <tr><td class="lbl">Bank A/C</td><td>${bankAccount}</td><td class="lbl">Pay days</td><td>${p.paidDays} / ${p.workingDays}${p.lopDays ? ` (LOP ${p.lopDays})` : ""}</td></tr>
  </table>
  <table class="grid">
    <thead>
      <tr><th>Earnings</th><th class="num">Amount (₹)</th><th>Deductions</th><th class="num">Amount (₹)</th></tr>
    </thead>
    <tbody>
      <tr><td>Basic Salary</td><td class="num">${inr(basic)}</td><td>PF (Employee)</td><td class="num">${inr(pfEmployee)}</td></tr>
      <tr><td>House Rent Allowance</td><td class="num">${inr(hra)}</td><td>ESIC</td><td class="num">${inr(esicEmployee)}</td></tr>
      <tr><td>Conveyance Allowance</td><td class="num">${inr(conveyance)}</td><td>Professional Tax</td><td class="num">${inr(professionalTax)}</td></tr>
      <tr><td>Medical / Children Edu.</td><td class="num">${inr(medicalAllow)}</td><td>Income Tax (TDS)</td><td class="num">${inr(incomeTax)}</td></tr>
      <tr><td>Special Allowance</td><td class="num">${inr(specialAllow)}</td><td>Other deduction</td><td class="num">${inr(otherDeduction)}</td></tr>
      ${otherEarnings ? `<tr><td>Other earnings</td><td class="num">${inr(otherEarnings)}</td><td></td><td class="num"></td></tr>` : ""}
      <tr class="net-row"><td>Gross earnings</td><td class="num">${inr(gross)}</td><td>Total deductions</td><td class="num">${inr(totalDeductions)}</td></tr>
      <tr class="net-row"><td colspan="2">Net pay (Rupees ${Math.round(netPay).toLocaleString("en-IN")} only)</td><td>Net pay</td><td class="num">${inr(netPay)}</td></tr>
    </tbody>
  </table>
  <footer>System-generated payslip · Sharnam HRMS · Print → Save as PDF · Confidential</footer>
  <div class="checksum">${checksum}</div>
</div>
</body>
</html>`;
}

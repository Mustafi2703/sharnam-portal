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
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
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
  const factor = p.workingDays > 0 ? p.paidDays / p.workingDays : 1;
  const fromProfile = earningsFromProfile(profile, factor);

  const basic = fromProfile?.basic ?? p.basic;
  const hra = fromProfile?.hra ?? p.hra;
  const conveyance = fromProfile?.conveyance ?? p.conveyance;
  const medicalAllow = fromProfile?.medicalAllow ?? p.medicalAllow;
  const specialAllow = fromProfile?.specialAllow ?? p.specialAllow;
  const gross = fromProfile?.gross ?? p.grossEarnings;
  const pfEmployee = fromProfile?.pfEmployee ?? p.pfEmployee;
  const esicEmployee = fromProfile?.esicEmployee ?? p.esicEmployee;
  const professionalTax = fromProfile?.professionalTax ?? p.professionalTax;
  const netPay = gross - pfEmployee - esicEmployee - professionalTax - (p.incomeTax || 0);

  const empCode = profile?.empCode || user.email.split("@")[0].toUpperCase();
  const designation = profile?.designation || "—";
  const department = profile?.department || "Operations";
  const bankAccount = profile?.bankAccountNo || "—";
  const pan = profile?.panNumber || "—";
  const uan = profile?.pfNumber || "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Payslip ${monthLabel(p.year, p.month)} — ${user.fullName}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1d26; font-size: 10pt; margin: 0; }
  .sheet { max-width: 780px; margin: 0 auto; border: 1px solid #d5dadd; padding: 20px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7B4DFF; padding-bottom: 12px; margin-bottom: 16px; }
  .head img { height: 52px; }
  .head h1 { margin: 0; font-size: 14pt; }
  .head p { margin: 4px 0 0; color: #5c6578; font-size: 9pt; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; font-size: 9.5pt; }
  .meta div span { color: #5c6578; display: block; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { border: 1px solid #d5dadd; padding: 6px 8px; text-align: left; }
  th { background: #f3f0ff; font-size: 9pt; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .net { background: #ecfdf5; font-weight: 700; font-size: 11pt; }
  footer { margin-top: 20px; font-size: 8.5pt; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="sheet">
  <div class="head">
    <div>
      <h1>${company}</h1>
      <p>Salary slip for ${monthLabel(p.year, p.month)}</p>
    </div>
    ${logo ? `<img src="${logo}" alt="Sharnam"/>` : ""}
  </div>
  <div class="meta">
    <div><span>Employee name</span>${user.fullName}</div>
    <div><span>Employee code</span>${empCode}</div>
    <div><span>Designation</span>${designation}</div>
    <div><span>Department</span>${department}</div>
    <div><span>PAN</span>${pan}</div>
    <div><span>UAN / PF</span>${uan}</div>
    <div><span>Bank A/C</span>${bankAccount}</div>
    <div><span>Pay period</span>${monthLabel(p.year, p.month)}</div>
    <div><span>Working days</span>${p.workingDays}</div>
    <div><span>LOP days</span>${p.lopDays}</div>
    <div><span>Paid days</span>${p.paidDays}</div>
    <div><span>Status</span>${p.status || "Generated"}</div>
  </div>
  <table>
    <thead><tr><th>Earnings</th><th class="num">Amount (₹)</th><th>Deductions</th><th class="num">Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td>Basic</td><td class="num">${inr(basic)}</td><td>PF (Employee)</td><td class="num">${inr(pfEmployee)}</td></tr>
      <tr><td>HRA</td><td class="num">${inr(hra)}</td><td>ESIC</td><td class="num">${inr(esicEmployee)}</td></tr>
      <tr><td>Conveyance</td><td class="num">${inr(conveyance)}</td><td>Professional Tax</td><td class="num">${inr(professionalTax)}</td></tr>
      <tr><td>Medical / Children Edu.</td><td class="num">${inr(medicalAllow)}</td><td>Income Tax (TDS)</td><td class="num">${inr(p.incomeTax || 0)}</td></tr>
      <tr><td>Special Allowance</td><td class="num">${inr(specialAllow)}</td><td></td><td class="num"></td></tr>
      <tr><td><strong>Gross earnings</strong></td><td class="num"><strong>${inr(gross)}</strong></td><td><strong>Total deductions</strong></td><td class="num"><strong>${inr(pfEmployee + esicEmployee + professionalTax + (p.incomeTax || 0))}</strong></td></tr>
    </tbody>
  </table>
  <table>
    <tr class="net"><td>Net pay (in words: Rupees ${Math.round(netPay).toLocaleString("en-IN")} only)</td><td class="num">${inr(netPay)}</td></tr>
  </table>
  <footer>This is a system-generated payslip from Sharnam HRMS · Print → Save as PDF · Confidential</footer>
</div>
</body>
</html>`;
}

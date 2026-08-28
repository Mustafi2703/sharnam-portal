/**
 * SPDC CTC Structure Calculator — programmatic port of
 * module_prompts/Sharnam_modules_docs 2/SPDC_CTC_Structure_Calculator.xlsx.
 *
 * Takes the same 12 candidate-agnostic inputs the HR team already uses, and
 * emits the three-part Annexure I (Earnings · Retirals & benefits · Statutory
 * deductions) that plugs into the SPDC Letter of Appointment.
 *
 * Compliance references (Basis & Notes sheet):
 *   Basic ≥ 50% of Gross  → Code on Wages, 2019 (excluded allowances cap)
 *   HRA at 40% of Basic   → Section 10(13A) / Rule 2A — non-metro
 *   Employer PF at 12%    → EPF Act 1952 (₹15k / ₹21.6k cap toggle)
 *   Gratuity 4.81%        → Payment of Gratuity Act 1972
 *   LTA 8.33% (≈ 1 mo)    → Section 10(5)
 *   Professional Tax      → Gujarat PT slab
 *   ESI                   → Not applicable above ₹21k gross/month
 *
 * Output shape is intentionally identical to Part A/B/C of the source sheet
 * so a lawyer / auditor can reconcile figure-by-figure.
 */
import ExcelJS from "exceljs";
import { sharnamLogoPath, sharnamLogoDataUri } from "./brandedExport.js";
import fs from "node:fs";

export type CtcInputs = {
  candidateName: string;
  designation: string;
  /** Fixed CTC per annum (₹) — the headline number offered. */
  fixedCtcAnnual: number;
  /** Default 0.50 — keep at 50% for Code-on-Wages compliance. */
  basicPctOfGross: number;
  /** Default 0.40 — non-metro; 0.50 for metro. */
  hraPctOfBasic: number;
  /** Cap employer PF at ₹15k statutory ceiling? (default false = 12% of Basic). */
  restrictPfCeiling: boolean;
  /** Default 0.0481 — 15/26/12 actuarial factor. */
  gratuityPctOfBasic: number;
  /** Default 0.0833 — 1 month of Basic. */
  ltaPctOfBasic: number;
  /** Fixed p.a. — e.g. ₹19,200 (₹1,600/month). */
  conveyanceAnnual: number;
  /** Fixed p.a. — e.g. ₹2,400 (₹100/child/month × 2 max). */
  childrenEducationAnnual: number;
  /** Fixed p.a. — mediclaim + GPA premium. */
  mediclaimAnnual: number;
  /** Default 0.10 — variable / performance pay as % of Fixed CTC. */
  performancePayPct: number;
  /** Default ₹2,400 (Gujarat: ₹200 × 12 above ₹12k monthly). */
  professionalTaxAnnual: number;
};

export const DEFAULT_CTC_INPUTS: Omit<CtcInputs, "candidateName" | "designation" | "fixedCtcAnnual"> = {
  basicPctOfGross: 0.5,
  hraPctOfBasic: 0.4,
  restrictPfCeiling: false,
  gratuityPctOfBasic: 0.0481,
  ltaPctOfBasic: 0.0833,
  conveyanceAnnual: 19200,
  childrenEducationAnnual: 2400,
  mediclaimAnnual: 12000,
  performancePayPct: 0.1,
  professionalTaxAnnual: 2400,
};

type ComponentRow = {
  label: string;
  basis: string;
  perAnnum: number;
  perMonth: number | "—";
};

export type CtcBreakdown = {
  inputs: CtcInputs;
  partA: {
    rows: ComponentRow[];
    gross: { perAnnum: number; perMonth: number };
  };
  partB: {
    rows: ComponentRow[];
    total: { perAnnum: number; perMonth: number };
    fixedCtc: { perAnnum: number; perMonth: number };
    performancePay: { perAnnum: number; perMonth: "—" };
    totalCtc: { perAnnum: number; perMonth: "—" };
  };
  partC: {
    rows: ComponentRow[];
    netBeforeTax: { perAnnum: number; perMonth: number };
    indicativeNet: { perAnnum: number; perMonth: number };
  };
  validation: string[];
};

const round = (n: number) => Math.round(n);

/**
 * Reproduces the exact math of the "CTC Calculator" sheet.  Special
 * Allowance is the balancing figure — any rounding delta settles there so
 * Part A always sums exactly to Gross Salary.
 */
export function computeCtcBreakdown(input: CtcInputs): CtcBreakdown {
  const fixedCtc = round(input.fixedCtcAnnual);

  // Part B (employer retirals) is a function of Basic; Part A + Part B = Fixed CTC.
  // We iterate: pick a candidate Basic, compute retirals, solve for the Gross
  // that (retirals + gross = fixedCtc) → basic = 0.5 × gross → converge.
  // Closed form: retirals = pf(basic) + gratuity(basic) + mediclaim
  //  With pf = restrictPfCeiling ? min(basic, 15000*12)*0.12 : basic * 0.12
  //  fixedCtc = gross + retirals
  //  basic = basicPctOfGross * gross  ⇒  gross = fixedCtc - retirals(basic)
  //  If no cap: basic = basicPctOfGross * (fixedCtc - basic*(0.12+gratuityPct) - mediclaim)
  //   ⇒ basic * (1 + basicPctOfGross*(0.12+gratuityPct)) = basicPctOfGross*(fixedCtc - mediclaim)
  //   ⇒ basic = basicPctOfGross*(fixedCtc - mediclaim) / (1 + basicPctOfGross*(0.12 + gratuityPct))
  const pfRate = 0.12;
  const gRate = input.gratuityPctOfBasic;

  let basic: number;
  if (!input.restrictPfCeiling) {
    basic =
      (input.basicPctOfGross * (fixedCtc - input.mediclaimAnnual)) /
      (1 + input.basicPctOfGross * (pfRate + gRate));
  } else {
    // With PF capped at ₹21,600 p.a., retirals(basic) = 21600 + basic*gRate + mediclaim
    // gross = fixedCtc - retirals; basic = basicPctOfGross * gross
    // basic = basicPctOfGross * (fixedCtc - 21600 - basic*gRate - mediclaim)
    // basic + basicPctOfGross*basic*gRate = basicPctOfGross*(fixedCtc - 21600 - mediclaim)
    basic =
      (input.basicPctOfGross * (fixedCtc - 21600 - input.mediclaimAnnual)) /
      (1 + input.basicPctOfGross * gRate);
  }
  basic = round(basic);

  const hra = round(basic * input.hraPctOfBasic);
  const conveyance = round(input.conveyanceAnnual);
  const children = round(input.childrenEducationAnnual);
  const lta = round(basic * input.ltaPctOfBasic);

  // Special allowance is the balancing figure so Part A sums exactly to Gross.
  const grossTarget = round(basic / input.basicPctOfGross);
  const specialAllowance = grossTarget - basic - hra - conveyance - children - lta;
  const gross = basic + hra + conveyance + children + lta + specialAllowance;

  const rowsA: ComponentRow[] = [
    { label: "Basic Salary", basis: `${(input.basicPctOfGross * 100).toFixed(0)}% of Gross Salary`, perAnnum: basic, perMonth: round(basic / 12) },
    { label: "House Rent Allowance", basis: `${(input.hraPctOfBasic * 100).toFixed(0)}% of Basic Salary`, perAnnum: hra, perMonth: round(hra / 12) },
    { label: "Conveyance Allowance", basis: "Fixed", perAnnum: conveyance, perMonth: round(conveyance / 12) },
    { label: "Children Education Allowance", basis: "Fixed", perAnnum: children, perMonth: round(children / 12) },
    { label: "Leave Travel Allowance", basis: `${(input.ltaPctOfBasic * 100).toFixed(2)}% of Basic Salary`, perAnnum: lta, perMonth: round(lta / 12) },
    { label: "Special Allowance", basis: "Balancing figure", perAnnum: specialAllowance, perMonth: round(specialAllowance / 12) },
  ];

  const pfEmployer = input.restrictPfCeiling ? 21600 : round(basic * pfRate);
  const gratuity = round(basic * gRate);
  const mediclaim = round(input.mediclaimAnnual);
  const partBTotal = pfEmployer + gratuity + mediclaim;

  const rowsB: ComponentRow[] = [
    {
      label: "Employer's Provident Fund",
      basis: input.restrictPfCeiling ? "12% of Basic, capped at ₹15,000/month statutory ceiling" : "12% of Basic Salary",
      perAnnum: pfEmployer,
      perMonth: round(pfEmployer / 12),
    },
    { label: "Gratuity Provision", basis: `${(gRate * 100).toFixed(2)}% of Basic Salary`, perAnnum: gratuity, perMonth: round(gratuity / 12) },
    { label: "Group Mediclaim & GPA", basis: "Annual premium, employee cover", perAnnum: mediclaim, perMonth: round(mediclaim / 12) },
  ];

  const performancePay = round(fixedCtc * input.performancePayPct);

  const pfEmployee = round(basic * pfRate);
  const pt = round(input.professionalTaxAnnual);
  const monthlyGross = round(gross / 12);
  const esiApplies = monthlyGross <= 21000;
  const esiEmployee = esiApplies ? round(gross * 0.0075) : 0;

  const netBeforeTax = gross - pfEmployee - pt - esiEmployee;

  const rowsC: ComponentRow[] = [
    { label: "Gross Salary (A)", basis: "Carried from Part A", perAnnum: gross, perMonth: round(gross / 12) },
    { label: "Less: Employee's Provident Fund", basis: "12% of Basic Salary", perAnnum: -pfEmployee, perMonth: round(-pfEmployee / 12) },
    { label: "Less: Professional Tax", basis: "Gujarat — ₹200 per month above ₹12,000", perAnnum: -pt, perMonth: round(-pt / 12) },
    {
      label: "Less: Employees' State Insurance",
      basis: "0.75% of Gross — applies only up to ₹21,000 per month",
      perAnnum: -esiEmployee,
      perMonth: round(-esiEmployee / 12),
    },
    { label: "NET SALARY BEFORE INCOME TAX", basis: "", perAnnum: netBeforeTax, perMonth: round(netBeforeTax / 12) },
    { label: "Less: Tax Deducted at Source", basis: "Per Income-tax Act, 1961 — depends on regime elected", perAnnum: 0, perMonth: 0 },
    { label: "INDICATIVE NET TAKE-HOME", basis: "", perAnnum: netBeforeTax, perMonth: round(netBeforeTax / 12) },
  ];

  const validation: string[] = [];
  const reconciles = Math.abs(gross + partBTotal - fixedCtc) <= 5;
  validation.push(reconciles ? "OK — Fixed CTC reconciles to Parts A + B." : "REVIEW — Fixed CTC does not reconcile to Parts A + B.");
  validation.push(specialAllowance >= 0 ? "OK — Special Allowance is a positive balancing figure." : "REVIEW — Special Allowance is negative; increase Fixed CTC or reduce fixed components.");
  validation.push(esiApplies ? "ESI applies — employer share (3.25%) must be added to the cost build." : "ESI not applicable — Gross exceeds ₹21,000 per month.");
  validation.push(basic >= 21000 * 12 ? "Statutory bonus not applicable — Basic exceeds the ₹21,000 eligibility ceiling." : "Statutory bonus applicable — provision at 8.33% of notional wage may be required.");

  return {
    inputs: input,
    partA: {
      rows: rowsA,
      gross: { perAnnum: gross, perMonth: round(gross / 12) },
    },
    partB: {
      rows: rowsB,
      total: { perAnnum: partBTotal, perMonth: round(partBTotal / 12) },
      fixedCtc: { perAnnum: fixedCtc, perMonth: round(fixedCtc / 12) },
      performancePay: { perAnnum: performancePay, perMonth: "—" },
      totalCtc: { perAnnum: fixedCtc + performancePay, perMonth: "—" },
    },
    partC: {
      rows: rowsC,
      netBeforeTax: { perAnnum: netBeforeTax, perMonth: round(netBeforeTax / 12) },
      indicativeNet: { perAnnum: netBeforeTax, perMonth: round(netBeforeTax / 12) },
    },
    validation,
  };
}

const inr = (v: number | string) =>
  typeof v === "string" ? v : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * Sharnam-letterhead Annexure I ready for browser Print → Save-as-PDF.
 * Layout mirrors the exact sequence of the calculator sheet so HR / lawyer
 * teams see the same tables they already review in Excel.
 */
export function buildAnnexureHtml(b: CtcBreakdown): string {
  const logo = sharnamLogoDataUri();
  const row = (r: ComponentRow, opts: { bold?: boolean; negative?: boolean } = {}) => `
    <tr style="${opts.bold ? "font-weight:700;background:#F0F2F5;" : ""}${opts.negative ? "color:#B91C1C;" : ""}">
      <td style="padding:6px 8px;border:1px solid #E2E5EB;">${r.label}</td>
      <td style="padding:6px 8px;border:1px solid #E2E5EB;color:#5C6578;font-size:11px;">${r.basis}</td>
      <td style="padding:6px 8px;border:1px solid #E2E5EB;text-align:right;">${inr(r.perAnnum)}</td>
      <td style="padding:6px 8px;border:1px solid #E2E5EB;text-align:right;">${inr(r.perMonth)}</td>
    </tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Annexure I — ${b.inputs.candidateName}</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color:#1A1D26; margin:32px; }
  h1 { font-size: 18px; margin: 4px 0; }
  h2 { font-size: 13px; margin: 20px 0 6px; color:#0F766E; letter-spacing: .04em; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background:#0F766E; color:#fff; padding:8px; text-align:left; }
  th.num { text-align:right; }
  .hdr { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #0F766E; padding-bottom:12px; margin-bottom:16px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand img { height:44px; }
  .meta { color:#5C6578; font-size:11px; }
  .note { font-size:11px; color:#5C6578; margin-top:8px; }
  .band { background:#F0F2F5; padding:8px 12px; border-left:4px solid #0F766E; font-size:11px; color:#1A1D26; margin-top:16px; }
  @media print { body { margin: 16mm; } }
</style></head><body>
  <div class="hdr">
    <div class="brand">
      <img src="${logo}" alt="Sharnam" />
      <div>
        <div style="font-weight:700;">Sharnam Project Development Consultants & Co.</div>
        <div class="meta">Compensation Annexure I — Letter of Appointment</div>
      </div>
    </div>
    <div class="meta" style="text-align:right;">
      <div><strong>Candidate:</strong> ${b.inputs.candidateName || "—"}</div>
      <div><strong>Designation:</strong> ${b.inputs.designation || "—"}</div>
      <div><strong>Fixed CTC:</strong> ₹ ${inr(b.inputs.fixedCtcAnnual)} p.a.</div>
    </div>
  </div>

  <h2>Part A — Earnings (Fixed Salary)</h2>
  <table>
    <thead><tr><th>Component</th><th>Basis of computation</th><th class="num">Per annum (₹)</th><th class="num">Per month (₹)</th></tr></thead>
    <tbody>
      ${b.partA.rows.map((r) => row(r)).join("")}
      ${row({ label: "A. GROSS SALARY", basis: "Sum of the above", perAnnum: b.partA.gross.perAnnum, perMonth: b.partA.gross.perMonth }, { bold: true })}
    </tbody>
  </table>

  <h2>Part B — Retirals and Benefits (Employer Cost)</h2>
  <table>
    <thead><tr><th>Component</th><th>Basis of computation</th><th class="num">Per annum (₹)</th><th class="num">Per month (₹)</th></tr></thead>
    <tbody>
      ${b.partB.rows.map((r) => row(r)).join("")}
      ${row({ label: "B. TOTAL RETIRALS & BENEFITS", basis: "Sum of the above", perAnnum: b.partB.total.perAnnum, perMonth: b.partB.total.perMonth }, { bold: true })}
      ${row({ label: "FIXED COST TO COMPANY (A + B)", basis: "", perAnnum: b.partB.fixedCtc.perAnnum, perMonth: b.partB.fixedCtc.perMonth }, { bold: true })}
      ${row({ label: "C. Performance Pay (variable)", basis: `${(b.inputs.performancePayPct * 100).toFixed(0)}% of Fixed CTC — discretionary`, perAnnum: b.partB.performancePay.perAnnum, perMonth: b.partB.performancePay.perMonth })}
      ${row({ label: "TOTAL COST TO COMPANY (A + B + C)", basis: "", perAnnum: b.partB.totalCtc.perAnnum, perMonth: b.partB.totalCtc.perMonth }, { bold: true })}
    </tbody>
  </table>

  <h2>Part C — Statutory Deductions and Indicative Net Salary</h2>
  <table>
    <thead><tr><th>Particulars</th><th>Basis of computation</th><th class="num">Per annum (₹)</th><th class="num">Per month (₹)</th></tr></thead>
    <tbody>
      ${b.partC.rows.map((r) => row(r, r.label.startsWith("NET") || r.label.startsWith("INDICATIVE") ? { bold: true } : r.label.startsWith("Less") ? { negative: true } : {})).join("")}
    </tbody>
  </table>

  <div class="band">
    <strong>Validation.</strong> ${b.validation.join(" · ")}
  </div>

  <p class="note">
    This annexure is generated from the SPDC CTC Structure Calculator. Statutory rates, ceilings and thresholds
    change from time to time — HR to confirm each figure against the position prevailing on the date of issue
    before releasing the letter. Income tax not computed; depends on the regime elected by the employee.
  </p>
</body></html>`;
}

/**
 * Editable Annexure I workbook — one sheet mirroring Parts A/B/C plus a
 * separate "Inputs" sheet HR can tweak in Excel and re-generate against.
 */
export async function buildAnnexureXlsx(b: CtcBreakdown): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Project Development Consultants & Co.";
  wb.company = "Sharnam Project Development Consultants & Co.";
  wb.title = `Annexure I — ${b.inputs.candidateName}`;

  const logoPath = sharnamLogoPath();
  const logoId = logoPath && fs.existsSync(logoPath) ? wb.addImage({ filename: logoPath, extension: "png" }) : null;

  const sheet = wb.addWorksheet("Annexure I", { views: [{ showGridLines: false }] });
  sheet.columns = [
    { width: 44 },
    { width: 46 },
    { width: 16 },
    { width: 16 },
  ];

  if (logoId != null) {
    sheet.mergeCells("A1:D3");
    sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 60 } });
  }
  sheet.mergeCells("A4:D4");
  const heading = sheet.getCell("A4");
  heading.value = "Sharnam Project Development Consultants & Co. — Annexure I (Compensation)";
  heading.font = { bold: true, size: 12, color: { argb: "FF0F766E" } };
  heading.alignment = { vertical: "middle", horizontal: "left" };

  sheet.getCell("A5").value = "Candidate";
  sheet.getCell("B5").value = b.inputs.candidateName;
  sheet.getCell("C5").value = "Designation";
  sheet.getCell("D5").value = b.inputs.designation;

  sheet.getCell("A6").value = "Fixed CTC (p.a.)";
  sheet.getCell("B6").value = b.inputs.fixedCtcAnnual;
  sheet.getCell("B6").numFmt = '"₹" #,##,##0';

  let r = 8;
  const writeSection = (title: string, rows: ComponentRow[], totals?: ComponentRow[]) => {
    sheet.mergeCells(`A${r}:D${r}`);
    const cell = sheet.getCell(`A${r}`);
    cell.value = title;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r += 1;

    const hdr = ["Component", "Basis of computation", "Per annum (₹)", "Per month (₹)"];
    hdr.forEach((h, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = h;
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F2F5" } };
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E5EB" } } };
    });
    r += 1;

    const emit = (row: ComponentRow, bold = false) => {
      sheet.getCell(r, 1).value = row.label;
      sheet.getCell(r, 2).value = row.basis;
      sheet.getCell(r, 3).value = typeof row.perAnnum === "number" ? row.perAnnum : row.perAnnum;
      sheet.getCell(r, 4).value = typeof row.perMonth === "number" ? row.perMonth : row.perMonth;
      sheet.getCell(r, 3).numFmt = '"₹" #,##,##0';
      sheet.getCell(r, 4).numFmt = '"₹" #,##,##0';
      if (bold) [1, 2, 3, 4].forEach((c) => (sheet.getCell(r, c).font = { bold: true }));
      r += 1;
    };
    rows.forEach((row) => emit(row));
    (totals || []).forEach((row) => emit(row, true));
    r += 1;
  };

  writeSection("Part A — Earnings (Fixed Salary)", b.partA.rows, [
    { label: "A. GROSS SALARY", basis: "Sum of the above", perAnnum: b.partA.gross.perAnnum, perMonth: b.partA.gross.perMonth },
  ]);
  writeSection("Part B — Retirals and Benefits (Employer Cost)", b.partB.rows, [
    { label: "B. TOTAL RETIRALS & BENEFITS", basis: "Sum of the above", perAnnum: b.partB.total.perAnnum, perMonth: b.partB.total.perMonth },
    { label: "FIXED COST TO COMPANY (A + B)", basis: "", perAnnum: b.partB.fixedCtc.perAnnum, perMonth: b.partB.fixedCtc.perMonth },
    { label: "C. Performance Pay (variable)", basis: `${(b.inputs.performancePayPct * 100).toFixed(0)}% of Fixed CTC`, perAnnum: b.partB.performancePay.perAnnum, perMonth: 0 },
    { label: "TOTAL COST TO COMPANY (A + B + C)", basis: "", perAnnum: b.partB.totalCtc.perAnnum, perMonth: 0 },
  ]);
  writeSection("Part C — Statutory Deductions and Indicative Net Salary", b.partC.rows);

  sheet.mergeCells(`A${r}:D${r}`);
  const val = sheet.getCell(`A${r}`);
  val.value = `VALIDATION — ${b.validation.join(" · ")}`;
  val.font = { italic: true, color: { argb: "FF5C6578" }, size: 10 };
  val.alignment = { wrapText: true };
  sheet.getRow(r).height = 40;

  const inputsSheet = wb.addWorksheet("Inputs");
  inputsSheet.columns = [
    { header: "Field", key: "field", width: 34 },
    { header: "Value", key: "value", width: 22 },
  ];
  const inputRows: [string, string | number | boolean][] = [
    ["Candidate name", b.inputs.candidateName],
    ["Designation", b.inputs.designation],
    ["Fixed CTC per annum", b.inputs.fixedCtcAnnual],
    ["Basic as % of Gross", b.inputs.basicPctOfGross],
    ["HRA as % of Basic", b.inputs.hraPctOfBasic],
    ["Restrict employer PF to ₹15k ceiling", b.inputs.restrictPfCeiling ? "Yes" : "No"],
    ["Gratuity provision as % of Basic", b.inputs.gratuityPctOfBasic],
    ["LTA as % of Basic", b.inputs.ltaPctOfBasic],
    ["Conveyance Allowance (per annum)", b.inputs.conveyanceAnnual],
    ["Children Education Allowance (per annum)", b.inputs.childrenEducationAnnual],
    ["Group Mediclaim & GPA premium (per annum)", b.inputs.mediclaimAnnual],
    ["Performance Pay as % of Fixed CTC", b.inputs.performancePayPct],
    ["Professional Tax (per annum)", b.inputs.professionalTaxAnnual],
  ];
  inputRows.forEach((row) => inputsSheet.addRow(row));
  inputsSheet.getRow(1).font = { bold: true };

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

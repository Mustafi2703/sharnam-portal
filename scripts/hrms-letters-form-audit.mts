/**
 * Fill every field on each HR letter form with a unique value, build the Word letter through the same
 * code the portal uses, and report: values that never reach the letter, {{TOKENS}} left unfilled,
 * and dates printed raw (2026-04-01) instead of "01 April 2026".
 *
 * No database and no SharePoint — nothing is written to the live portal.
 * Usage: npx tsx scripts/hrms-letters-form-audit.mts [--out /tmp/hrms-letter-audit]
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import {
  KIND_OPTIONS,
  LETTER_VARIABLES,
  createBodyFromForm,
  emptyLetterForm,
  letterFormUsesAssetExtras,
  letterFormUsesCtc,
  letterFormUsesPromotionExtras,
  letterFormUsesSeparationReason,
  letterFormUsesWarningExtras,
  type DocKind,
} from "../apps/web/src/pages/hrms/hrmsLetterDesk.ts";
import { buildHrmsLetterDraftDocx } from "../apps/api/src/services/hrmsLetter.ts";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : "";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

let dateSeq = 0;
function nextDate() {
  dateSeq += 1;
  const month = ((dateSeq - 1) % 12) + 1;
  const day = ((dateSeq * 7) % 27) + 1;
  const iso = `2027-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso, shown: `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} 2027` };
}

let textSeq = 0;
function marker(label: string) {
  textSeq += 1;
  return `Q${textSeq}${label.replace(/[^A-Za-z]/g, "").slice(0, 10)}`;
}

async function docText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  let xml = "";
  for (const k of Object.keys(zip.files)) {
    if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(k)) xml += await zip.file(k)!.async("string");
  }
  const leftTokens = [...xml.matchAll(/\{\{((?:[^{}]|<[^>]*>)*?)\}\}/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const text = xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return { text, leftTokens: [...new Set(leftTokens)] };
}

type Check = { field: string; expect: string; raw?: string };

/** Person fields shown on every letter form. A template without that slot is fine; the rest must print. */
const GENERAL_FIELDS = new Set([
  "department",
  "candidateEmail",
  "effectiveDate",
  "location",
  "reportingManager",
  "empCode",
  "pan",
  "address",
  "mobile",
  "projectName",
]);

const report: Record<string, { missing: Check[]; rawDates: Check[]; leftTokens: string[]; notUsed: Check[] }> = {};

for (const { key: kind } of KIND_OPTIONS) {
  const form = emptyLetterForm(kind as DocKind);
  const checks: Check[] = [];
  const setText = (field: string, label: string) => {
    const v = marker(label);
    checks.push({ field, expect: v });
    return v;
  };
  const setDate = (field: string) => {
    const d = nextDate();
    checks.push({ field, expect: d.shown, raw: d.iso });
    return d.iso;
  };

  form.employeeName = setText("employeeName", "Name");
  form.designation = setText("designation", "Desig");
  form.department = setText("department", "Dept");
  form.candidateEmail = `q${textSeq}.audit@example.com`;
  checks.push({ field: "candidateEmail", expect: form.candidateEmail });
  form.effectiveDate = setDate("effectiveDate");
  form.location = setText("location", "Location");
  form.reportingManager = setText("reportingManager", "Manager");
  form.empCode = setText("empCode", "EmpCode");
  form.pan = setText("pan", "Pan");
  form.gender = "Female";
  form.address = setText("address", "Address");
  form.mobile = "98" + String(70000000 + textSeq);
  checks.push({ field: "mobile", expect: form.mobile });
  form.projectName = setText("projectName", "Project");

  if (letterFormUsesCtc(kind as DocKind)) {
    form.ctcAnnual = "1234567";
    checks.push({ field: "ctcAnnual", expect: "12,34,567" });
  }
  if (letterFormUsesPromotionExtras(kind as DocKind)) {
    form.previousDesignation = setText("previousDesignation", "PrevDesig");
    form.previousCtc = "765432";
    checks.push({ field: "previousCtc", expect: "7,65,432" });
  }
  if (letterFormUsesSeparationReason(kind as DocKind)) form.reason = setText("reason", "Reason");
  if (letterFormUsesWarningExtras(kind as DocKind)) {
    form.issueInBrief = setText("issueInBrief", "Issue");
    form.impact = setText("impact", "Impact");
    form.correctiveAction = setText("correctiveAction", "Corrective");
  }
  if (letterFormUsesAssetExtras(kind as DocKind)) {
    form.assets = setText("assets", "Assets");
    form.serials = setText("serials", "Serials");
  }

  for (const field of LETTER_VARIABLES[kind as DocKind] || []) {
    if (field.type === "date") form.sheet[field.key] = setDate(`sheet.${field.key}`);
    else form.sheet[field.key] = setText(`sheet.${field.key}`, field.label);
  }

  const body = createBodyFromForm(form);
  const buf = await buildHrmsLetterDraftDocx({ ...body, employeeName: body.employeeName });
  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${kind}.docx`), buf);
  }
  const { text, leftTokens } = await docText(buf);
  const missing: Check[] = [];
  const rawDates: Check[] = [];
  const notUsed: Check[] = [];
  for (const c of checks) {
    if (text.includes(c.expect)) continue;
    if (c.raw && text.includes(c.raw)) rawDates.push(c);
    else if (GENERAL_FIELDS.has(c.field)) notUsed.push(c);
    else missing.push(c);
  }
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(text)) rawDates.push({ field: "(some date in the letter)", expect: "" });
  report[kind] = { missing, rawDates, leftTokens, notUsed };
}

let problems = 0;
for (const [kind, r] of Object.entries(report)) {
  const n = r.missing.length + r.rawDates.length + r.leftTokens.length;
  problems += n;
  console.log(`\n=== ${kind}: ${n ? `${n} problem(s)` : "OK"}`);
  if (r.missing.length) console.log("  Typed but not in the letter:", r.missing.map((c) => c.field).join(", "));
  if (r.rawDates.length) console.log("  Date printed raw (YYYY-MM-DD):", r.rawDates.map((c) => c.field).join(", "));
  if (r.leftTokens.length) console.log("  {{TOKENS}} left unfilled:", r.leftTokens.join(", "));
  if (r.notUsed.length) console.log("  Note — this template has no slot for:", r.notUsed.map((c) => c.field).join(", "));
}
console.log(`\nTotal problems: ${problems}`);
process.exit(problems ? 1 : 0);

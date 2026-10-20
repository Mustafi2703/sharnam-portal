/**
 * Communication matrix block layout check — no database needed.
 *
 *   npx tsx scripts/matrix-blocks-smoke.mts [rows.json]
 *
 * BPCL rules: one lettered section per company (each contractor / consultant separate), NAME OF COMPANY,
 * SINGLE POINT OF CONTACT and OFFICE ADD. merged down that company's people, one row per person.
 * With no argument it uses a BPCL-style sample; pass a JSON array of contact rows to check real data.
 * Output: /tmp/matrix-blocks-smoke/ (Excel, HTML, PDF and a PNG of PDF page 1 via macOS `sips`).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { buildMatrixBlocks, matrixBlockRows } from "@sharnam/shared";
import {
  matrixLogoFromBuffer,
  renderMatrixHtml,
  renderMatrixPdf,
  renderMatrixXlsx,
  type MatrixBundle,
  type MatrixRow,
} from "../apps/api/src/services/matrixExport.ts";
import { sharnamLogoPath } from "../apps/api/src/services/brandedExport.ts";

const out = "/tmp/matrix-blocks-smoke";
fs.mkdirSync(out, { recursive: true });

let n = 0;
const person = (orgSection: string, company: string, personName: string, extra: Partial<MatrixRow> = {}): MatrixRow => ({
  id: `r${++n}`,
  orgSection,
  orgName: company,
  company,
  personName,
  designation: "Project Manager",
  mobile: `98${String(n).padStart(8, "0")}`,
  email: `${personName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
  mailRole: "CC",
  ...extra,
  sortOrder: n,
} as MatrixRow);
const header = (orgSection: string, company: string, extra: Partial<MatrixRow> = {}): MatrixRow => ({
  id: `h${++n}`,
  orgSection,
  orgName: company,
  isSectionHeader: true,
  ...extra,
  sortOrder: n,
} as MatrixRow);

const sample: MatrixRow[] = [
  header("Client", "Burckhardt Compression", { officeAddress: "Revenue Survey No.160/1, Vadodara" }),
  person("Client", "Burckhardt Compression", "Mr. Milan Shah", { designation: "Head – Procurement", mailRole: "TO" }),
  header("PMC", "Sharnam Project Development Consultants & Co.", {
    spoc: "Mr. Saurabh Prajapati\n(HO Discussion)\n\nMr. Jaideep Kumar Parmar\n(Site Discussion)",
    officeAddress: "F-09, Status Plaza, First Floor, Plot No. 18, Near Akshar Chowk, Munjmahuda, Vadodara – 390007, Gujarat, India.",
  }),
  person("PMC", "Sharnam Project Development Consultants & Co.", "Mr. Nirav Parekh", { designation: "Director" }),
  person("PMC", "SPDC", "Mr. Saurabh Prajapati", { designation: "Project Co-ordinator", mailRole: "TO" }),
  person("PMC", "SPDC", "Mr. Jaideep Kumar Parmar"),
  header("Contractor", "Reeca Infrastructure, Khyatee Associates"),
  person("Consultant", "Shah & Talati", "Maitrey Talati", { designation: "Director" }),
  person("Consultant", "Shah & Talati", "Devanshu Panchal", { mailRole: "TO" }),
  person("Contractor", "TCC", "Mr. Dhruv Darji", { mailRole: "TO", officeAddress: "AMITA, FP 153, TP 18, Ahmedabad" }),
  person("Contractor", "TCC", "Mr. Prakash Gadhvi", { mailRole: "TO" }),
  person("Contractor", "TCC", "Mr. Piyus Tyagi", { designation: "Billing Engineer" }),
  person("Contractor", "Reeca Infrastructure Pvt. Ltd.", "Reeca Infrastructure Pvt. Ltd.", { email: null, mobile: null }),
];

const rows: MatrixRow[] = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : sample;
const bundle: MatrixBundle = {
  project: { id: "p", name: "Construction of Main Factory B", clientName: "Burckhardt Compression", designConsultant: "Shah & Talati", pmcName: null },
  rows,
  matrixKind: "TECHNICAL",
};
const sharnamFile = sharnamLogoPath();
const logos = { sharnam: sharnamFile ? matrixLogoFromBuffer(fs.readFileSync(sharnamFile)) : null, client: null };

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

const blocks = buildMatrixBlocks(rows).filter((b) => b.people.length || b.placeholders.length);
for (const b of blocks) {
  console.log(`      ${b.letter} ${b.orgSection.padEnd(10)} ${b.company} · ${b.people.length} people · SPOC ${JSON.stringify(b.spoc)}${b.spocIsSet ? "" : " (fallback)"}`);
}
if (!process.argv[2]) {
  check(blocks.map((b) => b.company).join(" | ") === "Burckhardt Compression | Sharnam Project Development Consultants & Co. | Shah & Talati | TCC | Reeca Infrastructure Pvt. Ltd.", "one block per company, client → PMC → consultant → contractors");
  check(blocks[1].people.length === 3, "PMC rows under different company spellings stay in one block");
  check(blocks[1].spocIsSet && blocks[1].spoc.includes("(Site Discussion)"), "company SPOC comes from the company row");
  check(blocks[3].spoc === "Mr. Dhruv Darji\nMr. Prakash Gadhvi" && !blocks[3].spocIsSet, "unset SPOC falls back to the TO people");
  check(blocks[3].officeAddress.startsWith("AMITA"), "office address falls back to a person row");
  check(blocks[4].people.length === 0 && blocks[4].placeholders.length === 1, "company-only row is not counted as a person");
}

const xlsx = await renderMatrixXlsx([bundle], logos);
fs.writeFileSync(path.join(out, "matrix.xlsx"), xlsx);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
const ws = wb.getWorksheet("TECHNICAL")!;
const merges: string[] = ((ws as unknown as { model: { merges: string[] } }).model.merges || []).map(String);
let row = 8;
for (const b of blocks) {
  check(merges.includes(`B${row}:I${row}`), `xlsx ${b.letter}: section row ${row} merged B:I`);
  check(String(ws.getCell(`A${row}`).value) === b.letter, `xlsx ${b.letter}: letter in A${row}`);
  const count = matrixBlockRows(b).length;
  const first = row + 1;
  const last = row + count;
  if (count > 1) {
    for (const col of ["D", "E", "I"]) check(merges.includes(`${col}${first}:${col}${last}`), `xlsx ${b.letter}: ${col}${first}:${col}${last} merged`);
  }
  check(String(ws.getCell(`E${first}`).value ?? "") === b.spoc, `xlsx ${b.letter}: SPOC written once in E${first}`);
  row = last + 1;
}

const html = renderMatrixHtml(bundle, logos);
fs.writeFileSync(path.join(out, "matrix.html"), html);
const multi = blocks.filter((b) => matrixBlockRows(b).length > 1).length;
check((html.match(/rowspan="/g) || []).length === multi * 3, `html: ${multi * 3} rowspan cells (company, SPOC, address per multi-person block)`);
check((html.match(/<tr class="section">/g) || []).length === blocks.length, `html: ${blocks.length} company sections`);

const pdf = await renderMatrixPdf(bundle, logos);
fs.writeFileSync(path.join(out, "matrix.pdf"), pdf);
check(pdf.subarray(0, 4).toString() === "%PDF", "pdf rendered");
try {
  execFileSync("sips", ["-s", "format", "png", path.join(out, "matrix.pdf"), "--out", path.join(out, "matrix-page1.png")], { stdio: "ignore" });
  console.log(`      rendered ${path.join(out, "matrix-page1.png")}`);
} catch {
  /* sips is macOS-only */
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);

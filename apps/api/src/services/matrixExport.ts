import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";
import { SPDC_OFFICE_FOOTER, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoDataUri } from "./brandedExport.js";

type MatrixRow = {
  id: string;
  orgSection?: string | null;
  orgName?: string | null;
  isSectionHeader?: boolean;
  personName?: string | null;
  designation?: string | null;
  company?: string | null;
  spoc?: string | null;
  mobile?: string | null;
  email?: string | null;
  mailRole?: string | null;
  officeAddress?: string | null;
};

const NAVY = "FF1E3A5F";
const GOLD = "FFC9A227";

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function loadMatrixBundle(projectId: string, matrixKind: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      clientLogoUrl: true,
      designConsultant: true,
      pmcName: true,
      clientAddress: true,
    },
  });
  if (!project) throw new Error("Project not found");
  const rows = await prisma.communicationContact.findMany({
    where: { projectId, matrixKind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { project, rows: rows as MatrixRow[], matrixKind };
}

export async function buildMatrixXlsx(projectId: string, matrixKind: string): Promise<Buffer> {
  const { project, rows, matrixKind: kind } = await loadMatrixBundle(projectId, matrixKind);
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(`${kind} Matrix`.slice(0, 31));
  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = `${kind} Communication Matrix · ${project.name}`;
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = `${project.clientName || "—"} · PMC: ${project.pmcName || SPDC_PMC_NAME}`;
  sheet.getCell("A2").font = { size: 10, color: { argb: "FF666666" } };

  const header = ["Sr.No", "Name", "Designation", "Company", "SPOC", "Mobile", "E-mail", "Mail (TO/CC)", "Office Address"];
  sheet.addRow(header);
  const hr = sheet.lastRow!;
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  hr.alignment = { vertical: "middle", wrapText: true };

  let sectionIdx = -1;
  let personInSection = 0;
  for (const r of rows) {
    if (r.isSectionHeader) {
      sectionIdx += 1;
      personInSection = 0;
      const row = sheet.addRow([String.fromCharCode(65 + sectionIdx), r.orgName || "", "", "", "", "", "", "", ""]);
      row.font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
      continue;
    }
    personInSection += 1;
    sheet.addRow([
      personInSection,
      r.personName || "",
      r.designation || "",
      r.company || r.orgName || "",
      r.spoc || "",
      r.mobile || "",
      r.email || "",
      r.mailRole || "",
      r.officeAddress || "",
    ]);
  }

  sheet.columns.forEach((col, i) => {
    col.width = i === 8 ? 36 : i === 6 ? 28 : 16;
  });
  sheet.addRow([]);
  sheet.addRow([SPDC_OFFICE_FOOTER]);
  const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(ab);
}

export async function buildMatrixHtml(projectId: string, matrixKind: string): Promise<string> {
  const { project, rows, matrixKind: kind } = await loadMatrixBundle(projectId, matrixKind);
  const logo = sharnamLogoDataUri();
  const clientLogo = project.clientLogoUrl ? esc(project.clientLogoUrl) : "";
  let sectionIdx = -1;
  let personInSection = 0;
  const bodyRows = rows
    .map((r) => {
      if (r.isSectionHeader) {
        sectionIdx += 1;
        personInSection = 0;
        return `<tr class="section"><td class="mono">${String.fromCharCode(65 + sectionIdx)}</td><td colspan="8"><strong>${esc(r.orgName)}</strong></td></tr>`;
      }
      personInSection += 1;
      return `<tr>
        <td class="mono">${personInSection}</td>
        <td>${esc(r.personName)}</td>
        <td>${esc(r.designation)}</td>
        <td>${esc(r.company || r.orgName)}</td>
        <td>${esc(r.spoc)}</td>
        <td class="mono">${esc(r.mobile)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.mailRole)}</td>
        <td class="addr">${esc(r.officeAddress)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(kind)} Communication Matrix · ${esc(project.name)}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
    .head { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
    .head img { height: 52px; }
    .title { font-size: 20px; font-weight: 700; color: #1e3a5f; }
    .sub { font-size: 12px; color: #555; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; text-align: left; padding: 8px 6px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 6px; vertical-align: top; }
    tr.section td { background: #eef2ff; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; }
    .addr { max-width: 180px; white-space: pre-line; }
    footer { margin-top: 20px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="head">
    ${logo ? `<img src="${logo}" alt="Sharnam" />` : ""}
    ${clientLogo ? `<img src="${clientLogo}" alt="Client" style="height:48px;margin-left:auto" />` : ""}
    <div>
      <div class="title">${esc(kind)} Communication Matrix</div>
      <div class="sub">${esc(project.name)} · ${esc(project.clientName)} · ${esc(project.pmcName || SPDC_PMC_NAME)}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Sr.No</th><th>Name</th><th>Designation</th><th>Company</th><th>SPOC</th><th>Mobile</th><th>E-mail</th><th>TO/CC</th><th>Office Address</th>
    </tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#888">No rows</td></tr>`}</tbody>
  </table>
  <footer>${esc(SPDC_OFFICE_FOOTER)}</footer>
</body>
</html>`;
}

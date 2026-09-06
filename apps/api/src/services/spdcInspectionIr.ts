/**
 * SPDC Quality / Safety / Activity inspection IR — export + form field resolution.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { renderBrandedReportHtml } from "./brandedExport.js";
import { sharnamLogoPath } from "./brandedExport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = "FFFFF2CC";

const BODY_LINE_MAP: Record<string, string> = {
  "Project / facility: ": "projectFacility",
  "Employer / client: ": "employerClient",
  "Contractor / agency: ": "contractorAgency",
  "PMC / engineer: ": "pmcEngineer",
  "IR no.: ": "irNumber",
  "Safety IR no.: ": "irNumber",
  "Date of raising: ": "dateRaised",
  "Date of check: ": "dateRaised",
  "Package / WO no.: ": "packageWoNo",
  "Discipline: ": "discipline",
  "Description of activity: ": "activityDescription",
  "Description of work: ": "activityDescription",
  "Activity checked: ": "activityDescription",
  "Location / grid / level: ": "location",
  "Exact location / grid / level: ": "location",
  "Quantity offered / unit: ": "quantityUnit",
  "Quantity / unit: ": "quantityUnit",
  "Stage of work: ": "stageOfWork",
  "ITP ref. / activity code: ": "itpRef",
  "ITP ref. / control point: ": "itpRef",
  "Control point: ": "controlPoint",
  "Drawing no. & rev. (text ref): ": "drawingRef",
  "Drawing no. & rev.: ": "drawingRef",
  "Linked activity checklist no.: ": "checklistRef",
  "Linked quality IR no.: ": "linkedQualityIrNo",
  "High-risk activity type: ": "highRiskType",
  "Clearance sought from: ": "clearanceSoughtFrom",
  "Valid up to: ": "validUpTo",
  "Risk rating: ": "riskRating",
  "Result code: ": "clearanceResult",
  "Action required: ": "actionRequired",
  "Checklist no.: ": "checklistNo",
  "Linked IR no.: ": "linkedIrNo",
  "Specification clause: ": "specClause",
  "Approved method stmt. no.: ": "methodStmtNo",
};

export type InspectionProjectMeta = {
  code?: string;
  name?: string;
  clientName?: string | null;
  contractorName?: string | null;
  location?: string | null;
};

export type InspectionRfiRecord = {
  id?: string;
  number?: string;
  irNumber?: string | null;
  subject?: string;
  question?: string | null;
  status?: string;
  rfiKind?: string;
  formDataJson?: string | null;
  linkedAssignment?: { template?: { name?: string | null } | null } | null;
};

function parseFormDataJson(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveInspectionFormData(
  rfi: InspectionRfiRecord,
  project?: InspectionProjectMeta
): Record<string, string> {
  const fromJson = parseFormDataJson(rfi.formDataJson);
  const fromBody: Record<string, string> = {};
  if (rfi.question) {
    for (const line of rfi.question.split("\n")) {
      for (const [prefix, key] of Object.entries(BODY_LINE_MAP)) {
        if (line.startsWith(prefix)) {
          const val = line.slice(prefix.length).trim();
          if (val) fromBody[key] = val;
        }
      }
    }
  }
  const defaults: Record<string, string> = {
    projectFacility: project?.code || project?.name || "",
    employerClient: project?.clientName || "",
    contractorAgency: project?.contractorName || "",
    pmcEngineer: "SPDC",
  };
  return { ...defaults, ...fromBody, ...fromJson };
}

function resolveTemplate(fileName: string): string | null {
  const candidates = [
    path.resolve(__dirname, "../../checklist-templates", fileName),
    path.resolve(process.cwd(), "apps/api/checklist-templates", fileName),
    path.resolve(process.cwd(), "templates", fileName),
    path.resolve(process.cwd(), "seed/data", fileName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function paintInput(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
  cell.font = { size: 10 };
  cell.alignment = { vertical: "middle", wrapText: true };
}

function embedLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const logo = sharnamLogoPath();
  if (!logo) return;
  try {
    const imgId = wb.addImage({ filename: logo, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.2, row: 0.1 }, ext: { width: 110, height: 36 }, editAs: "oneCell" });
  } catch {
    /* optional */
  }
}

export async function buildInspectionIrXlsx(
  rfi: InspectionRfiRecord,
  project: InspectionProjectMeta
): Promise<Buffer> {
  const form = resolveInspectionFormData(rfi, project);
  const kind = rfi.rfiKind || "QualityIR";

  if (kind === "SafetyIR") {
    const file = resolveTemplate("SPDC_Safety_Inspection_Request_and_Checklists.xlsx");
    if (!file) throw new Error("Safety IR template not found");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ir = wb.getWorksheet("Safety IR Form");
    if (!ir) throw new Error("Safety IR Form sheet missing");
    embedLogo(wb, ir);
    paintInput(ir, 6, 5, form.projectFacility);
    paintInput(ir, 6, 11, form.irNumber || rfi.irNumber || rfi.number);
    paintInput(ir, 7, 5, form.employerClient);
    paintInput(ir, 7, 11, form.dateRaised || new Date().toISOString().slice(0, 10));
    paintInput(ir, 8, 5, form.contractorAgency);
    paintInput(ir, 9, 4, form.pmcEngineer || "SPDC");
    paintInput(ir, 13, 5, form.highRiskType);
    paintInput(ir, 14, 5, form.activityDescription || rfi.subject);
    paintInput(ir, 15, 5, form.location);
    paintInput(ir, 16, 4, form.clearanceSoughtFrom);
    paintInput(ir, 17, 5, form.validUpTo);
    paintInput(ir, 18, 5, form.linkedQualityIrNo);
    paintInput(ir, 19, 5, form.riskRating);
    paintInput(ir, 20, 5, form.clearanceResult);
    paintInput(ir, 21, 5, form.actionRequired);
    paintInput(ir, 22, 5, rfi.linkedAssignment?.template?.name || form.checklistRef);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  const templateFile =
    kind === "ActivityInspection"
      ? "SPDC_Activity_Inspection_Checklist_Format.xlsx"
      : "SPDC_Request_for_Inspection_Form.xlsx";
  const file = resolveTemplate(templateFile);
  if (!file) throw new Error(`${templateFile} not found`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  embedLogo(wb, ws);
  paintInput(ws, 5, 5, form.projectFacility);
  paintInput(ws, 5, 11, form.irNumber || form.checklistNo || rfi.irNumber || rfi.number);
  paintInput(ws, 6, 5, form.employerClient);
  paintInput(ws, 6, 11, form.dateRaised || new Date().toISOString().slice(0, 10));
  paintInput(ws, 7, 5, form.contractorAgency);
  paintInput(ws, 8, 4, form.pmcEngineer || "SPDC");
  paintInput(ws, 8, 11, form.discipline || form.packageWoNo);
  paintInput(ws, 11, 5, form.activityDescription || rfi.subject);
  paintInput(ws, 12, 5, form.location);
  paintInput(ws, 15, 5, form.drawingRef);
  paintInput(ws, 16, 4, form.checklistRef || rfi.linkedAssignment?.template?.name);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function renderInspectionIrHtml(rfi: InspectionRfiRecord, project: InspectionProjectMeta): string {
  const form = resolveInspectionFormData(rfi, project);
  const docNo =
    rfi.rfiKind === "SafetyIR"
      ? "SPDC/HSE/F-01"
      : rfi.rfiKind === "ActivityInspection"
        ? "SPDC/QA/F-02"
        : "SPDC/QA/F-01";
  const title =
    rfi.rfiKind === "SafetyIR"
      ? "Safety Inspection & Clearance Request"
      : rfi.rfiKind === "ActivityInspection"
        ? "Activity Inspection Checklist"
        : "Request for Inspection (RIA)";

  const fieldRows = [
    ["Project / facility", form.projectFacility],
    ["Employer / client", form.employerClient],
    ["Contractor / agency", form.contractorAgency],
    ["PMC / engineer", form.pmcEngineer],
    ["IR / checklist no.", form.irNumber || form.checklistNo || rfi.irNumber || rfi.number || ""],
    ["Date", form.dateRaised],
    ["Activity / work", form.activityDescription || rfi.subject || ""],
    ["Location", form.location],
    ["Drawing ref (text)", form.drawingRef],
    ["Linked checklist", rfi.linkedAssignment?.template?.name || form.checklistRef || ""],
    ["Linked quality IR", form.linkedQualityIrNo || ""],
    ["High-risk type", form.highRiskType || ""],
    ["Risk rating", form.riskRating || ""],
    ["Clearance result", form.clearanceResult || ""],
    ["Action required", form.actionRequired || ""],
    ["Status", rfi.status || ""],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return renderBrandedReportHtml({
    title: `${title} — ${docNo}`,
    subtitle: rfi.subject || "",
    project: {
      code: project.code || "",
      name: project.name || "",
      clientName: project.clientName,
      location: project.location,
    },
    kpis: [
      { label: "Portal ref", value: rfi.number || "—" },
      { label: "IR no.", value: form.irNumber || rfi.irNumber || "—" },
      { label: "Status", value: rfi.status || "Open" },
    ],
    sections: [
      {
        heading: "Inspection particulars",
        headers: ["Field", "Value"],
        rows: fieldRows,
      },
      {
        heading: "Request body",
        headers: ["Text"],
        rows: [[(rfi.question || "").trim() || "—"]],
      },
    ],
  });
}

export function safeInspectionIrFilename(number: string | undefined, ext: "xlsx" | "html") {
  const base = String(number || "Inspection-IR").replace(/[^\w.-]+/g, "_");
  return `${base}-SPDC-IR.${ext}`;
}

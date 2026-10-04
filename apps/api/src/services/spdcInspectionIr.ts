/**
 * SPDC Quality / Safety / Activity inspection IR — export + form field resolution.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { renderBrandedReportHtml } from "./brandedExport.js";
import { sharnamLogoPath } from "./brandedExport.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";

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
    projectFacility: project?.name || project?.code || "",
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
    // Logo gets its own band in row 1 so it never sits on the company name below.
    ws.getRow(1).height = Math.max(Number(ws.getRow(1).height || 0), 34);
    ws.addImage(imgId, { tl: { col: 0.2, row: 0.08 }, ext: { width: 110, height: 36 }, editAs: "oneCell" });
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
    detachSharedStyles(wb);
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

  const irNo = form.irNumber || form.checklistNo || rfi.irNumber || rfi.number;
  const today = new Date().toISOString().slice(0, 10);

  if (kind === "ActivityInspection") {
    // SPDC/QA/F-02 particulars: values in E (col 5) and I (col 9), rows 6–12.
    const file = resolveTemplate("SPDC_Activity_Inspection_Checklist_Format.xlsx");
    if (!file) throw new Error("SPDC_Activity_Inspection_Checklist_Format.xlsx not found");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    detachSharedStyles(wb);
    for (const extra of wb.worksheets.slice(1)) wb.removeWorksheet(extra.id);
    const ws = wb.worksheets[0];
    ws.name = "Activity Checklist";
    embedLogo(wb, ws);
    paintInput(ws, 6, 5, form.projectFacility);
    paintInput(ws, 6, 9, irNo);
    paintInput(ws, 7, 5, form.employerClient);
    paintInput(ws, 7, 9, form.dateRaised || today);
    paintInput(ws, 8, 5, form.contractorAgency);
    paintInput(ws, 8, 9, form.linkedIrNo);
    paintInput(ws, 9, 5, form.activityDescription || rfi.subject);
    paintInput(ws, 9, 9, form.discipline);
    paintInput(ws, 10, 5, form.location);
    paintInput(ws, 10, 9, form.quantityUnit);
    paintInput(ws, 11, 5, form.drawingRef);
    paintInput(ws, 11, 9, form.specClause);
    paintInput(ws, 12, 5, form.methodStmtNo);
    paintInput(ws, 12, 9, form.itpRef);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  // SPDC/QA/F-01 Request for Inspection: value boxes start in D (col 4) and J (col 10).
  const file = resolveTemplate("SPDC_Request_for_Inspection_Form.xlsx");
  if (!file) throw new Error("SPDC_Request_for_Inspection_Form.xlsx not found");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  detachSharedStyles(wb);
  const ws = wb.worksheets[0];
  embedLogo(wb, ws);
  paintInput(ws, 5, 4, form.projectFacility);
  paintInput(ws, 5, 10, irNo);
  paintInput(ws, 6, 4, form.employerClient);
  paintInput(ws, 6, 10, form.dateRaised || today);
  paintInput(ws, 7, 4, form.contractorAgency);
  paintInput(ws, 7, 10, form.packageWoNo);
  paintInput(ws, 8, 4, form.pmcEngineer || "SPDC");
  paintInput(ws, 8, 10, form.discipline);
  paintInput(ws, 11, 4, form.activityDescription || rfi.subject);
  paintInput(ws, 12, 4, form.location);
  paintInput(ws, 13, 4, form.quantityUnit);
  paintInput(ws, 13, 10, form.stageOfWork);
  paintInput(ws, 14, 4, form.itpRef);
  paintInput(ws, 14, 10, form.controlPoint);
  paintInput(ws, 15, 4, form.drawingRef);
  paintInput(ws, 15, 10, form.specClause);
  paintInput(ws, 16, 4, form.methodStmtNo);
  paintInput(ws, 16, 10, form.previousIrNo);
  paintInput(ws, 17, 6, form.requiredDate || form.requestedDate);
  paintInput(ws, 17, 10, form.requiredTime);
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

  const no = form.irNumber || form.checklistNo || rfi.irNumber || rfi.number || "";
  const common: [string, string | undefined][] = [
    ["Project / facility", form.projectFacility],
    ["Employer / client", form.employerClient],
    ["Contractor / agency", form.contractorAgency],
    ["PMC / engineer", form.pmcEngineer],
  ];
  // Rows follow the SPDC form for each kind (F-01 quality IR, F-02 activity checklist, safety clearance).
  const fieldRows = [
    ...common,
    ...(rfi.rfiKind === "SafetyIR"
      ? ([
          ["Safety IR no.", no],
          ["Date of raising", form.dateRaised],
          ["Linked quality IR", form.linkedQualityIrNo],
          ["High-risk activity", form.highRiskType],
          ["Description of work", form.activityDescription || rfi.subject],
          ["Location", form.location],
          ["Clearance sought from", form.clearanceSoughtFrom],
          ["Valid up to", form.validUpTo],
          ["Risk rating", form.riskRating],
          ["Result (S1–S4)", form.clearanceResult],
          ["Action required / conditions", form.actionRequired],
          ["Safety checklist", rfi.linkedAssignment?.template?.name || form.checklistRef],
        ] as [string, string | undefined][])
      : rfi.rfiKind === "ActivityInspection"
        ? ([
            ["Checklist no.", no],
            ["Date of check", form.dateRaised],
            ["Linked IR no.", form.linkedIrNo],
            ["Activity checked", form.activityDescription || rfi.subject],
            ["Discipline", form.discipline],
            ["Location / grid / level", form.location],
            ["Quantity / unit", form.quantityUnit],
            ["Drawing no. & rev.", form.drawingRef],
            ["Specification clause", form.specClause],
            ["Approved method stmt. no.", form.methodStmtNo],
            ["ITP ref. / control point", form.itpRef],
          ] as [string, string | undefined][])
        : ([
            ["IR no.", no],
            ["Date of raising", form.dateRaised],
            ["Package / WO no.", form.packageWoNo],
            ["Discipline", form.discipline],
            ["Description of activity", form.activityDescription || rfi.subject],
            ["Location / grid / level", form.location],
            ["Quantity offered / unit", form.quantityUnit],
            ["Stage of work", form.stageOfWork],
            ["ITP ref. / activity code", form.itpRef],
            ["Control point", form.controlPoint],
            ["Drawing no. / rev.", form.drawingRef],
            ["Specification clause", form.specClause],
            ["Approved method stmt. no.", form.methodStmtNo],
            ["Previous IR no. (if re-offer)", form.previousIrNo],
            ["Inspection required on", [form.requiredDate || form.requestedDate, form.requiredTime].filter(Boolean).join(" ")],
            ["Linked activity checklist", rfi.linkedAssignment?.template?.name || form.checklistRef],
          ] as [string, string | undefined][])),
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

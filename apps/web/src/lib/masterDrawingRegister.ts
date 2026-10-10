/** Master Drawing Register — DCI columns from DRAWING REGISTER - 01.xlsx */

export type MasterRegisterForm = {
  srNo: string;
  projectPackage: string;
  building: string;
  discipline: string;
  drawingNumber: string;
  drawingTitle: string;
  drawingType: string;
  consultantName: string;
  revisionNumber: string;
  revisionDate: string;
  revisionDescription: string;
  latestRevision: string;
  plannedSubmissionDate: string;
  actualSubmissionDate: string;
  submissionDelayDays: string;
  delayResponsibility: string;
  issuedTo: string;
  issueDate: string;
  copiesCount: string;
  criticalDrawing: string;
  remarks: string;
};

/** DRAWING REGISTER - 01.xlsx · Input sheet. Package and building are typed per project — the workbook's Package A / Tower 1 rows are a sample, not a live list. */
/** Every drawing discipline offered when uploading or adding a register row (first three match the client register). */
export const MASTER_REGISTER_DISCIPLINES = [
  "Architecture",
  "Structural",
  "MEPF",
  "Civil",
  "Electrical",
  "Mechanical / HVAC",
  "Plumbing",
  "Fire Fighting",
  "Fire Alarm & ELV",
  "Interior",
  "Landscape",
  "Facade",
  "Infrastructure / External Works",
  "Roads & Drainage",
  "Survey",
  "Geotechnical",
  "BIM / Coordination",
  "Shop Drawings",
] as const;

/** The full list plus anything already used on this project (older or custom disciplines stay selectable). */
export function drawingDisciplineOptions(
  used: (string | null | undefined)[] = [],
  current?: string | null,
  base?: readonly string[],
): string[] {
  const out = new Set<string>(base && base.length ? base : MASTER_REGISTER_DISCIPLINES);
  for (const u of used) if (u && u.trim()) out.add(u.trim());
  if (current && current.trim()) out.add(current.trim());
  return [...out];
}

export const MASTER_REGISTER_DRAWING_TYPES = [
  "Concept Drawings",
  "Schematic Drawings",
  "Detailed Design (DD) Drawings",
  "Tender Drawings",
  "Good For Construction (GFC)",
] as const;

export const MASTER_REGISTER_LATEST = ["Yes", "No"] as const;

export const MASTER_REGISTER_ISSUED_TO = ["Main Contractor", "PMC / Client"] as const;

export const MASTER_REGISTER_DELAY_RESP = [
  "Architecture Consultant",
  "Structural Consultant",
  "MEPF Consultant",
  "BIM Consultant",
  "Contractor",
  "PMC",
] as const;

/** Package chip colours for table + filters */
export const PACKAGE_TONE: Record<string, string> = {
  "Package A": "bg-sky-100 text-sky-900 border-sky-200",
  "Package B": "bg-violet-100 text-violet-900 border-violet-200",
  "Package C": "bg-amber-100 text-amber-900 border-amber-200",
  "Package D": "bg-rose-100 text-rose-900 border-rose-200",
};

export function packageTone(pkg?: string | null) {
  if (!pkg) return "bg-sand text-steel-muted border-line";
  return PACKAGE_TONE[pkg] || "bg-brand-soft text-brand-dark border-brand/20";
}

export function emptyMasterRegisterForm(): MasterRegisterForm {
  return {
    srNo: "",
    projectPackage: "",
    building: "",
    discipline: "Architecture",
    drawingNumber: "",
    drawingTitle: "",
    drawingType: "Good For Construction (GFC)",
    consultantName: "",
    revisionNumber: "R0",
    revisionDate: "",
    revisionDescription: "",
    latestRevision: "Yes",
    plannedSubmissionDate: "",
    actualSubmissionDate: "",
    submissionDelayDays: "",
    delayResponsibility: "",
    issuedTo: "",
    issueDate: "",
    copiesCount: "",
    criticalDrawing: "No",
    remarks: "",
  };
}

export function masterRegisterPayload(form: MasterRegisterForm) {
  const delay =
    form.submissionDelayDays.trim() !== ""
      ? Number(form.submissionDelayDays)
      : form.plannedSubmissionDate && form.actualSubmissionDate
        ? Math.ceil(
            (new Date(form.actualSubmissionDate).getTime() - new Date(form.plannedSubmissionDate).getTime()) /
              86400000
          )
        : null;

  return {
    srNo: form.srNo.trim() ? Number(form.srNo) : undefined,
    projectPackage: form.projectPackage || null,
    building: form.building || null,
    discipline: form.discipline || null,
    drawingNumber: form.drawingNumber.trim(),
    drawingTitle: form.drawingTitle.trim(),
    drawingType: form.drawingType || null,
    consultantName: form.consultantName || null,
    revisionNumber: form.revisionNumber || null,
    revisionDate: form.revisionDate || null,
    revisionDescription: form.revisionDescription || null,
    latestRevision: form.latestRevision || null,
    plannedSubmissionDate: form.plannedSubmissionDate || null,
    actualSubmissionDate: form.actualSubmissionDate || null,
    submissionDelayDays: Number.isFinite(delay) ? delay : null,
    delayResponsibility: form.delayResponsibility || null,
    issuedTo: form.issuedTo || null,
    issueDate: form.issueDate || null,
    copiesCount: form.copiesCount.trim() ? Number(form.copiesCount) : null,
    criticalDrawing: form.criticalDrawing || null,
    remarks: form.remarks || null,
  };
}

export function lineToMasterRegisterForm(row: {
  srNo?: number | null;
  projectPackage?: string | null;
  building?: string | null;
  discipline?: string | null;
  drawingNumber?: string;
  drawingTitle?: string;
  drawingType?: string | null;
  consultantName?: string | null;
  revisionNumber?: string | null;
  revisionDate?: string | Date | null;
  revisionDescription?: string | null;
  latestRevision?: string | null;
  plannedSubmissionDate?: string | Date | null;
  actualSubmissionDate?: string | Date | null;
  submissionDelayDays?: number | null;
  delayResponsibility?: string | null;
  issuedTo?: string | null;
  issueDate?: string | Date | null;
  copiesCount?: number | null;
  criticalDrawing?: string | null;
  remarks?: string | null;
}): MasterRegisterForm {
  const day = (v?: string | Date | null) => {
    if (!v) return "";
    try {
      return new Date(v).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };
  return {
    srNo: row.srNo != null ? String(row.srNo) : "",
    projectPackage: row.projectPackage || "",
    building: row.building || "",
    discipline: row.discipline || "Architecture",
    drawingNumber: row.drawingNumber || "",
    drawingTitle: row.drawingTitle || "",
    drawingType: row.drawingType || "Good For Construction (GFC)",
    consultantName: row.consultantName || "",
    revisionNumber: row.revisionNumber || "R0",
    revisionDate: day(row.revisionDate),
    revisionDescription: row.revisionDescription || "",
    latestRevision: row.latestRevision || "Yes",
    plannedSubmissionDate: day(row.plannedSubmissionDate),
    actualSubmissionDate: day(row.actualSubmissionDate),
    submissionDelayDays: row.submissionDelayDays != null ? String(row.submissionDelayDays) : "",
    delayResponsibility: row.delayResponsibility || "",
    issuedTo: row.issuedTo || "",
    issueDate: day(row.issueDate),
    copiesCount: row.copiesCount != null ? String(row.copiesCount) : "",
    criticalDrawing: row.criticalDrawing || "No",
    remarks: row.remarks || "",
  };
}

export function uniqSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

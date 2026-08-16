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

export const MASTER_REGISTER_PACKAGES = ["Package A", "Package B", "Package C", "Package D"] as const;

export const MASTER_REGISTER_DISCIPLINES = ["Architecture", "Structural", "MEPF", "Facade", "Interior"] as const;

export const MASTER_REGISTER_DRAWING_TYPES = [
  "Good For Construction (GFC)",
  "Tender Drawings",
  "Detailed Design (DD) Drawings",
  "Shop Drawing",
  "Schematic Drawings",
  "Concept Drawings",
] as const;

export const MASTER_REGISTER_ISSUED_TO = ["Main Contractor", "PMC / Client"] as const;

export function emptyMasterRegisterForm(): MasterRegisterForm {
  return {
    srNo: "",
    projectPackage: "Package A",
    building: "Tower 1",
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

export function uniqSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

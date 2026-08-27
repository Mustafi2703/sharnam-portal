/** RFI / request completion — how much of the record is filled and workflow stage */

export type RfiFieldState = {
  key: string;
  label: string;
  done: boolean;
  optional?: boolean;
};

export type RfiProgress = {
  pct: number;
  requiredDone: number;
  requiredTotal: number;
  fields: RfiFieldState[];
  stage: "Draft" | "Open" | "In review" | "Answered" | "Closed";
  stageIndex: number;
};

const STAGES: RfiProgress["stage"][] = ["Draft", "Open", "In review", "Answered", "Closed"];

export function rfiProgress(rfi: {
  subject?: string;
  question?: string;
  status?: string;
  rfiKind?: string;
  assignedToId?: string | null;
  linkedDrawingId?: string | null;
  linkedAssignmentId?: string | null;
  responsibleVendorId?: string | null;
  scheduleImpact?: string | null;
  costImpact?: string | null;
  attachmentsJson?: string | null;
  formDataJson?: string | null;
  contractorSolution?: string;
  responses?: { isOfficialResponse?: boolean }[];
}): RfiProgress {
  const kind = rfi.rfiKind || "RequestForInformation";
  let form: Record<string, string> = {};
  try {
    form = rfi.formDataJson ? JSON.parse(rfi.formDataJson) : {};
  } catch {
    form = {};
  }
  const proposed = String(rfi.contractorSolution || form.contractorSolution || form.proposedSolution || "").trim();
  const fields: RfiFieldState[] = [
    { key: "subject", label: "Subject", done: !!String(rfi.subject || "").trim() },
    { key: "question", label: "Query raised", done: !!String(rfi.question || "").trim() },
  ];

  if (kind === "RequestForInformation" || kind === "Manual" || kind === "ClientConcern") {
    fields.push(
      { key: "solution", label: "Proposed solution", done: !!proposed },
      { key: "drawing", label: "Drawing ref + rev", done: !!(form.drawingRef || rfi.linkedDrawingId), optional: true },
      { key: "assignee", label: "Responsible party", done: !!(form.responsibleParty || rfi.assignedToId), optional: true }
    );
  }

  if (
    kind === "DrawingChecklist" ||
    kind === "QualityInspection" ||
    kind === "SafetyChecklist" ||
    kind === "QualityIR" ||
    kind === "SafetyIR" ||
    kind === "ActivityInspection" ||
    kind === "SiteExecution"
  ) {
    fields.push(
      { key: "checklist", label: "Checklist linked", done: !!rfi.linkedAssignmentId },
      { key: "vendor", label: "Responsible vendor", done: !!rfi.responsibleVendorId, optional: true }
    );
  }

  const officialCount = (rfi.responses || []).filter((r) => r.isOfficialResponse).length;
  fields.push({
    key: "response",
    label: officialCount ? `Official response (${officialCount})` : "Official response",
    done: officialCount > 0,
  });

  const required = fields.filter((f) => !f.optional);
  const requiredDone = required.filter((f) => f.done).length;
  const pct = required.length ? Math.round((requiredDone / required.length) * 100) : 0;

  let stage: RfiProgress["stage"] = "Open";
  if (rfi.status === "Closed") stage = "Closed";
  else if (officialCount > 0 || rfi.status === "Answered") stage = "Answered";
  else if (officialCount === 0 && (rfi.responses?.length || 0) > 0) stage = "In review";
  else if (!fields[0].done || !fields[1].done) stage = "Draft";
  else stage = "Open";

  return {
    pct,
    requiredDone,
    requiredTotal: required.length,
    fields,
    stage,
    stageIndex: STAGES.indexOf(stage),
  };
}

/** Compose-form fill % before submit */
export function rfiComposeProgress(form: {
  subject?: string;
  question?: string;
  rfiKind?: string;
  assignedToId?: string;
  linkedDrawingId?: string;
  linkedAssignmentId?: string;
  contractorSolution?: string;
}): number {
  const pseudo = {
    subject: form.subject,
    question: form.question,
    rfiKind: form.rfiKind,
    assignedToId: form.assignedToId || null,
    linkedDrawingId: form.linkedDrawingId || null,
    linkedAssignmentId: form.linkedAssignmentId || null,
    contractorSolution: form.contractorSolution,
    responses: [],
  };
  return rfiProgress(pseudo).pct;
}

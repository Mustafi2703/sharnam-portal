import { api } from "../api";
import { openDrawingCheckWindow } from "./drawingCheckWindow";
import { openInPageOverlay } from "./inPageOverlay";

export type ChecklistFillFamily =
  | "QualityInspection"
  | "Safety"
  | "SiteExecution"
  | "ActivityInspection"
  | "DrawingCheck";

/** Open checklist fill in an on-page popup (never a new browser window). */
export function openChecklistFillWindow(
  projectId: string,
  assignmentId: string,
  family: string,
  opts?: {
    resumeDraft?: boolean;
    submissionId?: string | null;
    drawingId?: string;
    revisionId?: string;
    rfi?: string;
  }
) {
  openInPageOverlay({
    kind: "checklist-fill",
    projectId,
    assignmentId,
    family: normalizeFillFamily(family),
    resumeDraft: opts?.resumeDraft,
    submissionId: opts?.submissionId,
    drawingId: opts?.drawingId,
    revisionId: opts?.revisionId,
    rfi: opts?.rfi,
  });
  return window;
}

export function checklistFillUrl(projectId: string, assignmentId: string, family: string) {
  return `/projects/${projectId}/checklist/fill/${assignmentId}?family=${encodeURIComponent(normalizeFillFamily(family))}`;
}

export function normalizeFillFamily(family: string): string {
  if (family === "SafetyChecklist" || family === "SafetyIR") return "Safety";
  if (family === "QualityIR") return "QualityInspection";
  if (family === "DrawingChecklist" || family === "RequestForInformation" || family === "Manual") return "DrawingCheck";
  return family;
}

export function isChecklistFillFamily(v?: string | null): v is ChecklistFillFamily {
  return (
    v === "QualityInspection" ||
    v === "Safety" ||
    v === "SiteExecution" ||
    v === "ActivityInspection" ||
    v === "DrawingCheck"
  );
}

type AssignmentList = { assignments?: { id: string; template?: { id?: string } }[] };
type TemplateRow = { id: string };

export async function ensureFamilyAssignment(
  projectId: string,
  family: string,
  token: string | null | undefined,
  templateId?: string | null
): Promise<string | null> {
  const f = normalizeFillFamily(family);
  if (templateId) {
    try {
      const assigned = await api<{ id: string }>(`/api/checklist/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ templateId }),
      });
      return assigned.id;
    } catch {
      /* fall through */
    }
  }
  const data = await api<AssignmentList>(`/api/checklist/project/${projectId}?type=${encodeURIComponent(f)}`, {
    token,
  }).catch(() => ({ assignments: [] as AssignmentList["assignments"] }));
  if (data.assignments?.[0]?.id) return data.assignments[0].id;

  const templates = await api<TemplateRow[]>(`/api/checklist/templates?type=${encodeURIComponent(f)}`, {
    token,
  }).catch(() => [] as TemplateRow[]);
  const first = templates[0];
  if (!first) return null;
  try {
    const assigned = await api<{ id: string }>(`/api/checklist/project/${projectId}/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ templateId: first.id }),
    });
    return assigned.id;
  } catch {
    return null;
  }
}

/**
 * Open the fill log for this family (assignees fill from a log row popup).
 * Pass assignmentId to skip straight to the fill popup.
 */
export async function openFamilyChecklistFill(
  projectId: string,
  family: string,
  token: string | null | undefined,
  opts?: { assignmentId?: string | null; templateId?: string | null; preferAssignmentFill?: boolean }
): Promise<Window | null> {
  const f = normalizeFillFamily(family);
  if (f === "DrawingCheck" && !opts?.preferAssignmentFill && !opts?.assignmentId) {
    return openDrawingCheckWindow(projectId);
  }
  if (opts?.assignmentId) {
    return openChecklistFillWindow(projectId, opts.assignmentId, f);
  }
  openInPageOverlay({ kind: "checklist-log", projectId, family: f });
  void token;
  void opts?.templateId;
  return window;
}

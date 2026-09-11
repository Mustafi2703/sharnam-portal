import { api } from "../api";
import { openDrawingCheckWindow } from "./drawingCheckWindow";
import { openStandaloneFormWindow } from "./standaloneFormWindow";

export type ChecklistFillFamily =
  | "QualityInspection"
  | "Safety"
  | "SiteExecution"
  | "ActivityInspection"
  | "DrawingCheck";

/** Open checklist fill in a dedicated window (Quality / Safety / site / activity — never the tool register). */
export function openChecklistFillWindow(
  projectId: string,
  assignmentId: string,
  family: string,
  opts?: { resumeDraft?: boolean }
) {
  const q = new URLSearchParams({ family: normalizeFillFamily(family) });
  if (opts?.resumeDraft) q.set("resume", "1");
  const path = `/projects/${projectId}/checklist/fill/${assignmentId}?${q.toString()}`;
  return openStandaloneFormWindow(path, `checklist-fill-${assignmentId}`);
}

export function checklistFillUrl(projectId: string, assignmentId: string, family: string) {
  return `/projects/${projectId}/checklist/fill/${assignmentId}?family=${encodeURIComponent(normalizeFillFamily(family))}`;
}

export function normalizeFillFamily(family: string): string {
  if (family === "SafetyChecklist") return "Safety";
  if (family === "QualityIR") return "QualityInspection";
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

/**
 * Find or assign a checklist for this family, then open the same standalone fill
 * window used for drawing check — never navigate the current register away.
 */
export async function openFamilyChecklistFill(
  projectId: string,
  family: string,
  token: string | null | undefined,
  opts?: { assignmentId?: string | null; templateId?: string | null }
): Promise<Window | null> {
  const f = normalizeFillFamily(family);
  if (f === "DrawingCheck") {
    return openDrawingCheckWindow(projectId);
  }

  if (opts?.assignmentId) {
    return openChecklistFillWindow(projectId, opts.assignmentId, f);
  }

  let assignmentId: string | undefined;

  if (opts?.templateId) {
    try {
      const assigned = await api<{ id: string }>(`/api/checklist/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ templateId: opts.templateId }),
      });
      assignmentId = assigned.id;
    } catch {
      /* vendor / client may not assign — fall through to existing assignments */
    }
  }

  if (!assignmentId) {
    const data = await api<AssignmentList>(`/api/checklist/project/${projectId}?type=${encodeURIComponent(f)}`, {
      token,
    }).catch(() => ({ assignments: [] as AssignmentList["assignments"] }));
    assignmentId = data.assignments?.[0]?.id;
  }

  if (!assignmentId) {
    const templates = await api<TemplateRow[]>(`/api/checklist/templates?type=${encodeURIComponent(f)}`, {
      token,
    }).catch(() => [] as TemplateRow[]);
    const first = templates[0];
    if (!first) {
      window.alert("Assign a checklist type from master first, then use Fill.");
      return null;
    }
    try {
      const assigned = await api<{ id: string }>(`/api/checklist/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ templateId: first.id }),
      });
      assignmentId = assigned.id;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not open a checklist fill window.");
      return null;
    }
  }

  return openChecklistFillWindow(projectId, assignmentId, f);
}

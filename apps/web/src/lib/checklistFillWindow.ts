import { openStandaloneFormWindow } from "./standaloneFormWindow";

/** Open checklist fill in a dedicated window (Quality / Safety / site / activity — never the tool register). */
export function openChecklistFillWindow(
  projectId: string,
  assignmentId: string,
  family: string,
  opts?: { resumeDraft?: boolean }
) {
  const q = new URLSearchParams({ family });
  if (opts?.resumeDraft) q.set("resume", "1");
  const path = `/projects/${projectId}/checklist/fill/${assignmentId}?${q.toString()}`;
  return openStandaloneFormWindow(path, `checklist-fill-${assignmentId}`);
}

export function checklistFillUrl(projectId: string, assignmentId: string, family: string) {
  return `/projects/${projectId}/checklist/fill/${assignmentId}?family=${encodeURIComponent(family)}`;
}

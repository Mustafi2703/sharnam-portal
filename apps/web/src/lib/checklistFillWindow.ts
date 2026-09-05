/** Open checklist fill in a dedicated window (Quality / Safety / site execution — not embedded in module chrome). */
export function openChecklistFillWindow(
  projectId: string,
  assignmentId: string,
  family: string,
  opts?: { resumeDraft?: boolean }
) {
  const q = new URLSearchParams({ family });
  if (opts?.resumeDraft) q.set("resume", "1");
  const url = `${window.location.origin}/projects/${projectId}/checklist/fill/${assignmentId}?${q.toString()}`;
  window.open(url, `checklist-fill-${assignmentId}`, "width=1400,height=920,scrollbars=yes,resizable=yes");
}

export function checklistFillUrl(projectId: string, assignmentId: string, family: string) {
  return `/projects/${projectId}/checklist/fill/${assignmentId}?family=${encodeURIComponent(family)}`;
}

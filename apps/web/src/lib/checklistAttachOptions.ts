import type { ChecklistAttachOption } from "../components/ChecklistAttachPicker";

const FILLED_STATUSES = new Set(["Submitted", "Approved", "Reviewed"]);

type AssignmentRow = {
  id: string;
  template?: {
    name?: string;
    category?: string;
    checklistType?: string;
    discipline?: string | null;
  } | null;
  submissions?: { status?: string }[];
};

/** Assignments from checklist manager that can be linked on drawing / RFI upload (filled, not Drawing Check). */
export function checklistAssignmentsToAttachOptions(assignments: AssignmentRow[]): ChecklistAttachOption[] {
  return assignments
    .filter((row) => row.template?.checklistType !== "DrawingCheck")
    .filter((row) => (row.submissions || []).some((s) => FILLED_STATUSES.has(String(s.status || ""))))
    .map((row) => {
      const t = row.template;
      const hintParts = [t?.category, t?.discipline, t?.checklistType].map((v) => (v || "").trim()).filter(Boolean);
      return {
        id: row.id,
        name: t?.name || "Checklist",
        hint: hintParts.join(" · ") || undefined,
        discipline: (t?.discipline || "").trim() || undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterAttachOptionsByDiscipline(options: ChecklistAttachOption[], discipline: string): ChecklistAttachOption[] {
  const disc = discipline.trim();
  if (!disc) return options;
  return options.filter((o) => !o.discipline || o.discipline === disc);
}

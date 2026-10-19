/** Older cards used these words. New cards store whatever note the office types. */
export const PROJECT_STATUSES = ["Planning", "In Progress", "On Hold", "Completed"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function projectStatusHint(status?: string | null): string {
  const value = (status || "").trim();
  if (!value || value === "Planning") return "Write a status note on the project card. Edit it whenever you want.";
  if (value === "In Progress") return "Live — site modules and reports are open.";
  if (value === "On Hold") return "Paused. Card stays on the register.";
  if (value === "Completed") return "Closed for delivery.";
  return "";
}

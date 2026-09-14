/** Delivery-project status on the CRM register. Planning = card saved; In Progress = launched. */
export const PROJECT_STATUSES = ["Planning", "In Progress", "On Hold", "Completed"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function projectStatusHint(status?: string | null): string {
  switch (status) {
    case "In Progress":
      return "Live — site modules and reports are open.";
    case "On Hold":
      return "Paused. Card stays on the register.";
    case "Completed":
      return "Closed for delivery.";
    default:
      return "Card saved on the register. Edit status here. Continue setup only if parties or staff still need adding.";
  }
}

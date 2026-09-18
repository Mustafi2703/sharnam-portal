/** Production polish — hide dev/demo sheet actions on project modules. */
export const HIDE_SHEET_TEMPLATE_ACTIONS = true;

export function canLoadSheetTemplates(role?: string | null) {
  if (!HIDE_SHEET_TEMPLATE_ACTIONS) return true;
  return role === "admin";
}

export function canBulkProvisionSheets(role?: string | null) {
  if (!HIDE_SHEET_TEMPLATE_ACTIONS) return true;
  return role === "admin" || role === "office";
}

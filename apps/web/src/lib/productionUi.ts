/** Production polish — hide dev/demo sheet actions on project modules. */
export const HIDE_SHEET_TEMPLATE_ACTIONS = true;

/** Demo / SPDC template loads belong on the UAT Data desk only — never on project tools. */
export function canLoadSheetTemplates(_role?: string | null) {
  return false;
}

export function canBulkProvisionSheets(role?: string | null) {
  if (!HIDE_SHEET_TEMPLATE_ACTIONS) return true;
  return role === "admin" || role === "office";
}

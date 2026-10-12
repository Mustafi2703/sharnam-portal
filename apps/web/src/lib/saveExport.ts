import { api } from "../api";

/**
 * Save a module export to the project's SharePoint ISO folder (live + weekly copy). `path` is the export's
 * download path; `module` is the ISO folder key (boq, mb, bbs, budget, cashflow, costReport, finance,
 * prTracker, invoiceTracker, qap, cube, ncr, safety, safetyNcr, progress, hindrance, meetings …).
 */
export async function saveExportToSharePoint(
  projectId: string,
  token: string | null,
  path: string,
  module: string,
  fileName?: string
): Promise<string> {
  const out = await api<{ url?: string; sharePointUrl?: string | null; path: string | null; fileName?: string; pending?: boolean; folder?: string }>(
    `/api/projects/${projectId}/save-export`,
    { method: "POST", token, body: JSON.stringify({ path, module, fileName }) }
  );
  if (out.pending || !out.path) return `Saving to SharePoint (${out.folder || "project folder"}) in the background — refresh the folder in a minute.`;
  return `Saved ${out.fileName} to SharePoint (${out.path.split("/").slice(0, -1).pop() || "project folder"}) — live copy + this week's copy.`;
}

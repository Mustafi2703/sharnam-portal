/**
 * "Save to SharePoint" for any module export. The export is regenerated through its own download route
 * with the caller's login (same access rules as the download button), then filed in the module's ISO
 * folder — live copy replaced, plus a Weekly/<week> copy — via publishRegisterWorkbook.
 */
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { publishRegisterWorkbook, type PublishResult } from "./registerWorkbookPublish.js";

const EXPORT_PATH = /^\/api\/[a-z0-9-]+\/[^?#]*(download|export|weekly)[^?#]*\.(xlsx|pdf|pptx|csv|xml)(\?[^#]*)?$/i;
/** Record-level exports whose path carries the record id rather than the project id. */
const RECORD_EXPORT = /^\/api\/(safety|rfis|comms\/meetings)\/[^/]+\/(export|download)\.(xlsx|pdf)$/i;

export function isPublishableExport(path: string, projectId: string) {
  if (!EXPORT_PATH.test(path) || path.includes("..")) return false;
  return path.includes(`/${projectId}/`) || path.includes(`/${projectId}?`) || RECORD_EXPORT.test(path.split("?")[0]);
}

export async function saveExportToSharePoint(opts: {
  projectId: string;
  userId: string;
  token: string;
  path: string;
  moduleKey: string;
  fileName?: string;
}): Promise<PublishResult> {
  if (!(opts.moduleKey in MODULE_TO_ISO_FOLDER)) throw new Error(`Unknown module folder: ${opts.moduleKey}`);
  if (!isPublishableExport(opts.path, opts.projectId)) throw new Error("Not a downloadable export of this project");
  const port = Number(process.env.PORT || 4000);
  const res = await fetch(`http://127.0.0.1:${port}${opts.path}`, { headers: { Authorization: `Bearer ${opts.token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Export failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") || "";
  const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  const ext = opts.path.split("?")[0].split(".").pop();
  const fileName = (opts.fileName || (fromHeader ? decodeURIComponent(fromHeader) : `export.${ext}`)).replace(/[\\/:*?"<>|]+/g, "_");
  return publishRegisterWorkbook({
    projectId: opts.projectId,
    userId: opts.userId,
    moduleKey: opts.moduleKey as keyof typeof MODULE_TO_ISO_FOLDER,
    fileName,
    buffer,
    auditAction: "export.save_to_sharepoint",
    auditMeta: { exportPath: opts.path },
  });
}

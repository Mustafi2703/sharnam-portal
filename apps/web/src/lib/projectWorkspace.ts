import { MODULE_META, getActiveWorkspace, type WorkspaceKey } from "../workspaces";

/** Route tail after `/projects/:projectId/` (empty on project home). */
export function projectRouteTail(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const i = parts.indexOf("projects");
  if (i < 0 || !parts[i + 1]) return "";
  return parts.slice(i + 2).join("/");
}

function checklistFamilyModule(search: string, tool: "master" | "logs"): WorkspaceKey {
  const family = new URLSearchParams(search).get("family");
  if (family === "Safety") return "safety";
  if (family === "DrawingCheck") return "drawings";
  if (family === "ActivityInspection") return "inspection";
  if (family === "SiteExecution") return "quality";
  return "quality";
}

/** Checklist families are module-scoped: DrawingCheck → drawings, QualityInspection → quality, Safety → safety. */

/** Resolve which project module owns the current route (left nav + tool chrome). */
export function resolveProjectWorkspace(pathname: string, search: string): WorkspaceKey | "home" {
  const tail = projectRouteTail(pathname);
  if (!tail) return "home";

  if (tail.startsWith("hub/")) {
    const mod = tail.slice(4);
    if (MODULE_META[mod as WorkspaceKey]) return mod as WorkspaceKey;
  }

  if (tail === "drawings" || tail.startsWith("drawings/")) return "drawings";
  if (tail === "coordination") return "drawings";

  if (tail === "dms" || tail.startsWith("dms/")) return "dms";

  if (tail === "quality" || tail.startsWith("quality/")) return "quality";
  if (["inspections", "checklist", "quality-inspections", "qap"].includes(tail)) return "quality";

  if (tail === "safety" || tail.startsWith("safety/")) return "safety";

  if (tail === "inspection-register" || tail.startsWith("inspection-register") || tail.startsWith("inspection/")) return "inspection";

  if (tail === "checklist-master") return checklistFamilyModule(search, "master");
  if (tail === "checklist-logs") return checklistFamilyModule(search, "logs");

  if (tail === "progress" || tail.startsWith("progress/")) return "progress";
  if (["diary", "photos"].includes(tail)) return "comms";
  if (tail === "site-pilot") return "comms";
  if (tail.startsWith("progress/")) return "progress";
  if (tail === "audit-kpi" || tail.startsWith("audit-kpi/")) return "auditKpi";
  if (["dpr-maker", "wpr-maker"].includes(tail)) return "reports";
  if (["comms", "email", "submittals"].includes(tail)) return "comms";
  if (tail === "cost" || tail.startsWith("cost/")) return "cost";
  if (tail === "finance" || tail.startsWith("finance/")) return "finance";
  if (tail === "reports" || tail.startsWith("reports/")) return "reports";
  if (tail === "closure") return "closure";

  if (tail === "rfis") {
    const kind = new URLSearchParams(search).get("kind");
    if (kind === "DrawingChecklist") return "drawings";
    if (kind === "RequestForInformation") return "drawings";
    if (kind === "QualityInspection") return "quality";
    if (kind === "SafetyChecklist") return "safety";
    if (kind === "QualityIR" || kind === "SafetyIR" || kind === "ActivityInspection") return "inspection";
    if (kind === "SiteExecution") return "quality";
    const stored = getActiveWorkspace();
    if (stored === "quality" || stored === "drawings" || stored === "safety" || stored === "comms" || stored === "inspection") return stored;
    return "quality";
  }

  if (["directory", "vendors"].includes(tail)) return "home";
  return "home";
}

export function isProjectModuleActive(pathname: string, search: string, key: WorkspaceKey): boolean {
  return resolveProjectWorkspace(pathname, search) === key;
}

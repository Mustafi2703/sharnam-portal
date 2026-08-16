import type { ModuleToolItem } from "../workspaces";

/** Whether a module tool tab matches the current route (shared by layout chrome + ModuleToolNav). */
export function isToolActive(
  t: ModuleToolItem,
  pathname: string,
  search: string,
  projectId: string | undefined
): boolean {
  if (!projectId) return false;
  if (pathname.includes("/hub/")) return false;

  const base = t.to ? `/projects/${projectId}/${t.to}` : `/projects/${projectId}`;
  const pathOk = t.end ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  if (!pathOk) return false;

  const params = new URLSearchParams(search);
  const currentTab = params.get("tab");
  const currentSheet = params.get("sheet");
  const currentKind = params.get("kind");

  if (t.query) {
    if (t.to === "directory" && t.query.startsWith("party=")) {
      const expectedParty = new URLSearchParams(t.query).get("party");
      const currentParty = params.get("party") || "PMC";
      return currentParty === expectedParty;
    }
    if (t.to === "reports") {
      const expected = new URLSearchParams(t.query);
      const kind = expected.get("kind");
      if (kind === "dpr") return !currentKind || currentKind === "dpr";
    }
    const expected = new URLSearchParams(t.query);
    return [...expected.entries()].every(([k, v]) => params.get(k) === v);
  }

  if (currentSheet && ["inspections", "safety", "closure"].includes(t.to)) {
    return false;
  }

  if (t.to === "drawings/register" && currentSheet) {
    return false;
  }

  if (t.to === "progress") return !currentTab;
  if (t.to === "cost") return !currentTab || currentTab === "monitoring";
  if (t.to === "finance") return !currentTab;
  if (t.to === "comms") return !currentTab || currentTab === "matrix";

  if (currentKind || params.get("family") || currentTab) return false;
  return true;
}

import { useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { isSpdcEmployee } from "../lib/driveAccess";

/** Tool → SharePoint ISO folder key (graph.ts MODULE_TO_ISO_FOLDER). */
export function sharePointKeyFor(pathname: string, search: string, activeMod: string): string {
  const p = `${pathname}?${search}`.toLowerCase();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const lock = params.get("lock");
  const tab = params.get("tab");

  if (/coordination/.test(p)) return "designCoordination";
  if (/submittal/.test(p)) return "submittals";
  // Drawing Request-for-Information register / compose → Correspondence Control
  if (/\/rfis\b/.test(p) && (params.get("view") === "register" || params.get("kind") === "RequestForInformation" || params.get("kind") === "DrawingChecklist" || !params.get("kind"))) {
    return "rfiInformation";
  }
  if (/cube/.test(p)) return "cube";
  if (/ncr|car-register|non-?conform/.test(p)) return activeMod === "safety" || /safety/.test(p) ? "safetyNcr" : "ncr";
  if (/qap/.test(p)) return "qap";
  if (/site-instruction|sheet=si\b|sheet=so\b/.test(p)) return "siteInstructions";
  // Per-product IR registers — Quality F-01/F-02 vs Safety IR/HSE
  if (/inspection-register/.test(p)) {
    if (lock === "safety" || tab === "safety-ir" || tab === "hse-register") return "safety";
    if (lock === "quality" || tab === "quality-ir" || tab === "activity-checklist") return "qualityChecklist";
    return activeMod === "safety" ? "safety" : "qualityChecklist";
  }
  if (/inspection|checklist|sheet=qi/.test(p)) return activeMod === "safety" ? "safety" : "qualityChecklist";
  if (/dpr|diary|daily/.test(p)) return "dpr";
  if (/wpr|weekly/.test(p)) return "wpr";
  if (/hindrance/.test(p)) return "hindrance";
  if (/photo/.test(p)) return "photos";
  if (/meeting|minutes/.test(p)) return "meetings";
  if (/cashflow/.test(p)) return "cashflow";
  if (/budget/.test(p)) return "budget";
  if (/ra-?bill/.test(p)) return "raBill";
  if (/variation/.test(p)) return "variation";
  if (/boq/.test(p)) return "boq";
  return (
    {
      drawings: "drawings",
      quality: "qap",
      safety: "safety",
      progress: "progress",
      comms: "meetings",
      auditKpi: "hrAudit",
      cost: "costReport",
      finance: "finance",
      reports: "reportsMis",
      closure: "finalAccount",
      inspection: "qualityChecklist",
    } as Record<string, string>
  )[activeMod] || "";
}

export function OpenInSharePointButton({
  projectId,
  moduleKey,
  token,
  role,
}: {
  projectId: string;
  moduleKey: string;
  token: string | null | undefined;
  role?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  if (!isSpdcEmployee(role)) return null;
  const open = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the folder.
    const win = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const r = await api<{ webUrl: string | null }>(
        `/api/projects/${projectId}/sharepoint-folder?module=${encodeURIComponent(moduleKey)}`,
        { token: token ?? null }
      );
      if (!r.webUrl) throw new Error("SharePoint did not return a link for this folder.");
      if (win) win.location.href = r.webUrl;
      else window.location.href = r.webUrl;
    } catch (err) {
      win?.close();
      alert(err instanceof Error ? err.message : "Could not open SharePoint");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="secondary" className="!text-sm" onClick={open} disabled={busy} title="Open this tool's folder in SharePoint to download and check the files">
      {busy ? "Opening…" : "Open in SharePoint"}
    </Button>
  );
}

import { useState } from "react";
import { api, ApiError } from "../api";
import { Button } from "./ui";
import { isSpdcEmployee } from "../lib/driveAccess";

/** Tool → SharePoint ISO folder key (graph.ts MODULE_TO_ISO_FOLDER). */
export function sharePointKeyFor(pathname: string, search: string, activeMod: string): string {
  const p = `${pathname}?${search}`.toLowerCase();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const lock = params.get("lock");
  const tab = params.get("tab");
  const sheet = params.get("sheet") || "";
  const kind = params.get("kind") || "";

  if (/coordination/.test(p)) return "designCoordination";
  if (/submittal/.test(p)) return "submittals";
  if (/\/rfis\b/.test(p)) {
    if (kind === "QualityIR" || kind === "QualityInspection" || kind === "ActivityInspection") return "qualityChecklist";
    if (kind === "SafetyIR" || kind === "SafetyChecklist") return "safety";
    return "rfiInformation";
  }
  if (/cube/.test(p)) return "cube";
  if (/ncr|car-register|non-?conform/.test(p) || /sheet=ncr/.test(p)) {
    return activeMod === "safety" || /safety/.test(p) ? "safetyNcr" : "ncr";
  }
  if (/qap/.test(p)) return "qap";
  if (/site-instruction|sheet=si\b|sheet=so\b/.test(p)) return "siteInstructions";
  if (/inspection-register/.test(p)) {
    if (lock === "safety" || tab === "safety-ir" || tab === "hse-register") return "safety";
    if (lock === "quality" || tab === "quality-ir" || tab === "activity-checklist") return "qualityChecklist";
    return activeMod === "safety" ? "safety" : "qualityChecklist";
  }
  if (/\/safety(\/|$|\?)/.test(p) || activeMod === "safety") {
    if (/checklist/.test(p)) return "safety";
    if (/ncr/.test(p) || sheet.includes("ncr")) return "safetyNcr";
    return "safety";
  }
  if (/checklist|sheet=qi|quality\/checklist|site-checklist/.test(p)) {
    return activeMod === "safety" ? "safety" : "qualityChecklist";
  }
  if (/\/drawings(\/|$|\?)/.test(p) || activeMod === "drawings") return "drawings";
  if (/dpr|diary|daily/.test(p)) return "dpr";
  if (/wpr|weekly|reports/.test(p) && (activeMod === "reports" || /wpr|dpr-maker|wpr-maker/.test(p))) return "wpr";
  if (/hindrance/.test(p)) return "hindrance";
  if (/photo/.test(p)) return "photos";
  if (/meeting|minutes|comms/.test(p)) return "meetings";
  if (/cashflow/.test(p)) return "cashflow";
  if (/budget/.test(p)) return "budget";
  if (/ra-?bill|finance/.test(p)) return "raBill";
  if (/variation/.test(p)) return "variation";
  if (/boq/.test(p)) return "boq";
  if (/progress/.test(p) || activeMod === "progress") return "progress";
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
  const [note, setNote] = useState("");
  if (!isSpdcEmployee(role)) return null;

  const open = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the folder.
    const win = window.open("about:blank", "_blank");
    if (win) {
      try {
        win.document.write(
          "<!doctype html><title>Opening SharePoint…</title><body style='font-family:system-ui;padding:2rem;color:#334'>" +
            "<p>Looking up the project folder in SharePoint…</p></body>"
        );
      } catch {
        /* cross-origin blank */
      }
    }
    setBusy(true);
    setNote("");
    try {
      const qs = moduleKey ? `?module=${encodeURIComponent(moduleKey)}` : "";
      const r = await api<{ webUrl: string | null; folder?: string; note?: string; fallback?: boolean }>(
        `/api/projects/${projectId}/sharepoint-folder${qs}`,
        { token: token ?? null, timeoutMs: 90_000 }
      );
      if (!r.webUrl) throw new Error("SharePoint did not return a link for this folder.");
      if (win) win.location.href = r.webUrl;
      else window.open(r.webUrl, "_blank", "noopener,noreferrer");
      if (r.fallback && r.note) setNote(r.note);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not open SharePoint";
      setNote(msg);
      if (win && !win.closed) {
        try {
          win.document.open();
          win.document.write(
            `<!doctype html><title>SharePoint</title><body style="font-family:system-ui;padding:2rem;max-width:36rem">` +
              `<h1 style="font-size:1.1rem">Could not open the folder</h1>` +
              `<p style="color:#555">${msg.replace(/</g, "&lt;")}</p>` +
              `<p style="color:#777;font-size:0.9rem">Ask office/admin if your Microsoft account has access to the Sharnam Projects site. Retry in a moment if Graph was busy.</p>` +
              `</body>`
          );
          win.document.close();
        } catch {
          win.close();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <Button
        type="button"
        variant="secondary"
        className="!text-sm"
        onClick={() => void open()}
        disabled={busy}
        title="Open this tool's folder in SharePoint. People with access to the Sharnam Projects site can browse and download."
      >
        {busy ? "Opening SharePoint…" : "Open in SharePoint"}
      </Button>
      {note ? <span className="text-[10px] text-amber-800 max-w-[14rem] text-right leading-snug">{note}</span> : null}
    </span>
  );
}

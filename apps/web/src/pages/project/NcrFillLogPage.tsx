import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { downloadAuthFile } from "../../lib/downloadReport";
import { openNcrFormWindow } from "../../lib/ncrFormFields";
import { StatusNote } from "../../components/StatusNote";

type FillRow = {
  id: string;
  number?: string | null;
  kind: "NCR" | "CAR";
  ncrType?: string | null;
  contractor?: string | null;
  description: string;
  location?: string | null;
  status: string;
  issueDate?: string | null;
  fillPhase: "Draft" | "Open" | "Closed";
  progress: { pct: number; label: string; missing: string[] };
  lastActivity?: { at: string; action: string; by?: string; note?: string } | null;
  createdAt: string;
};

/**
 * NCR / CAR fill log — same pattern as drawing checklist fill log:
 * raise → appear here → Fill / Resume draft → Save draft (SharePoint) → Close.
 */
export default function NcrFillLogPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<FillRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const canSyncAll = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const list = await api<FillRow[]>(`/api/checklist/project/${id}/ncr-fill-log`, { token });
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to load NCR fill log");
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "ncr-form-saved" && (!e.data.projectId || e.data.projectId === id)) {
        void load();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id, token]);

  async function syncAll() {
    if (!id) return;
    setSyncBusy(true);
    setMsg("");
    try {
      const out = await api<{ synced: number; register?: { path: string }[] }>(
        `/api/checklist/project/${id}/ncr/sync-sharepoint`,
        { method: "POST", token }
      );
      setMsg(
        `Synced ${out.synced} NCR/CAR form(s) + live register to SharePoint. Nightly day-close also re-syncs after hours.`
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SharePoint sync failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function syncOne(ncrId: string) {
    if (!id) return;
    try {
      const out = await api<{ phase: string; folder: string }>(
        `/api/checklist/project/${id}/ncr/${ncrId}/sync-sharepoint`,
        { method: "POST", token }
      );
      setMsg(`Synced to SharePoint · ${out.phase} → ${out.folder}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <div className="space-y-4 page-scroll-full pb-8">
      <PageHeader
        eyebrow="Quality · NCR 01"
        title="NCR / CAR fill log"
        subtitle="NCR = Non-Conformance Report · CAR = Corrective Action Request. Fill from this log (like drawing checklists). Save drafts — they sync to SharePoint Drafts. Nightly job re-syncs all forms + register."
      />

      <div className="flex flex-wrap items-center gap-2">
        {id && (
          <Link
            to={`/projects/${id}/inspections?sheet=car-register`}
            className="text-sm font-semibold text-brand"
          >
            ← NCR / CAR register
          </Link>
        )}
        {canSyncAll && (
          <Button type="button" variant="secondary" className="!text-xs ml-auto" disabled={syncBusy} onClick={() => void syncAll()}>
            {syncBusy ? "Syncing…" : "Sync SharePoint (all)"}
          </Button>
        )}
      </div>

      <StatusNote msg={msg} />
      {busy && <p className="text-sm text-steel-muted">Loading fill log…</p>}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-register__table">
            <thead>
              <tr>
                <th>When</th>
                <th>No.</th>
                <th>Kind</th>
                <th>Contractor</th>
                <th>Description</th>
                <th>Progress</th>
                <th>Fill phase</th>
                <th>Last activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="whitespace-nowrap text-xs">
                    {n.issueDate ? String(n.issueDate).slice(0, 10) : new Date(n.createdAt).toLocaleDateString()}
                  </td>
                  <td className="font-mono text-xs">{n.number || "—"}</td>
                  <td>
                    <Badge tone={n.kind === "CAR" ? "brand" : "neutral"}>{n.kind}</Badge>
                  </td>
                  <td className="text-xs">{n.contractor || "—"}</td>
                  <td className="max-w-xs text-xs">{n.description}</td>
                  <td>
                    <div className="font-mono text-xs">{n.progress?.label || "—"}</div>
                    <div className="w-20 h-1 bg-line rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${n.progress?.pct || 0}%` }} />
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        n.fillPhase === "Closed" ? "ok" : n.fillPhase === "Draft" ? "warn" : "neutral"
                      }
                    >
                      {n.fillPhase}
                    </Badge>
                    <div className="text-[10px] text-steel-muted mt-0.5">{n.status}</div>
                  </td>
                  <td className="text-[10px] text-steel-muted">
                    {n.lastActivity ? (
                      <>
                        <div className="font-semibold text-ink capitalize">{n.lastActivity.action}</div>
                        <div>{n.lastActivity.by || "—"}</div>
                        <div className="font-mono">{String(n.lastActivity.at).slice(0, 16).replace("T", " ")}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {id && canFill && (
                      <Button
                        type="button"
                        className="!text-xs !py-1.5 mr-1"
                        onClick={() => openNcrFormWindow(id, "quality", n.id)}
                      >
                        {n.fillPhase === "Draft" ? "Resume fill" : n.fillPhase === "Closed" ? "View form" : "Open fill"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs !py-1.5 mr-1"
                      onClick={() =>
                        void downloadAuthFile(
                          `/api/checklist/project/${id}/ncr/${n.id}/export.xlsx`,
                          token,
                          `${n.number || "NCR"}.xlsx`
                        ).catch((err) => setMsg(err instanceof Error ? err.message : "Download failed"))
                      }
                    >
                      Excel
                    </Button>
                    {(user?.role === "admin" || user?.role === "office" || user?.role === "employee") &&
                      n.fillPhase !== "Closed" && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="!text-xs !py-1.5"
                          onClick={() => void syncOne(n.id)}
                        >
                          Sync SP
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
              {!busy && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-steel-muted py-8">
                    No NCR / CAR raised yet — raise from the register, then fill from this log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

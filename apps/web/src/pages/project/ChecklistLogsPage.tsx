import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHero } from "../../components/ui";
import { downloadBrandedChecklistPrint } from "../../lib/brandedChecklistPrint";

const FAMILIES = [
  { value: "", label: "All families" },
  { value: "DrawingCheck", label: "Drawing check" },
  { value: "SiteExecution", label: "Site / drawings fill" },
  { value: "QualityInspection", label: "Quality" },
  { value: "Safety", label: "Safety" },
];

/** Fill log for Drawing / Quality / Safety — download branded PDF-style print */
export default function ChecklistLogsPage({ lockedFamily }: { lockedFamily?: string } = {}) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const family = lockedFamily || searchParams.get("family") || "";
  const { token } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const q = family ? `?type=${encodeURIComponent(family)}` : "";
      const list = await api<any[]>(`/api/checklist/project/${id}/submissions${q}`, { token });
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to load logs");
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, token, family]);

  const title = useMemo(() => {
    const f = FAMILIES.find((x) => x.value === family);
    return f?.value ? `${f.label} checklist log` : "Checklist fill log";
  }, [family]);

  async function downloadBranded(submissionId: string) {
    try {
      setMsg("");
      await downloadBrandedChecklistPrint(submissionId, token);
      setMsg("Branded checklist downloaded — use Print → Save as PDF in the opened tab.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function exportCsv() {
    if (!id) return;
    try {
      const q = family ? `?type=${encodeURIComponent(family)}` : "";
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/checklist/project/${id}/export.csv${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `checklist-log-${family || "all"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "CSV export failed");
    }
  }

  async function exportFilledXlsx() {
    if (!id) return;
    try {
      const q = family ? `?type=${encodeURIComponent(family)}` : "";
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/checklist/project/${id}/export-filled.xlsx${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filled-schedules-${family || "all"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Full filled schedule XLSX downloaded.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "XLSX export failed");
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        title={title}
        subtitle="Every fill logged with line-level data. PMC and client can track % filled and SharePoint evidence links."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="!bg-white/15 !text-white !border-white/30" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" className="!bg-amber-500" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button type="button" variant="secondary" className="!bg-white/15 !text-white !border-white/30" onClick={() => void exportFilledXlsx()}>
              Full schedule XLSX
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!bg-white/15 !text-white !border-white/30"
              onClick={async () => {
                if (!id) return;
                setMsg("");
                try {
                  const r = await api<{ ok: boolean; registers?: { name: string }[] }>(
                    `/api/dms/${id}/dump-logs`,
                    { method: "POST", token }
                  );
                  setMsg(`Synced ${r.registers?.length || 0} register CSVs to SharePoint (incl. checklist fills).`);
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "SharePoint sync failed");
                }
              }}
            >
              Sync → SharePoint
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        {!lockedFamily &&
          FAMILIES.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setSearchParams(f.value ? { family: f.value } : {})}
              className={`rounded-full px-4 py-2 text-sm font-semibold border ${
                family === f.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white border-line text-steel-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        {lockedFamily === "QualityInspection" && id && (
          <Link to={`/projects/${id}/quality/checklist-master`} className="text-sm font-semibold text-brand ml-auto">
            Quality checklist master →
          </Link>
        )}
        {lockedFamily === "Safety" && id && (
          <Link to={`/projects/${id}/safety/checklist-master`} className="text-sm font-semibold text-brand ml-auto">
            Safety checklist master →
          </Link>
        )}
        {!lockedFamily && id && (
          <Link to={`/projects/${id}/checklist-master`} className="text-sm font-semibold text-brand ml-auto">
            Checklist master →
          </Link>
        )}
      </div>

      {msg && <p className="text-sm text-danger">{msg}</p>}
      {busy && <p className="text-sm text-steel-muted">Loading fill log…</p>}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-register__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Family</th>
                <th>Checklist</th>
                <th>Progress</th>
                <th>Evidence</th>
                <th>Responsible</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    <Badge tone="neutral">{s.assignment?.template?.checklistType || "—"}</Badge>
                  </td>
                  <td>{s.assignment?.template?.name || "—"}</td>
                  <td>
                    <div className="font-mono text-xs">{s.progress?.progressLabel || "—"}</div>
                    <div className="text-[10px] text-steel-muted">{s.progress?.answerPct ?? 0}% · {s.progress?.statusHint || ""}</div>
                    <div className="w-20 h-1 bg-line rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${s.progress?.answerPct || 0}%` }} />
                    </div>
                  </td>
                  <td className="text-xs">
                    {s.progress?.evidenceCount ?? 0} total
                    <div className="text-[10px] text-steel-muted">
                      {s.progress?.linkEvidence || 0} links · {s.progress?.fileEvidence || s.photos?.length || 0} files
                    </div>
                  </td>
                  <td>
                    {s.submittedBy?.fullName || "—"}
                    <div className="text-[11px] text-steel-muted capitalize">{s.submittedBy?.role || "—"}</div>
                    <div className="text-[10px] font-mono text-steel-muted">{s.drawing?.drawingNumber || "No drawing"}</div>
                  </td>
                  <td>
                    <Badge tone={s.status === "Submitted" || s.status === "Approved" ? "ok" : s.status === "Draft" ? "warn" : "neutral"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {s.status !== "Draft" && (
                      <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => void downloadBranded(s.id)}>
                        Download branded
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !busy && (
                <tr>
                  <td colSpan={8} className="empty">
                    No fills logged yet for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-steel-muted">
        Tip: “Download branded” saves an HTML file and opens a print-ready tab with the Sharnam logo — use Print → Save as PDF for archive.
      </p>
    </div>
  );
}

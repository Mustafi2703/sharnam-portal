import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHero } from "../../components/ui";
import { openBrandedChecklistPrint } from "../../lib/brandedChecklistPrint";

const FAMILIES = [
  { value: "", label: "All families" },
  { value: "DrawingCheck", label: "Drawing check" },
  { value: "SiteExecution", label: "Site / drawings fill" },
  { value: "QualityInspection", label: "Quality" },
  { value: "Safety", label: "Safety" },
];

/** Fill log for Drawing / Quality / Safety — download branded PDF-style print */
export default function ChecklistLogsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const family = searchParams.get("family") || "";
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
      const detail = await api<any>(`/api/checklist/submissions/${submissionId}`, { token });
      openBrandedChecklistPrint(detail);
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

  return (
    <div className="space-y-5">
      <PageHero
        title={title}
        subtitle="Every Drawing, Quality, and Safety checklist fill is logged. Download a Sharnam-branded print (save as PDF) or export CSV."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="!bg-white/15 !text-white !border-white/30" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" className="!bg-amber-500" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        {FAMILIES.map((f) => (
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
        <Link to={`/projects/${id}/checklist-master`} className="text-sm font-semibold text-brand ml-auto">
          Checklist master →
        </Link>
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
                <th>Drawing</th>
                <th>Filled by</th>
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
                  <td className="font-mono text-xs">{s.drawing?.drawingNumber || "—"}</td>
                  <td>
                    {s.submittedBy?.fullName || "—"}
                    <div className="text-[11px] text-steel-muted">{s.submittedBy?.role}</div>
                  </td>
                  <td>
                    <Badge tone={s.status === "Submitted" || s.status === "Approved" ? "ok" : "warn"}>{s.status}</Badge>
                  </td>
                  <td className="text-right">
                    <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => void downloadBranded(s.id)}>
                      Download branded
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && !busy && (
                <tr>
                  <td colSpan={7} className="empty">
                    No fills logged yet for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-steel-muted">
        Tip: “Download branded” opens a print-ready page with the Sharnam logo — use Print → Save as PDF for a beautiful archive.
      </p>
    </div>
  );
}

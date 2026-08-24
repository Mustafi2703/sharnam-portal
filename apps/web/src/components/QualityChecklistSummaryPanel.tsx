import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BarChart, PieChart } from "./PieChart";
import { Badge, Button, Card } from "./ui";

type CatalogRow = {
  srNo: number;
  name: string;
  category: string;
  family?: string;
  onboarded?: boolean;
  templateId?: string | null;
  itemCount?: number;
  assigned?: boolean;
  assignmentId?: string | null;
  fillCount?: number;
  lastFilledAt?: string | null;
  lastStatus?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  dash: any;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
};

function statusTone(row: CatalogRow): "ok" | "warn" | "neutral" | "danger" {
  if ((row.fillCount || 0) > 0) return "ok";
  if (row.assigned) return "warn";
  if (row.onboarded) return "neutral";
  return "danger";
}

function statusLabel(row: CatalogRow) {
  if ((row.fillCount || 0) > 0) return `Filled ×${row.fillCount}`;
  if (row.assigned) return "On project — not filled";
  if (row.onboarded) return "In master";
  return "Not onboarded";
}

/** Quality Dashboard Sheet1 catalog + live fill status for DPR daily / weekly / monthly. */
export function QualityChecklistSummaryPanel({ projectId, token, dash, canManage, onChanged }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const autoRef = useRef(false);

  const rows: CatalogRow[] = dash?.catalogStatus?.length
    ? dash.catalogStatus
    : (dash?.workbook?.checklistCatalog || []).map((r: CatalogRow) => r);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cat !== "All" && r.category !== cat) return false;
      if (q && !`${r.srNo} ${r.name} ${r.category}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, cat, q]);

  const onboarded = rows.filter((r) => r.onboarded).length;
  const filledTypes = rows.filter((r) => (r.fillCount || 0) > 0).length;
  const todayFills = (dash?.fillTrends?.fillsByDay || []).slice(-1)[0]?.value || 0;

  useEffect(() => {
    if (!canManage || autoRef.current) return;
    if (rows.length >= 100 && onboarded >= rows.length * 0.8) return;
    if (!rows.length) return;
    autoRef.current = true;
    void sync(true);
  }, [canManage, rows.length, onboarded]);

  async function sync(silent = false) {
    if (!silent) {
      setBusy(true);
      setMsg("");
    }
    try {
      const out = await api<{ catalog: number; created: number; assigned: number; pack?: { workbookFiles: number; matchedToCatalog: number; catalogRows: number } }>(
        `/api/checklist/project/${projectId}/quality-catalog/sync`,
        { method: "POST", token }
      );
      if (!silent) {
        const packNote = out.pack
          ? ` · ${out.pack.matchedToCatalog}/${out.pack.catalogRows} linked to client xlsx in New folder`
          : "";
        setMsg(`Onboarded ${out.catalog} types (${out.created} new) and assigned to this project${packNote}.`);
      }
      await onChanged();
    } catch (err) {
      autoRef.current = false;
      if (!silent) setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      if (!silent) setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Catalog types</div>
          <div className="text-xl font-display">{rows.length}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">In master</div>
          <div className="text-xl font-display">{onboarded}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Types filled</div>
          <div className="text-xl font-display text-ok">{filledTypes}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">QI fills (all)</div>
          <div className="text-xl font-display">{dash?.totals?.fills ?? 0}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Latest day fills</div>
          <div className="text-xl font-display">{todayFills}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Open QI / RFIs</div>
          <div className="text-xl font-display">
            {dash?.totals?.openInspections ?? 0}/{dash?.totals?.openFillRfis ?? 0}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <BarChart title="Filled — daily (feeds DPR)" items={dash?.fillTrends?.fillsByDay || dash?.charts?.fillsByDay || []} maxBars={14} />
        </Card>
        <Card>
          <BarChart title="Filled — weekly (feeds WPR)" items={dash?.fillTrends?.fillsByWeek || dash?.charts?.fillsByWeek || []} maxBars={12} />
        </Card>
        <Card>
          <BarChart title="Filled — monthly" items={dash?.fillTrends?.fillsByMonth || dash?.charts?.fillsByMonth || []} maxBars={12} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem] gap-4">
        <Card>
          <PieChart title="Fills by discipline" items={dash?.charts?.fillsByDiscipline || []} />
        </Card>
        <Card className="!p-4">
          <h3 className="font-semibold mb-2">Where this lives</h3>
          <p className="text-xs text-steel-muted mb-3">
            Left list is the <strong>type catalog</strong> (Sheet1) already onboarded in Quality checklist master. Fill
            history is the <strong>QI fill log</strong> — both feed the DPR quality block.
          </p>
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <Link className="text-brand" to={`/projects/${projectId}/quality/checklist-master`}>
              Quality checklist master →
            </Link>
            <Link className="text-brand" to={`/projects/${projectId}/quality/checklist-logs`}>
              QI fill log →
            </Link>
            <Link className="text-brand" to={`/projects/${projectId}/rfis?kind=QualityInspection`}>
              Request QI fill →
            </Link>
          </div>
          {canManage && (
            <Button type="button" className="mt-4 w-full" disabled={busy} onClick={() => void sync(false)}>
              {busy ? "Onboarding…" : "Onboard all Sheet1 types to master"}
            </Button>
          )}
        </Card>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Checklist catalog — Quality Dashboard · Sheet1</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              {filtered.length} of {rows.length} types · status from master + this project’s fill log
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="text-xs border border-line rounded px-2 py-1 bg-white"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="All">All disciplines</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              className="text-xs border border-line rounded px-2 py-1 min-w-[12rem]"
              placeholder="Search name / Sr…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-auto max-h-[min(56vh,40rem)]">
          <table className="sheet-register__table w-full text-xs min-w-[52rem]">
            <thead>
              <tr>
                <th className="text-left">Sr</th>
                <th className="text-left">Checklist type</th>
                <th className="text-left">Discipline</th>
                <th className="text-left">Master</th>
                <th className="text-left">Lines</th>
                <th className="text-left">Status</th>
                <th className="text-left">Last fill</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.srNo}>
                  <td className="font-mono">{r.srNo}</td>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.category}</td>
                  <td>{r.onboarded ? "Yes" : "—"}</td>
                  <td className="tabular-nums">{r.itemCount ?? "—"}</td>
                  <td>
                    <Badge tone={statusTone(r)}>{statusLabel(r)}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-steel-muted">
                    {r.lastFilledAt
                      ? `${new Date(r.lastFilledAt).toLocaleDateString("en-IN")} · ${r.lastStatus || ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    No catalog rows — onboard Sheet1 types or re-seed Quality Dashboard.xlsx.
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

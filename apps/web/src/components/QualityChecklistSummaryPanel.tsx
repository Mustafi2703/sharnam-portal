import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart } from "./PieChart";
import { ColumnChart } from "./ColumnChart";
import { Badge, Card } from "./ui";

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
export function QualityChecklistSummaryPanel({ projectId, dash, canManage }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

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

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="shrink-0 space-y-4">
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
          <ColumnChart title="Filled — daily (feeds DPR)" items={dash?.fillTrends?.fillsByDay || dash?.charts?.fillsByDay || []} series={[{ key: "value", label: "Fills", color: "#0F766E" }]} yLabel="Fills" emptyText="No fills yet." />
        </Card>
        <Card>
          <ColumnChart title="Filled — weekly (feeds WPR)" items={dash?.fillTrends?.fillsByWeek || dash?.charts?.fillsByWeek || []} series={[{ key: "value", label: "Fills", color: "#0F766E" }]} yLabel="Fills" emptyText="No fills yet." />
        </Card>
        <Card>
          <ColumnChart title="Filled — monthly" items={dash?.fillTrends?.fillsByMonth || dash?.charts?.fillsByMonth || []} series={[{ key: "value", label: "Fills", color: "#0F766E" }]} yLabel="Fills" emptyText="No fills yet." />
        </Card>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem] gap-4">
        <Card>
          <PieChart title="Fills by discipline" items={dash?.charts?.fillsByDiscipline || []} />
        </Card>
        <Card className="!p-4">
          <h3 className="font-semibold mb-2">Where this lives</h3>
          <p className="text-xs text-steel-muted mb-3">
            This catalog is the Sheet1 <strong>type list</strong> (status only). Do not fill from here — raise a Quality
            IR and link the checklist on the inspection register; the contractor fills from that request.
          </p>
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <Link className="text-brand" to={`/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality`}>
              Raise / open Quality IR register →
            </Link>
            <Link className="text-brand" to={`/projects/${projectId}/quality/checklist-master`}>
              Quality checklist master →
            </Link>
            <Link className="text-brand" to={`/projects/${projectId}/quality/checklist-logs`}>
              QI fill log (info only) →
            </Link>
          </div>
          {canManage && (
            <p className="mt-4 text-xs text-steel-muted">
              Demo onboard of all Sheet1 types is on Admin → UAT Data.
            </p>
          )}
        </Card>
      </div>
      </div>

      <Card padding={false} className="overflow-hidden flex flex-col flex-1 min-h-0 register-panel-fill">
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Checklist catalog — Quality Dashboard · Sheet1</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              {filtered.length} of {rows.length} types · status only · request a fill via Quality IR (not from this table)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
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
            <Link
              to={`/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality`}
              className="text-xs font-semibold text-brand underline"
            >
              Request fill on IR register →
            </Link>
          </div>
        </div>
        <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
          <table className="sheet-register__table w-full text-xs min-w-[48rem]">
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

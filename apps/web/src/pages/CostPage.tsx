import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHero, Select } from "../components/ui";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { BoqMonitoringEditor } from "../components/BoqMonitoringEditor";
import { CostSheetUploadPanel } from "../components/CostSheetUploadPanel";
import { BbsEntryTable } from "../components/BbsEntryTable";
import { MbEntryTable } from "../components/MbEntryTable";
import { MasterLinePicker } from "../components/MasterLinePicker";
import { BarChart, PieChart } from "../components/PieChart";

type CostTab = "budget" | "monitoring" | "cashflow" | "rates" | "boq" | "bills" | "mb" | "bbs";
const COST_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "boq", "bills", "mb", "bbs"];

function SheetTable({
  title,
  headers,
  rows,
  stickyFirst = true,
}: {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  stickyFirst?: boolean;
}) {
  return (
    <div className="sheet-register w-full">
      {title && (
        <div className="sheet-register__head">
          <span>{title}</span>
          <span className="text-steel-muted font-normal normal-case tracking-normal">{rows.length} rows</span>
        </div>
      )}
      <div className="sheet-register__scroll">
        <table className="sheet-register__table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={stickyFirst && i === 0 ? "sticky-col" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={`${stickyFirst && j === 0 ? "sticky-col" : ""} ${j <= 1 ? "wrap" : ""}`}>
                    {c ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={headers.length} className="empty">
                  No rows in this sheet yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CostPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [billsData, setBillsData] = useState<{ bills: any[]; totals: any } | null>(null);
  const [parties, setParties] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [structureName, setStructureName] = useState("New structure");
  const [msg, setMsg] = useState("");
  const [cfView, setCfView] = useState<"chart" | "forecast" | "tracking" | "all">(
    (["chart", "forecast", "tracking", "all"].includes(searchParams.get("cf") || "")
      ? (searchParams.get("cf") as "chart" | "forecast" | "tracking" | "all")
      : "chart")
  );
  const rawTab = searchParams.get("tab") || "monitoring";
  const tab: CostTab = COST_TABS.includes(rawTab as CostTab) ? (rawTab as CostTab) : "monitoring";
  const pkgFilter = searchParams.get("pkg") || "All";
  const setTab = (next: CostTab, pkg?: string, cf?: string) => {
    const nextParams: Record<string, string> = {};
    if (next !== "monitoring") nextParams.tab = next;
    const p = pkg ?? pkgFilter;
    if (p && p !== "All") nextParams.pkg = p;
    if (next === "cashflow") {
      nextParams.cf = cf ?? cfView ?? "chart";
    }
    setSearchParams(nextParams);
  };
  const setPkg = (p: string) => setTab(tab, p);
  const setCashflowView = (k: "chart" | "forecast" | "tracking" | "all") => {
    setCfView(k);
    setTab("cashflow", pkgFilter, k);
  };

  useEffect(() => {
    const cf = searchParams.get("cf");
    if (cf === "chart" || cf === "forecast" || cf === "tracking" || cf === "all") setCfView(cf);
  }, [searchParams]);
  const [billForm, setBillForm] = useState({
    vendorId: "",
    vendorName: "",
    pmcPartyId: "",
    billNo: "",
    amount: "",
    gstAmount: "",
    copNo: "",
    description: "",
    status: "Submitted",
  });
  const [mbForm, setMbForm] = useState({
    packageName: "Dormitory Civil",
    srNo: "",
    description: "",
    nos1: "1",
    nos2: "1",
    length: "",
    width: "",
    height: "",
    unit: "Cmt",
  });

  useEffect(() => {
    if (pkgFilter !== "All") setMbForm((f) => ({ ...f, packageName: pkgFilter }));
  }, [pkgFilter]);
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";
  const canSiteEdit = user?.role === "site_employee";
  const clientBlocked = user?.role === "client";

  const load = () => {
    const q = pkgFilter !== "All" ? `?package=${encodeURIComponent(pkgFilter)}` : "";
    return api(`/api/cost/${id}/summary${q}`, { token }).then(setSummary);
  };
  const loadBills = () => api<{ bills: any[]; totals: any }>(`/api/cost/${id}/bills`, { token }).then(setBillsData);

  async function downloadSheet(kind: string) {
    const q = pkgFilter !== "All" ? `?package=${encodeURIComponent(pkgFilter)}` : "";
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/cost/${id}/download/${kind}.csv${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-${pkgFilter === "All" ? "all" : pkgFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`Downloaded ${kind} sheet (open in Excel)`);
  }

  useEffect(() => {
    if (!clientBlocked) {
      void load();
      void loadBills();
      api<any[]>(`/api/vendors/project/${id}`, { token })
        .then((rows) => setParties(rows.map((r: any) => r.vendor || r).filter(Boolean)))
        .catch(() =>
          api<any[]>("/api/vendors", { token }).then(setParties).catch(() => setParties([]))
        );
    }
  }, [id, token, clientBlocked, pkgFilter]);

  const contractors = useMemo(() => parties.filter((p) => p.partyType === "Contractor"), [parties]);
  const vendors = useMemo(() => parties.filter((p) => p.partyType === "Vendor" || !p.partyType), [parties]);
  const pmcParties = useMemo(() => parties.filter((p) => p.partyType === "PMC"), [parties]);

  const packages = useMemo(() => ["All", ...(summary?.packages || [])], [summary]);
  const monPackages = useMemo(
    () => (summary?.sheetTools?.monitoring || []).map((m: any) => m.packageName),
    [summary]
  );
  const mbPackages = useMemo(() => (summary?.sheetTools?.mb || []).map((m: any) => m.packageName), [summary]);
  const bbsPackages = useMemo(() => (summary?.sheetTools?.bbs || []).map((m: any) => m.packageName), [summary]);

  const mbRows = useMemo(() => summary?.mbLines || [], [summary]);
  const bbsRows = useMemo(() => summary?.bbsLines || [], [summary]);
  const monRows = useMemo(() => summary?.monitoring || [], [summary]);
  const sheetFiles = useMemo(() => summary?.sheetFiles || [], [summary]);
  const bbsBarMarks = useMemo(
    () => [...new Set(bbsRows.map((b: any) => b.barMark).filter(Boolean))] as string[],
    [bbsRows]
  );

  const cashflowRows = useMemo(() => {
    if (cfView === "chart") return summary?.cashflowChart?.length ? summary.cashflowChart : summary?.cashflow || [];
    if (cfView === "forecast") return summary?.cashflowForecast || [];
    if (cfView === "tracking") return summary?.cashflowTracking || [];
    return summary?.cashflow || [];
  }, [summary, cfView]);

  if (clientBlocked) {
    return (
      <div className="space-y-4 w-full">
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <p className="text-steel-muted">Cost tracking is not available on the client portal.</p>
      </div>
    );
  }

  if (!summary) return <div className="text-steel-muted py-10">Loading cost sheets…</div>;

  async function addMb(e: FormEvent) {
    e.preventDefault();
    await api(`/api/cost/${id}/mb`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...mbForm,
        nos1: Number(mbForm.nos1 || 0),
        nos2: Number(mbForm.nos2 || 1),
        length: Number(mbForm.length || 0),
        width: Number(mbForm.width || 0),
        height: Number(mbForm.height || 0),
      }),
    });
    setMsg("MB line added");
    await load();
  }

  const packageTools =
    tab === "monitoring" ? monPackages : tab === "mb" ? mbPackages : tab === "bbs" ? bbsPackages : [];

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHero
        title="Cost"
        subtitle="Parikh-style BOQ / MB / BBS sheet registers — one tool at a time. Commercial invoices live in Finance."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
              <ReportExportButtons projectId={id} kind="cost" compact />
              {(tab === "monitoring" || tab === "boq") && (
                <Button type="button" onClick={() => downloadSheet("boq")}>
                  Download BOQ CSV
                </Button>
              )}
              {tab === "mb" && (
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary" onClick={() => downloadSheet("mb")}>
                  Download MB CSV
                </Button>
              )}
              {tab === "bbs" && (
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary" onClick={() => downloadSheet("bbs")}>
                  Download BBS CSV
                </Button>
              )}
              {tab === "budget" && (
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary" onClick={() => downloadSheet("budget")}>
                  Download Budget
                </Button>
              )}
              {tab === "cashflow" && (
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary" onClick={() => downloadSheet("cashflow")}>
                  Download Cashflow
                </Button>
              )}
              {tab === "rates" && (
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary" onClick={() => downloadSheet("rates")}>
                  Download rates
                </Button>
              )}
              <Link to={`/projects/${id}/hub/finance`}>
                <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary">
                  Finance →
                </Button>
              </Link>
          </div>
        }
      />

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {(
          [
            ["Budgeted", summary.totals.budgeted, "var(--color-kpi-1)", "BOQ baseline"],
            ["Work order", summary.totals.workOrder, "var(--color-kpi-2)", "Issued WO"],
            ["Certified", summary.totals.certified, "var(--color-kpi-3)", "Certified value"],
            ["MB qty total", summary.totals.mbQty, "var(--color-kpi-4)", "Measurement book"],
            ["BBS weight kg", summary.totals.bbsWeightKg, "var(--color-kpi-5)", "Bar bending"],
            ["Bills pending", billsData?.totals?.pending ?? 0, "var(--color-kpi-6)", "COP / bills"],
          ] as const
        ).map(([label, val, color, hint]) => (
          <div key={label} className="kpi-tile">
            <div className="kpi-tile__bar" style={{ background: color }} />
            <div className="kpi-tile__label" style={{ color }}>
              {label}
            </div>
            <div className="kpi-tile__value">
              {/qty|weight|kg/i.test(label)
                ? Number(val).toLocaleString("en-IN", { maximumFractionDigits: 1 })
                : formatINR(val as number)}
            </div>
            <div className="kpi-tile__hint">{hint}</div>
          </div>
        ))}
      </div>

      {/* BOQ / cashflow mini dashboard */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="kpi-tile !p-4">
          <div className="kpi-tile__label">BOQ health</div>
          <div className="mt-2 flex items-end gap-2">
            <div className="font-display text-2xl text-ink">
              {(summary.packages || []).length}
            </div>
            <div className="text-xs text-steel-muted pb-1">packages</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-sand overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round(((summary.totals.certified || 0) / Math.max(summary.totals.budgeted || 1, 1)) * 100))}%`,
                background: "linear-gradient(90deg, var(--color-kpi-1), var(--color-kpi-5))",
              }}
            />
          </div>
          <div className="kpi-tile__hint mt-2">
            Certified vs budget{" "}
            {Math.round(((summary.totals.certified || 0) / Math.max(summary.totals.budgeted || 1, 1)) * 100)}%
          </div>
        </div>
        <div className="kpi-tile !p-4">
          <div className="kpi-tile__label">Monitoring rows</div>
          <div className="font-display text-2xl text-ink mt-2">{(summary.monitoring || []).length}</div>
          <div className="kpi-tile__hint">Active BOQ / monitoring lines</div>
        </div>
        <div className="kpi-tile !p-4">
          <div className="kpi-tile__label">Cashflow periods</div>
          <div className="font-display text-2xl text-ink mt-2">
            {(summary.cashflow || summary.cashflowChart || []).length}
          </div>
          <div className="kpi-tile__hint">Planned vs actual periods loaded</div>
        </div>
      </div>

      {["monitoring", "mb", "bbs"].includes(tab) && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-steel-muted font-mono">
            Package tools (from SPDC Budget sheets)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPkg("All")}
              className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                pkgFilter === "All" ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line text-ink"
              }`}
            >
              All packages
            </button>
            {packageTools.map((p: string) => (
              <button
                key={p}
                type="button"
                onClick={() => setPkg(p)}
                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border max-w-[220px] truncate ${
                  pkgFilter === p ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line text-ink hover:border-brand/40"
                }`}
                title={p}
              >
                {p}
                {tab === "monitoring" && summary.monByPackage?.[p] != null ? ` (${summary.monByPackage[p]})` : ""}
                {tab === "mb" && summary.mbByPackage?.[p]?.lines != null
                  ? ` (${summary.mbByPackage[p].lines})`
                  : ""}
                {tab === "bbs" && summary.bbsByPackage?.[p]?.lines != null
                  ? ` (${summary.bbsByPackage[p].lines})`
                  : ""}
              </button>
            ))}
            {!packageTools.length &&
              packages
                .filter((p: string) => p !== "All")
                .map((p: string) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPkg(p)}
                    className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                      pkgFilter === p ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line text-ink"
                    }`}
                  >
                    {p}
                  </button>
                ))}
          </div>
        </div>
      )}

      {tab === "monitoring" && (
        <div className="space-y-3">
          <Card className="!p-4 border-line bg-paper/80">
            <h3 className="font-semibold text-sm">BOQ is per project &amp; structure</h3>
            <p className="text-xs text-steel-muted mt-1">
              Monitoring lines come from <strong>this project only</strong> — upload each structure/package on the{" "}
              <button type="button" className="text-brand font-semibold underline-offset-2 hover:underline" onClick={() => setTab("boq")}>
                BOQ tab
              </button>{" "}
              (e.g. Civil Dormitory, Electric, UGWT). Global masters apply to <strong>MB &amp; BBS only</strong>.
            </p>
          </Card>
          <p className="text-sm text-steel-muted">
            Edit sections and line items inline. Office edits BOQ rate/qty; site edits GFC and Achieved. MB item codes roll up to Achieved via sync.
          </p>
          {canEdit && (
            <Card className="!p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">MB → BOQ achieved sync</div>
                <p className="text-xs text-steel-muted mt-0.5">
                  Matches MB item code to monitoring item no (e.g. Dormitory Civil → Civil Dormitory). GFC qty is never overwritten.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const pkg = pkgFilter !== "All" ? pkgFilter : undefined;
                  const res = await api<{ mbSync: { linesUpdated: number }[] }>(
                    `/api/cost/${id}/sync-from-sheets`,
                    {
                      method: "POST",
                      token,
                      body: JSON.stringify({ packageName: pkg, applyShapes: true }),
                    }
                  );
                  const n = (res.mbSync || []).reduce((s, r) => s + r.linesUpdated, 0);
                  setMsg(`Synced ${n} monitoring line(s) from MB · BBS shape codes applied`);
                  await load();
                }}
              >
                Sync from MB &amp; BBS shapes
              </Button>
            </Card>
          )}
          <BoqMonitoringEditor
            projectId={id!}
            token={token}
            rows={monRows}
            packages={(summary.packages || []).length ? summary.packages : ["Civil"]}
            canFullEdit={canEdit}
            canSiteEdit={canSiteEdit}
            onChanged={() => void load()}
          />
        </div>
      )}

      {tab === "mb" && (
        <div className="space-y-4">
          {canEdit && (
            <MasterLinePicker
              projectId={id!}
              token={token}
              kind="mb"
              defaultPackage={pkgFilter}
              packageOptions={mbPackages.length ? mbPackages : packages.filter((p: string) => p !== "All")}
              canEdit={canEdit}
              onImported={() => void load()}
            />
          )}
          {(canEdit || canSiteEdit) && (
            <CostSheetUploadPanel
              projectId={id!}
              token={token}
              kind="mb"
              packageName={pkgFilter}
              packageOptions={mbPackages.length ? mbPackages : packages.filter((p: string) => p !== "All")}
              files={sheetFiles}
              canEdit={canEdit}
              onChanged={() => void load()}
            />
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(summary.mbByPackage || {}).map(([pkg, v]: [string, any]) => (
              <Card key={pkg} className="!p-3">
                <div className="text-[10px] uppercase text-steel-muted">{pkg}</div>
                <div className="font-display text-xl mt-1">{Number(v.qty).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</div>
                <div className="text-xs text-steel-muted">{v.lines} MB lines</div>
              </Card>
            ))}
          </div>
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Add MB line</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMb}>
                <Select value={mbForm.packageName} onChange={(e) => setMbForm({ ...mbForm, packageName: e.target.value })}>
                  {(summary.packages || ["Dormitory Civil", "Electric", "Plumbing", "UGWT"]).map((p: string) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Input placeholder="Sr" value={mbForm.srNo} onChange={(e) => setMbForm({ ...mbForm, srNo: e.target.value })} />
                <Input
                  className="sm:col-span-2"
                  placeholder="Description"
                  value={mbForm.description}
                  onChange={(e) => setMbForm({ ...mbForm, description: e.target.value })}
                  required
                />
                <Input placeholder="Nos" value={mbForm.nos1} onChange={(e) => setMbForm({ ...mbForm, nos1: e.target.value })} />
                <Input placeholder="Length" value={mbForm.length} onChange={(e) => setMbForm({ ...mbForm, length: e.target.value })} />
                <Input placeholder="Width" value={mbForm.width} onChange={(e) => setMbForm({ ...mbForm, width: e.target.value })} />
                <Input placeholder="Height" value={mbForm.height} onChange={(e) => setMbForm({ ...mbForm, height: e.target.value })} />
                <Button type="submit">Add to MB</Button>
              </form>
            </Card>
          )}
          <MbEntryTable
            projectId={id!}
            token={token}
            rows={mbRows}
            canFullEdit={canEdit}
            canSiteEdit={canSiteEdit}
            onChanged={() => void load()}
          />
        </div>
      )}

      {tab === "bbs" && (
        <div className="space-y-4">
          {canEdit && (
            <MasterLinePicker
              projectId={id!}
              token={token}
              kind="bbs"
              defaultPackage={pkgFilter}
              packageOptions={bbsPackages.length ? bbsPackages : packages.filter((p: string) => p !== "All")}
              canEdit={canEdit}
              onImported={() => void load()}
            />
          )}
          <div className="rounded-sm border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm">
            <strong className="text-ink">BBS upload &amp; shape markup</strong>
            <span className="text-steel-muted">
              {" "}
              — Import the Excel sheet, then upload an annotated bend diagram in the <strong>Shape of bar</strong> column for each row (same position as SPDC * BBS sheets).
            </span>
          </div>
          {(canEdit || canSiteEdit) && (
            <CostSheetUploadPanel
              projectId={id!}
              token={token}
              kind="bbs"
              packageName={pkgFilter}
              packageOptions={bbsPackages.length ? bbsPackages : packages.filter((p: string) => p !== "All")}
              barMarks={bbsBarMarks}
              files={sheetFiles}
              canEdit={canEdit || canSiteEdit}
              onChanged={() => void load()}
            />
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(summary.bbsByPackage || {}).map(([pkg, v]: [string, any]) => (
              <Card key={pkg} className="!p-3">
                <div className="text-[10px] uppercase text-steel-muted">{pkg}</div>
                <div className="font-display text-xl mt-1">{Number(v.weightKg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg</div>
                <div className="text-xs text-steel-muted">{v.lines} bars</div>
              </Card>
            ))}
          </div>
          <BbsEntryTable
            projectId={id!}
            token={token}
            rows={bbsRows}
            canUpload={canEdit || canSiteEdit}
            canFullEdit={canEdit}
            canSiteEdit={canSiteEdit}
            onChanged={() => void load()}
          />
        </div>
      )}

      {tab === "budget" && (
        <div className="space-y-4">
          {canEdit && (
            <Card className="!p-4">
              <h3 className="font-semibold text-sm mb-2">Upload Budget WBS</h3>
              <p className="text-xs text-steel-muted mb-3">
                From <code className="font-mono">SPDC_Budget_Arvind 49.xls</code> Budget tab — connects to Cashflow Dashboard forecast structures.
              </p>
              <form
                className="flex flex-wrap gap-3 items-center"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem("budgetFile") as HTMLInputElement;
                  const f = input.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  fd.append("replace", "1");
                  await api(`/api/cost/${id}/budget/import`, { method: "POST", token, body: fd });
                  setMsg("Budget WBS imported");
                  await load();
                }}
              >
                <input name="budgetFile" type="file" accept=".xlsx,.xls" required />
                <Button type="submit">Import budget sheet</Button>
              </form>
            </Card>
          )}
          <div className="rounded-sm border border-line bg-paper px-4 py-3 text-sm grid sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase text-steel-muted">Budget WBS total</div>
              <div className="font-display text-lg">{formatINR(summary.totals.budgeted)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-steel-muted">Work order</div>
              <div className="font-display text-lg">{formatINR(summary.totals.workOrder)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-steel-muted">Cashflow chart planned</div>
              <div className="font-display text-lg">{formatINR(summary.totals.planned)}</div>
            </div>
          </div>
          <SheetTable
          title="Budget WBS"
          headers={["Sr", "Description", "Stakeholder", "Budgeted", "WO", "Certified", "Forecast"]}
          rows={summary.budget.map((b: any) => [
            b.srNo,
            b.description,
            b.stakeholder,
            formatINR(b.budgetedAmount),
            formatINR(b.workOrderAmount),
            formatINR(b.certifiedAmount),
            formatINR(b.forecastedAmount),
          ])}
        />
        </div>
      )}

      {tab === "cashflow" && (
        <div className="space-y-3">
          {canEdit && (
            <Card className="!p-4">
              <h3 className="font-semibold text-sm mb-2">Upload Cashflow Dashboard</h3>
              <p className="text-xs text-steel-muted mb-3">
                <code className="font-mono">Cashflow - Dashboard.xlsx</code> — Chart (INR), Forecast, Tracking sheets. Budget WBS totals feed forecast structure rows.
              </p>
              <form
                className="flex flex-wrap gap-3 items-center"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem("cfFile") as HTMLInputElement;
                  const f = input.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  fd.append("replace", "1");
                  const res = await api<{ imported: number }>(`/api/cost/${id}/cashflow/import`, {
                    method: "POST",
                    token,
                    body: fd,
                  });
                  setMsg(`Cashflow imported — ${res.imported} periods`);
                  await load();
                }}
              >
                <input name="cfFile" type="file" accept=".xlsx,.xls" required />
                <Button type="submit">Import cashflow dashboard</Button>
              </form>
            </Card>
          )}
          <div className="rounded-sm border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm space-y-1">
            <div>
              <strong>Budget ↔ Cashflow:</strong> Budget WBS ({formatINR(summary.totals.budgeted)}) · Cashflow Chart planned (
              {formatINR(summary.totals.planned)}) · Budget certified ({formatINR(summary.totals.certified)}).
            </div>
            {summary.financeBridge && (
              <div>
                <strong>Finance COP ↔ Cashflow actual:</strong> COP payable{" "}
                {formatINR(summary.financeBridge.finance.copPayable)} · Cashflow actual outflow{" "}
                {formatINR(summary.totals.actual)} — maintain COP in{" "}
                <Link to={`/projects/${id}/hub/finance?tab=cop`} className="text-brand font-semibold">
                  Finance → COP
                </Link>
                .
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["chart", "Cash Flow Chart"],
                ["forecast", "Forecast"],
                ["tracking", "Tracking"],
                ["all", "All rows"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCashflowView(k)}
                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                  cfView === k ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-steel-muted">
            From <code className="font-mono">Cashflow - Dashboard.xlsx</code> — Chart / Forecast / Tracking sheets.
          </p>
          <div className="grid lg:grid-cols-2 gap-3">
            <BarChart
              title="Planned vs actual by period"
              items={(cashflowRows || []).map((b: any) => ({
                label: b.periodLabel || b.packageName || "—",
                planned: Number(b.plannedAmount) || 0,
                actual: Number(b.actualAmount) || 0,
              }))}
              valueKey="planned"
              compareKey="actual"
              maxBars={14}
            />
            <PieChart
              title="Period progress share"
              items={(cashflowRows || [])
                .map((b: any) => ({
                  label: String(b.periodLabel || b.packageName || "—"),
                  value: Math.max(Number(b.actualAmount) || 0, Number(b.plannedAmount) || 0),
                }))
                .filter((x: { value: number }) => x.value > 0)
                .slice(0, 8)}
            />
          </div>
          <SheetTable
            title={`Cashflow · ${cfView}`}
            headers={["Period", "Package / sheet", "Planned", "Actual", "Progress"]}
            rows={cashflowRows.map((b: any) => [
              b.periodLabel,
              b.packageName,
              formatINR(b.plannedAmount),
              formatINR(b.actualAmount),
              `${Math.round((b.progressPct || 0) * 100)}%`,
            ])}
          />
        </div>
      )}

      {tab === "rates" && (
        <SheetTable
          title="Rate difference (Steel / Cement / Tiles)"
          headers={["Material", "Description", "Vendor", "Qty", "Basic", "Purchase", "Excess", "Saving"]}
          rows={summary.rateDiffs.map((b: any) => [
            b.materialType,
            b.description,
            b.vendorName,
            b.qty,
            b.basicRate,
            b.purchaseRate,
            formatINR(b.excessAmount),
            formatINR(b.savingAmount),
          ])}
        />
      )}

      {tab === "bills" && (
        <div className="space-y-4">
          <Card className="!p-4 border-brand/30 bg-brand-soft/30">
            <h3 className="font-semibold text-sm">Commercial COP lives in Finance</h3>
            <p className="text-xs text-steel-muted mt-1">
              Official <strong>Certificate of Payment</strong> (PO → RA Bill → COP) is maintained in{" "}
              <Link to={`/projects/${id}/hub/finance?tab=cop`} className="text-brand font-semibold">
                Finance → COP
              </Link>
              . Cost → Bills below is a quick vendor log only.
            </p>
            {summary.financeBridge && (
              <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase text-steel-muted">Finance COP payable</div>
                  <div className="font-display">{formatINR(summary.financeBridge.finance.copPayable)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-steel-muted">Finance COP certified</div>
                  <div className="font-display">{formatINR(summary.financeBridge.finance.copCertified)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-steel-muted">Cashflow chart actual</div>
                  <div className="font-display">{formatINR(summary.totals.actual)}</div>
                </div>
              </div>
            )}
          </Card>
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-2">Vendor / contractor bill · COP</h3>
              <p className="text-xs text-steel-muted mb-3">Select contractor or vendor and PMC from directory.</p>
              <form
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const party = parties.find((p) => p.id === billForm.vendorId);
                  await api(`/api/cost/${id}/bills`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                      vendorId: billForm.vendorId || null,
                      vendorName: party?.name || billForm.vendorName || "Vendor",
                      billNo: billForm.billNo,
                      amount: Number(billForm.amount || 0),
                      gstAmount: Number(billForm.gstAmount || 0),
                      copNo: billForm.copNo,
                      description: [
                        billForm.description,
                        billForm.pmcPartyId
                          ? `PMC: ${parties.find((p) => p.id === billForm.pmcPartyId)?.name || ""}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      status: billForm.status,
                    }),
                  });
                  setBillForm({
                    vendorId: "",
                    vendorName: "",
                    pmcPartyId: "",
                    billNo: "",
                    amount: "",
                    gstAmount: "",
                    copNo: "",
                    description: "",
                    status: "Submitted",
                  });
                  await loadBills();
                }}
              >
                <Select
                  value={billForm.vendorId}
                  onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                  required
                >
                  <option value="">Contractor / vendor…</option>
                  <optgroup label="Contractors">
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Vendors">
                    {vendors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
                <Select value={billForm.pmcPartyId} onChange={(e) => setBillForm({ ...billForm, pmcPartyId: e.target.value })}>
                  <option value="">PMC (optional)…</option>
                  {pmcParties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input required placeholder="Bill no." value={billForm.billNo} onChange={(e) => setBillForm({ ...billForm, billNo: e.target.value })} />
                <Input required placeholder="Amount" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} />
                <Input placeholder="GST" value={billForm.gstAmount} onChange={(e) => setBillForm({ ...billForm, gstAmount: e.target.value })} />
                <Input placeholder="COP / RA no." value={billForm.copNo} onChange={(e) => setBillForm({ ...billForm, copNo: e.target.value })} />
                <Input
                  className="sm:col-span-2 lg:col-span-3"
                  placeholder="Description"
                  value={billForm.description}
                  onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
                />
                <Button type="submit" className="sm:col-span-2 lg:col-span-3">
                  Add bill
                </Button>
              </form>
            </Card>
          )}
          <SheetTable
            title="COP / bill register"
            headers={["Bill no", "Vendor", "COP", "Amount", "GST", "Status", "Date"]}
            rows={(billsData?.bills || []).map((b: any) => [
              b.billNo,
              b.vendorName,
              b.copNo || "—",
              formatINR(b.amount),
              formatINR(b.gstAmount),
              b.status,
              new Date(b.billDate).toLocaleDateString("en-IN"),
            ])}
          />
        </div>
      )}

      {tab === "boq" && (
        <div className="space-y-4">
          <Card className="!p-4 border-brand/30 bg-brand-soft/30">
            <h3 className="font-semibold text-sm">Project-wise structure BOQ upload</h3>
            <p className="text-xs text-steel-muted mt-1">
              Each structure gets its own <strong>package name</strong> (Monitoring Civil Dormitory, Electric, …). Lines appear on the Monitoring tab filtered by that package. This is not stored as a global master — only for this project.
            </p>
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-2">Upload structure / BOQ</h3>
            <p className="text-xs text-steel-muted mb-3">
              Excel/CSV per structure — creates monitoring lines under the package name you enter below.
            </p>
            {canEdit && (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("packageName", structureName || "Imported structure");
                  await api(`/api/cost/${id}/structure/import`, { method: "POST", token, body: fd });
                  setFile(null);
                  setMsg(`Imported structure: ${structureName}`);
                  await load();
                }}
              >
                <Input
                  placeholder="Structure / package name"
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                  required
                />
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <Button type="submit" disabled={!file}>
                  Upload BOQ for structure
                </Button>
              </form>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Import batches</h3>
            <ul className="text-sm space-y-2 max-h-72 overflow-y-auto">
              {summary.boqBatches.map((b: any) => (
                <li key={b.id} className="border border-line px-3 py-2 rounded-sm">
                  <div className="font-medium">{b.fileName}</div>
                  <div className="text-xs text-steel-muted">
                    {b.rowCount} rows · {new Date(b.createdAt).toLocaleString("en-IN")}
                  </div>
                </li>
              ))}
              {!summary.boqBatches.length && <li className="text-steel-muted">No imports yet.</li>}
            </ul>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

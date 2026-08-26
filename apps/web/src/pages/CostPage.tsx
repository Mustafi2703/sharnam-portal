import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHero, Select } from "../components/ui";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { BoqMonitoringEditor } from "../components/BoqMonitoringEditor";
import { BudgetWbsRegister } from "../components/BudgetWbsRegister";
import { CostSheetUploadPanel } from "../components/CostSheetUploadPanel";
import { ReferenceSheetToolbar } from "../components/ReferenceSheetToolbar";
import { BbsEntryTable } from "../components/BbsEntryTable";
import { MbEntryTable } from "../components/MbEntryTable";
import { BarChart, PieChart } from "../components/PieChart";
import { CostStructureSetupPanel } from "../components/CostStructureSetupPanel";
import { CostSheetFlowBar } from "../components/CostSheetFlowBar";
import { DailySheetWorkflow } from "../components/DailySheetWorkflow";
import { RegisterEntryModal } from "../components/RegisterEntryModal";
import { costNeedsFullSync, DEFAULT_COST_MONITORING_PKG, isLikelySpdcBudgetFile } from "../lib/costWorkbook";
import { flowPackageForTab, linkedBbsPackage, mbPackageForSelection } from "../lib/spdcCostPackages";

type CostTab = "budget" | "monitoring" | "cashflow" | "rates" | "boq" | "bills" | "mb" | "bbs";
const COST_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "boq", "bills", "mb", "bbs"];
const COST_REGISTER_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "bills", "boq", "mb", "bbs"];

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
    <div className="sheet-register spdc-register-panel register-panel-fill flex flex-col w-full min-w-0">
      {title && (
        <div className="sheet-register__head shrink-0">
          <span>{title}</span>
          <span className="text-steel-muted font-normal normal-case tracking-normal">{rows.length} rows</span>
        </div>
      )}
      <div className="sheet-register__scroll register-sheet-viewport register-scroll-area scrollbars-visible flex-1 min-h-0 overflow-auto">
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
  const [msg, setMsg] = useState("");
  const autoSyncRef = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [mbAddOpen, setMbAddOpen] = useState(false);
  const [bbsAddOpen, setBbsAddOpen] = useState(false);
  const [monAddOpen, setMonAddOpen] = useState(false);
  const [syncSheetBusy, setSyncSheetBusy] = useState(false);
  const [verify, setVerify] = useState<any>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [cfView, setCfView] = useState<"chart" | "forecast" | "tracking" | "all">(
    (["chart", "forecast", "tracking", "all"].includes(searchParams.get("cf") || "")
      ? (searchParams.get("cf") as "chart" | "forecast" | "tracking" | "all")
      : "chart")
  );
  const [cfGrain, setCfGrain] = useState<"day" | "week" | "month">("month");
  const rawTab = searchParams.get("tab") || "monitoring";
  const tab: CostTab = COST_TABS.includes(rawTab as CostTab) ? (rawTab as CostTab) : "monitoring";
  const pkgFilter = searchParams.get("pkg") || DEFAULT_COST_MONITORING_PKG;
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
  const [bbsForm, setBbsForm] = useState({
    packageName: "Dormitory BBS",
    barMark: "",
    location: "",
    diameterMm: "",
    nos: "1",
    shape: "",
  });
  const mbFormRef = useRef<HTMLFormElement>(null);
  const bbsFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pkgFilter !== "All") {
      setMbForm((f) => ({ ...f, packageName: pkgFilter }));
      setBbsForm((f) => ({ ...f, packageName: pkgFilter }));
    }
  }, [pkgFilter]);
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";
  const canSiteEdit = user?.role === "site_employee";
  const siteBoqMode = canSiteEdit && !canEdit;
  const clientBlocked = user?.role === "client";

  const load = () => {
    const apiPkg =
      pkgFilter !== "All" && (tab === "mb" || tab === "bbs")
        ? flowPackageForTab(tab, pkgFilter)
        : pkgFilter;
    const q = apiPkg !== "All" ? `?package=${encodeURIComponent(apiPkg)}` : "";
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
  }, [id, token, clientBlocked, pkgFilter, tab]);

  async function runVerify() {
    if (!id) return;
    setVerifyBusy(true);
    setMsg("");
    try {
      const report = await api(`/api/cost/${id}/verify`, { token });
      setVerify(report);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function syncFullTemplate(silent = false) {
    if (!id || !canEdit) return null;
    setSyncing(true);
    if (!silent) setMsg("");
    try {
      const out = await api<{
        budget: number;
        monitoring: number;
        mb: number;
        bbs: number;
        cashflow?: number;
        fullWorkbook?: boolean;
      }>(`/api/cost/${id}/sync-template`, { method: "POST", token });
      setMsg(
        `Loaded SPDC_Budget_Arvind 49.xls — Budget ${out.budget}, Monitoring ${out.monitoring}, MB ${out.mb}, BBS ${out.bbs}${out.cashflow != null ? `, Cashflow ${out.cashflow}` : ""} rows`
      );
      await load();
      if (!silent) void runVerify();
      return out;
    } catch (err) {
      if (!silent) setMsg(err instanceof Error ? err.message : "Template load failed");
      return null;
    } finally {
      setSyncing(false);
    }
  }

  /** Auto-load full SPDC budget when registers are empty or partial (QAP/Cube pattern). */
  useEffect(() => {
    if (!summary || !canEdit || autoSyncRef.current || syncing) return;
    if (!costNeedsFullSync(summary.totals)) return;
    autoSyncRef.current = true;
    void (async () => {
      const out = await syncFullTemplate(true);
      if (!out) autoSyncRef.current = false;
      else if (tab !== "monitoring") setTab("monitoring", DEFAULT_COST_MONITORING_PKG);
    })();
  }, [summary, canEdit, id, token]);

  async function uploadBoqOrWorkbook(file: File, openPackage?: string) {
    if (!id || !canEdit) return;
    setSyncing(true);
    setMsg("");
    try {
      if (isLikelySpdcBudgetFile(file)) {
        const fd = new FormData();
        fd.append("file", file);
        const out = await api<{
          fullWorkbook?: boolean;
          monitoring?: number;
          mb?: number;
          bbs?: number;
          budget?: number;
          openPackage?: string;
          rowCount?: number;
        }>(`/api/cost/${id}/boq/import`, { method: "POST", token, body: fd });
        if (out.fullWorkbook) {
          setMsg(
            `Loaded full SPDC workbook — Budget ${out.budget ?? "—"}, Monitoring ${out.monitoring ?? out.rowCount ?? 0}, MB ${out.mb ?? 0}, BBS ${out.bbs ?? 0}`
          );
          const pkg = out.openPackage || openPackage || DEFAULT_COST_MONITORING_PKG;
          setTab("monitoring", pkg);
          await load();
          return;
        }
      }
      const fd = new FormData();
      fd.append("file", file);
      const batch = await api<{ rowCount?: number }>(`/api/cost/${id}/boq/import`, { method: "POST", token, body: fd });
      setMsg(`Imported ${batch.rowCount ?? 0} BOQ/monitoring rows from ${file.name}`);
      setTab("monitoring", openPackage || pkgFilter !== "All" ? openPackage || pkgFilter : DEFAULT_COST_MONITORING_PKG);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSyncing(false);
    }
  }

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

  const activePkg = pkgFilter !== "All" ? pkgFilter : undefined;
  const mbFlowPkg = activePkg ? mbPackageForSelection(activePkg) : undefined;
  const bbsFlowPkg = mbFlowPkg ? linkedBbsPackage(mbFlowPkg) : undefined;
  const flowCounts = useMemo(
    () => ({
      mb: mbFlowPkg ? summary?.mbByPackage?.[mbFlowPkg]?.lines ?? mbRows.length : mbRows.length,
      bbs: bbsFlowPkg ? summary?.bbsByPackage?.[bbsFlowPkg]?.lines ?? 0 : bbsRows.length,
      monitoring: activePkg ? summary?.monByPackage?.[activePkg] ?? monRows.length : monRows.length,
    }),
    [activePkg, mbFlowPkg, bbsFlowPkg, summary, mbRows.length, bbsRows.length, monRows.length]
  );

  async function syncMbToMonitoring() {
    if (!id || !activePkg) return;
    setSyncSheetBusy(true);
    setMsg("");
    try {
      const out = await api<{ mbSync?: { updated?: number } }>(`/api/cost/${id}/sync-from-sheets`, {
        method: "POST",
        token,
        body: JSON.stringify({ packageName: activePkg }),
      });
      setMsg(`Synced MB → Monitoring for ${activePkg} (${out.mbSync?.updated ?? 0} lines updated).`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncSheetBusy(false);
    }
  }

  function navigateCostFlow(next: "mb" | "bbs" | "monitoring", pkg?: string) {
    const base = pkg || activePkg || DEFAULT_COST_MONITORING_PKG;
    if (base === "All") {
      setTab(next, base);
      return;
    }
    const mbPkg = mbPackageForSelection(base);
    const resolved = next === "bbs" ? linkedBbsPackage(mbPkg) : next === "mb" ? mbPkg : base;
    setTab(next, resolved);
  }

  async function importCostSheet(kind: "mb" | "bbs", file: File) {
    if (!id || !canEdit) return;
    if (isLikelySpdcBudgetFile(file)) {
      await uploadBoqOrWorkbook(file);
      setTab(kind === "mb" ? "mb" : "bbs", kind === "mb" ? "Dormitory Civil" : "Dormitory BBS");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (/budget|monitoring|dormitory mb|dormitory bbs/i.test(file.name) || file.name.endsWith(".xls")) {
      fd.append("kind", kind);
      fd.append("replace", "0");
      try {
        const r = await api<{ mbImported?: number; bbsImported?: number; mbSheets?: number; bbsSheets?: number; packages?: string[] }>(
          `/api/cost/${id}/workbook/import`,
          { method: "POST", token, body: fd }
        );
        setMsg(
          `Workbook import — ${r.mbSheets ?? 0} MB tabs (${r.mbImported ?? 0} rows), ${r.bbsSheets ?? 0} BBS tabs (${r.bbsImported ?? 0} rows)`
        );
        await load();
        return;
      } catch {
        /* fall through to single-sheet import */
      }
    }
    const pkg = pkgFilter !== "All" ? pkgFilter : (kind === "mb" ? mbPackages[0] : bbsPackages[0]) || "Dormitory Civil";
    fd.set("packageName", pkg);
    const r = await api<{ rowsImported: number }>(`/api/cost/${id}/${kind}/import`, { method: "POST", token, body: fd });
    setMsg(`Imported ${r.rowsImported} ${kind.toUpperCase()} rows → ${pkg}`);
    await load();
  }

  const cashflowRows = useMemo(() => {
    let rows: any[] = [];
    if (cfView === "chart") rows = summary?.cashflowChart?.length ? summary.cashflowChart : summary?.cashflow || [];
    else if (cfView === "forecast") rows = summary?.cashflowForecast || [];
    else if (cfView === "tracking") rows = summary?.cashflowTracking || [];
    else rows = summary?.cashflow || [];
    if (cfView === "all" || cfView === "chart") {
      if (cfGrain === "day") rows = rows.filter((r: any) => /COP-day/i.test(r.packageName || ""));
      else if (cfGrain === "week") rows = rows.filter((r: any) => /COP-week/i.test(r.packageName || ""));
      else {
        rows = rows.filter((r: any) => !/COP-day|COP-week/i.test(r.packageName || ""));
      }
    }
    return rows;
  }, [summary, cfView, cfGrain]);

  const monitoringPackageOptions = useMemo(() => {
    const fromTools = monPackages.filter(Boolean);
    if (fromTools.length) return fromTools;
    return (summary?.packages || []).filter(Boolean);
  }, [monPackages, summary?.packages]);

  useEffect(() => {
    if (!siteBoqMode || tab !== "monitoring" || pkgFilter !== "All") return;
    const first = monitoringPackageOptions[0];
    if (first) setTab("monitoring", first);
  }, [siteBoqMode, tab, pkgFilter, monitoringPackageOptions]);

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

  if (!summary) return <div className="text-steel-muted py-10">{syncing ? "Loading SPDC cost sheets…" : "Loading cost sheets…"}</div>;

  async function addBbs(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    await api(`/api/cost/${id}/bbs`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...bbsForm,
        diameterMm: Number(bbsForm.diameterMm || 0),
        nos: Number(bbsForm.nos || 0),
      }),
    });
    setMsg("BBS line added");
    setBbsAddOpen(false);
    setBbsForm((f) => ({ ...f, barMark: "", location: "", diameterMm: "", nos: "1", shape: "" }));
    await load();
  }

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
    setMbAddOpen(false);
    await load();
  }

  const packageTools =
    tab === "monitoring" ? monPackages : tab === "mb" ? mbPackages : tab === "bbs" ? bbsPackages : [];

  const isRegisterView = COST_REGISTER_TABS.includes(tab);

  const costHeroSubtitle =
    tab === "monitoring"
      ? siteBoqMode
        ? "Pick a BOQ package and update achieved quantities — all monitoring columns stay visible."
        : "BOQ / Monitoring — pick a package, upload BOQ if needed, track GFC and achieved qty."
      : tab === "mb" || tab === "bbs"
        ? "Parikh-style MB / BBS registers — office setup lives under Admin · cost sheet setup."
        : "Parikh-style BOQ / MB / BBS sheet registers — one tool at a time. Commercial invoices live in Finance.";

  return (
    <div className="cost-page w-full min-w-0 space-y-5 pb-4">
      <div className="shrink-0">
      <PageHero
        title="Cost"
        subtitle={costHeroSubtitle}
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
              {canEdit && !siteBoqMode && (
                <Button
                  type="button"
                  className="!bg-white/15 !text-white !border-white/30"
                  variant="secondary"
                  disabled={verifyBusy || syncing}
                  onClick={() => void runVerify()}
                >
                  {verifyBusy ? "Verifying…" : "Verify vs Excel"}
                </Button>
              )}
          </div>
        }
      />
      </div>

      {id && !isRegisterView && (
        <div className="shrink-0">
          <DailySheetWorkflow projectId={id} compact />
        </div>
      )}

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm shrink-0">{msg}</p>}

      {verify && canEdit && !siteBoqMode && (!isRegisterView || !verify.ok) && (
        <details
          className={`shrink-0 rounded-lg border bg-paper ${verify.ok ? "border-ok/40" : "border-danger/40"}`}
          open={!verify.ok}
        >
          <summary className="cursor-pointer px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
            <div>
              <div className="text-sm font-semibold text-brand-dark">SPDC_Budget_Arvind 49.xls parity</div>
              <div className="text-xs text-steel-muted">
                {verify.ok ? "All sheets match Excel row counts" : "Mismatches — re-sync template or expand to review"}
                {verify.workbook ? ` · ${verify.workbook} (${verify.sheetCount ?? 36} tabs)` : ""}
              </div>
            </div>
            <Badge tone={verify.ok ? "ok" : "danger"}>
              {verify.summary?.passed ?? 0}/{verify.summary?.total ?? 0} passed
            </Badge>
          </summary>
          <div className="px-4 pb-4 border-t border-line/60 max-h-72 overflow-auto">
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-left text-steel-muted border-b border-line/60">
                  <th className="py-1 pr-3 font-medium">Check</th>
                  <th className="py-1 pr-3 font-medium">Excel</th>
                  <th className="py-1 pr-3 font-medium">DB</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(verify.checks || []).map((c: any) => (
                  <tr key={c.key} className="border-b border-line/40">
                    <td className="py-1 pr-3">{c.label}</td>
                    <td className="py-1 pr-3 font-mono">{String(c.expected)}</td>
                    <td className="py-1 pr-3 font-mono">{String(c.actual)}</td>
                    <td className="py-1">
                      <Badge tone={c.ok ? "ok" : "danger"}>{c.ok ? "OK" : "Mismatch"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!verify.ok && canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={syncing} onClick={() => void syncFullTemplate()}>
                  {syncing ? "Loading…" : "Re-sync SPDC workbook"}
                </Button>
              </div>
            )}
          </div>
        </details>
      )}

      {!isRegisterView && (
      <>
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
      </>
      )}

      {isRegisterView && canEdit && (
        <details className="rounded border border-line bg-paper shrink-0" open={tab === "boq"}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-brand-dark">
            Admin · cost sheet setup (structures · MB · BBS · bulk upload)
          </summary>
          <div className="border-t border-line">
        <CostStructureSetupPanel
          projectId={id!}
          token={token}
          structures={summary.structures || []}
          canEdit={!!canEdit}
          busy={syncing}
          message={tab === "boq" ? msg : undefined}
          onMessage={setMsg}
          onChanged={load}
          onOpenTab={(t, pkg) => setTab(t, pkg || "All")}
          onSyncTemplate={async () => {
            await syncFullTemplate();
          }}
        />
          </div>
        </details>
      )}

      {tab === "monitoring" && (
        <div className="cost-sheet-bar cost-sheet-bar--monitoring flex flex-wrap items-end gap-3 shrink-0 rounded border px-3 py-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
            BOQ package
            <Select
              className="mt-1 min-w-[14rem] max-w-full"
              value={pkgFilter}
              onChange={(e) => setPkg(e.target.value)}
            >
              <option value="All">All packages ({monitoringPackageOptions.length})</option>
              {monitoringPackageOptions.map((p: string) => (
                <option key={p} value={p}>
                  {p}
                  {summary?.monByPackage?.[p] != null ? ` · ${summary.monByPackage[p]} lines` : ""}
                </option>
              ))}
            </Select>
          </label>
          {canEdit && (
            <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Upload BOQ
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                disabled={syncing}
                className="mt-1 block max-w-xs text-xs file:mr-2 file:rounded-sm file:border file:border-line file:bg-sand file:px-2 file:py-1 file:text-xs file:font-medium"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadBoqOrWorkbook(file, activePkg);
                }}
              />
            </label>
          )}
          <p className="text-xs text-steel-muted pb-0.5 ml-auto max-w-md">
            {siteBoqMode
              ? "Choose a package to open its BOQ. Edit Achieved Qty in the highlighted column."
              : "Open a package BOQ below — upload full SPDC workbook or a single monitoring sheet per package."}
          </p>
        </div>
      )}

      {["mb", "bbs"].includes(tab) && (
        <div className={`cost-sheet-bar cost-sheet-bar--${tab} space-y-2 shrink-0 rounded border px-3 py-2.5`}>
          <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: tab === "mb" ? "#92400e" : "#1e40af" }}>
            Package tools (from SPDC Budget sheets)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPkg("All")}
              className={`cost-pkg-chip cost-pkg-chip--${tab} rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                pkgFilter === "All" ? "cost-pkg-chip--active" : "bg-paper/80 border-line text-ink"
              }`}
            >
              All packages
            </button>
            {packageTools.map((p: string) => (
              <button
                key={p}
                type="button"
                onClick={() => setPkg(p)}
                className={`cost-pkg-chip cost-pkg-chip--${tab} rounded-sm px-2.5 py-1.5 text-xs font-medium border max-w-[220px] truncate ${
                  pkgFilter === p ? "cost-pkg-chip--active" : "bg-paper/80 border-line text-ink hover:border-brand/40"
                }`}
                title={p}
              >
                {p}
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
                    className={`cost-pkg-chip cost-pkg-chip--${tab} rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                      pkgFilter === p ? "cost-pkg-chip--active" : "bg-paper/80 border-line text-ink"
                    }`}
                  >
                    {p}
                  </button>
                ))}
          </div>
        </div>
      )}

      {tab === "monitoring" && (
        <div className="cost-sheet-block space-y-3">
          {canEdit && !siteBoqMode && (
            <CostSheetFlowBar
              active="monitoring"
              packageName={pkgFilter}
              counts={flowCounts}
              onNavigate={navigateCostFlow}
              onSyncMbToMonitoring={activePkg ? () => void syncMbToMonitoring() : undefined}
              syncBusy={syncSheetBusy}
              canEdit={canEdit}
            />
          )}
          <ReferenceSheetToolbar
            sheetLabel={`BOQ monitoring — ${pkgFilter}`}
            rowCount={monRows.length}
            canEdit={canEdit}
            onUpload={canEdit ? (file) => uploadBoqOrWorkbook(file, activePkg) : undefined}
            uploadHint="Upload SPDC_Budget_Arvind 49.xls (full workbook) or a single monitoring BOQ for this package."
            onAddRow={canEdit ? () => setMonAddOpen(true) : undefined}
            onGenerate={
              canEdit
                ? async () => {
                    const out = await syncFullTemplate();
                    if (out) setTab("monitoring", DEFAULT_COST_MONITORING_PKG);
                  }
                : undefined
            }
            generateLabel="Load SPDC template"
            busy={syncing}
            onDownloadCsv={() => downloadSheet("boq")}
            message={msg || undefined}
          />
          <div className="cost-page__register min-w-0">
            <BoqMonitoringEditor
              className="min-w-0"
              projectId={id!}
              token={token}
              rows={monRows}
              packages={(summary.packages || []).length ? summary.packages : ["Civil"]}
              canFullEdit={canEdit}
              canSiteEdit={canSiteEdit}
              singlePackage={activePkg}
              addOpen={monAddOpen}
              onAddClose={() => setMonAddOpen(false)}
              onChanged={() => void load()}
            />
          </div>
        </div>
      )}

      {tab === "mb" && (
        <div className="cost-sheet-block space-y-3">
          <CostSheetFlowBar active="mb" packageName={pkgFilter} counts={flowCounts} onNavigate={navigateCostFlow} canEdit={canEdit} />
          <ReferenceSheetToolbar
            sheetLabel={`MB — ${pkgFilter}`}
            rowCount={mbRows.length}
            canEdit={canEdit || canSiteEdit}
            onUpload={canEdit ? (f) => importCostSheet("mb", f) : undefined}
            onAddRow={canEdit || canSiteEdit ? () => setMbAddOpen(true) : undefined}
            onDownloadCsv={() => downloadSheet("mb")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={mbAddOpen && (canEdit || canSiteEdit)}
            title="Add MB line"
            onClose={() => setMbAddOpen(false)}
            onSave={() => mbFormRef.current?.requestSubmit()}
            saveLabel="Add to MB"
          >
            <form ref={mbFormRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMb}>
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
            </form>
          </RegisterEntryModal>
          <div className="cost-page__register min-w-0">
            <MbEntryTable
              projectId={id!}
              token={token}
              rows={mbRows}
              singlePackage={activePkg}
              canFullEdit={canEdit}
              canSiteEdit={canSiteEdit}
              onChanged={() => void load()}
            />
          </div>
        </div>
      )}

      {tab === "bbs" && (
        <div className="cost-sheet-block space-y-3">
          <CostSheetFlowBar active="bbs" packageName={pkgFilter} counts={flowCounts} onNavigate={navigateCostFlow} canEdit={canEdit} />
          <ReferenceSheetToolbar
            sheetLabel={`BBS — ${pkgFilter}`}
            rowCount={bbsRows.length}
            canEdit={canEdit || canSiteEdit}
            onUpload={canEdit ? (f) => importCostSheet("bbs", f) : undefined}
            onAddRow={canEdit || canSiteEdit ? () => setBbsAddOpen(true) : undefined}
            onDownloadCsv={() => downloadSheet("bbs")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={bbsAddOpen && (canEdit || canSiteEdit)}
            title="Add BBS line"
            onClose={() => setBbsAddOpen(false)}
            onSave={() => bbsFormRef.current?.requestSubmit()}
            saveLabel="Add to BBS"
          >
            <form ref={bbsFormRef} className="grid sm:grid-cols-2 gap-3" onSubmit={addBbs}>
              <Select value={bbsForm.packageName} onChange={(e) => setBbsForm({ ...bbsForm, packageName: e.target.value })}>
                {(bbsPackages.length ? bbsPackages : summary.packages || ["Dormitory BBS"]).map((p: string) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Input placeholder="Bar mark" value={bbsForm.barMark} onChange={(e) => setBbsForm({ ...bbsForm, barMark: e.target.value })} />
              <Input placeholder="Location" value={bbsForm.location} onChange={(e) => setBbsForm({ ...bbsForm, location: e.target.value })} />
              <Input placeholder="Dia (mm)" value={bbsForm.diameterMm} onChange={(e) => setBbsForm({ ...bbsForm, diameterMm: e.target.value })} />
              <Input placeholder="Nos" value={bbsForm.nos} onChange={(e) => setBbsForm({ ...bbsForm, nos: e.target.value })} />
              <Input placeholder="Shape code" value={bbsForm.shape} onChange={(e) => setBbsForm({ ...bbsForm, shape: e.target.value })} />
            </form>
          </RegisterEntryModal>
          {(canEdit || canSiteEdit) && (
            <div className="shrink-0">
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
            </div>
          )}
          <div className="cost-page__register min-w-0">
            <BbsEntryTable
              projectId={id!}
              token={token}
              rows={bbsRows}
              singlePackage={activePkg}
              canUpload={canEdit || canSiteEdit}
              canFullEdit={canEdit}
              canSiteEdit={canSiteEdit}
              onChanged={() => void load()}
            />
          </div>
        </div>
      )}

      {tab === "budget" && (
        <div className="cost-sheet-block space-y-3">
          <details className="rounded border border-line bg-paper shrink-0">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-brand-dark">Budget WBS · upload · totals</summary>
            <div className="p-3 pt-0 space-y-3 border-t border-line">
          {canEdit && (
            <Card className="!p-4">
              <h3 className="font-semibold text-sm mb-2">Upload Budget WBS (optional)</h3>
              <p className="text-xs text-steel-muted mb-3">
                Or use <strong>Load SPDC template</strong> in the setup panel above for full{" "}
                <code className="font-mono">SPDC_Budget_Arvind 49.xls</code>.
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
            </div>
          </details>
          <div className="cost-page__register min-w-0">
          <BudgetWbsRegister
            projectId={id!}
            token={token}
            rows={summary.budget || []}
            canEdit={!!canEdit}
            onChanged={load}
          />
          </div>
        </div>
      )}

      {tab === "cashflow" && (
        <div className="cost-sheet-block space-y-4">
          <ReferenceSheetToolbar
            sheetLabel="Cashflow Dashboard"
            rowCount={cashflowRows.length}
            canEdit={canEdit}
            onUpload={async (file) => {
              const fd = new FormData();
              fd.append("file", file);
              fd.append("replace", "1");
              const res = await api<{ imported: number }>(`/api/cost/${id}/cashflow/import`, { method: "POST", token, body: fd });
              setMsg(`Cashflow imported — ${res.imported} periods`);
              await load();
            }}
            onDownloadCsv={() => downloadSheet("cashflow")}
            message={msg || undefined}
          />
          <details className="rounded border border-line bg-paper shrink-0">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-brand-dark">Cashflow charts · filters · import</summary>
            <div className="p-3 pt-0 space-y-3 border-t border-line">
          {canEdit && (
            <Card className="!p-4">
              <h3 className="font-semibold text-sm mb-2">Upload Cashflow Dashboard</h3>
              <p className="text-xs text-steel-muted mb-3">
                <code className="font-mono">Cashflow - Dashboard.xlsx</code> — Chart (INR), Forecast, Tracking sheets.
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
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["month", "Month (DPR / WPR / monthly)"],
                ["week", "Week (WPR)"],
                ["day", "Day (DPR)"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCfGrain(k)}
                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                  cfGrain === k ? "bg-brand text-white border-brand" : "bg-paper border-line text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
            </div>
          </details>
          <div className="cost-page__register min-w-0">
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
        </div>
      )}

      {tab === "rates" && (
        <div className="cost-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Rate difference register"
            rowCount={summary.rateDiffs?.length}
            onDownloadCsv={() => downloadSheet("rates")}
            message={msg || undefined}
          />
          <div className="cost-page__register min-w-0">
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
          </div>
        </div>
      )}

      {tab === "bills" && (
        <div className="cost-sheet-block space-y-4">
          <Card className="!p-4 border-brand/30 bg-brand-soft/30 shrink-0">
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
            <Card className="shrink-0">
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
          <div className="cost-page__register min-w-0">
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
        </div>
      )}

      {tab === "boq" && (
        <div className="cost-sheet-block space-y-3">
          <p className="text-xs text-steel-muted shrink-0">
            Use the <strong>Cost sheet setup</strong> panel above to load SPDC template or add structures. Import batches below.
          </p>
          <div className="cost-page__register min-w-0">
            <div className="sheet-register spdc-register-panel register-panel-fill flex flex-col w-full min-w-0">
              <div className="sheet-register__head shrink-0">
                <span>BOQ import batches</span>
                <span className="text-steel-muted font-normal normal-case tracking-normal">
                  {summary.boqBatches?.length ?? 0} batches
                </span>
              </div>
              <div className="sheet-register__scroll register-sheet-viewport register-scroll-area scrollbars-visible flex-1 min-h-0 p-4">
                <ul className="text-sm space-y-2">
                  {summary.boqBatches.map((b: any) => (
                    <li key={b.id} className="border border-line px-3 py-2 rounded-sm bg-paper">
                      <div className="font-medium">{b.fileName}</div>
                      <div className="text-xs text-steel-muted">
                        {b.rowCount} rows · {new Date(b.createdAt).toLocaleString("en-IN")}
                      </div>
                    </li>
                  ))}
                  {!summary.boqBatches.length && <li className="text-steel-muted py-6 text-center">No imports yet.</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

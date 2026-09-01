import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, FileField, FilesDropzone, Input, PageHero, Select } from "../components/ui";
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
import { downloadAuthFile } from "../lib/downloadReport";
import { costNeedsFullSync, DEFAULT_COST_MONITORING_PKG, isLikelySpdcBudgetFile } from "../lib/costWorkbook";
import { flowPackageForTab, linkedBbsPackage, mbPackageForSelection } from "../lib/spdcCostPackages";

type CostTab = "budget" | "monitoring" | "cashflow" | "rates" | "boq" | "bills" | "mb" | "bbs";
const COST_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "boq", "bills", "mb", "bbs"];
const COST_REGISTER_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "bills", "boq", "mb", "bbs"];

function SheetTable({
  title,
  headers,
  rows,
  footer,
  stickyFirst = true,
}: {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  footer?: (string | number | null | undefined)[];
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
          {footer && footer.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                {footer.map((c, j) => (
                  <td key={j} className={stickyFirst && j === 0 ? "sticky-col" : undefined}>
                    {c ?? ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
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
  const [monAddKind, setMonAddKind] = useState<"item" | "section" | "subsection">("item");
  const [cfAddOpen, setCfAddOpen] = useState(false);
  const [rateAddOpen, setRateAddOpen] = useState(false);
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
    rowKind: "data" as "data" | "item" | "description" | "subsection" | "subitem" | "note" | "total",
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
    rowKind: "data" as "data" | "section" | "subsection" | "subheader" | "note",
    barMark: "",
    location: "",
    diameterMm: "",
    nos: "1",
    nosPerMember: "",
    nosOfMember: "",
    shape: "",
    lengthMm: "",
    shapeLenA: "",
    shapeLenB: "",
    shapeLenC: "",
    shapeLenD: "",
    shapeLenE: "",
  });
  const [cfForm, setCfForm] = useState({
    sheetKind: "chart" as "chart" | "forecast" | "tracking",
    periodLabel: "",
    periodDate: "",
    structure: "",
    plannedAmount: "",
    actualAmount: "",
  });
  const [rateForm, setRateForm] = useState({
    materialType: "Steel",
    description: "",
    vendorName: "",
    qty: "",
    basicRate: "",
    purchaseRate: "",
  });
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [cfFile, setCfFile] = useState<File | null>(null);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const mbFormRef = useRef<HTMLFormElement>(null);
  const bbsFormRef = useRef<HTMLFormElement>(null);
  const cfFormRef = useRef<HTMLFormElement>(null);
  const rateFormRef = useRef<HTMLFormElement>(null);

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

  async function downloadSheet(kind: string, fmt: "csv" | "xlsx" = "csv") {
    if (!id) return;
    const q = pkgFilter !== "All" ? `?package=${encodeURIComponent(pkgFilter)}` : "";
    const slug = pkgFilter === "All" ? "all" : pkgFilter.replace(/[^\w.-]+/g, "_");
    try {
      await downloadAuthFile(`/api/cost/${id}/download/${kind}.${fmt}${q}`, token, `${kind}-${slug}.${fmt}`);
      setMsg(`Downloaded ${kind} ${fmt.toUpperCase()} — Row kind column is included. Open and check the bands.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    }
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

  const cashflowTotals = useMemo(() => {
    const planned = cashflowRows.reduce((s, r: any) => s + (Number(r.plannedAmount) || 0), 0);
    const actual = cashflowRows.reduce((s, r: any) => s + (Number(r.actualAmount) || 0), 0);
    return { planned, actual, variance: actual - planned, pct: planned > 0 ? actual / planned : 0 };
  }, [cashflowRows]);

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
        nosPerMember: Number(bbsForm.nosPerMember || 0),
        nosOfMember: Number(bbsForm.nosOfMember || 0),
        lengthMm: Number(bbsForm.lengthMm || 0),
        shapeLenA: Number(bbsForm.shapeLenA || 0),
        shapeLenB: Number(bbsForm.shapeLenB || 0),
        shapeLenC: Number(bbsForm.shapeLenC || 0),
        shapeLenD: Number(bbsForm.shapeLenD || 0),
        shapeLenE: Number(bbsForm.shapeLenE || 0),
      }),
    });
    setMsg(bbsForm.rowKind === "data" ? "BBS bar entry added" : `BBS ${bbsForm.rowKind} added`);
    setBbsAddOpen(false);
    setBbsForm((f) => ({
      ...f,
      barMark: "",
      location: "",
      diameterMm: "",
      nos: "1",
      nosPerMember: "",
      nosOfMember: "",
      shape: "",
      lengthMm: "",
      shapeLenA: "",
      shapeLenB: "",
      shapeLenC: "",
      shapeLenD: "",
      shapeLenE: "",
    }));
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
    setMsg(mbForm.rowKind === "data" ? "MB measurement added" : `MB ${mbForm.rowKind} added`);
    setMbAddOpen(false);
    await load();
  }

  async function addCashflow(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await api(`/api/cost/${id}/cashflow`, {
        method: "POST",
        token,
        body: JSON.stringify({
          sheetKind: cfForm.sheetKind,
          periodLabel: cfForm.periodLabel,
          periodDate: cfForm.periodDate || undefined,
          structure: cfForm.structure,
          plannedAmount: Number(cfForm.plannedAmount || 0),
          actualAmount: Number(cfForm.actualAmount || 0),
        }),
      });
      setMsg(`Cashflow ${cfForm.sheetKind} period added`);
      setCfAddOpen(false);
      setCfForm({
        sheetKind: cfView === "forecast" || cfView === "tracking" ? cfView : "chart",
        periodLabel: "",
        periodDate: "",
        structure: "",
        plannedAmount: "",
        actualAmount: "",
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add cashflow period failed");
    }
  }

  async function addRateDiff(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await api(`/api/cost/${id}/rate-diff`, {
        method: "POST",
        token,
        body: JSON.stringify({
          materialType: rateForm.materialType,
          description: rateForm.description,
          vendorName: rateForm.vendorName || undefined,
          qty: Number(rateForm.qty || 0),
          basicRate: Number(rateForm.basicRate || 0),
          purchaseRate: Number(rateForm.purchaseRate || 0),
        }),
      });
      setMsg("Rate difference line added");
      setRateAddOpen(false);
      setRateForm({
        materialType: "Steel",
        description: "",
        vendorName: "",
        qty: "",
        basicRate: "",
        purchaseRate: "",
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add rate line failed");
    }
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
            <div className="min-w-[240px] flex-1 sm:flex-none">
              <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-1">Upload BOQ</p>
              <FileField
                compact
                label="Browse"
                accept=".xls,.xlsx,.csv"
                file={null}
                onChange={(f) => {
                  if (f && !syncing) void uploadBoqOrWorkbook(f, activePkg);
                }}
                hint={syncing ? "Importing…" : "SPDC workbook or package BOQ"}
              />
            </div>
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
            addKinds={
              canEdit
                ? [
                    { key: "section", label: "+ Section" },
                    { key: "subsection", label: "+ Subsection" },
                    { key: "item", label: "+ Item" },
                  ]
                : undefined
            }
            onAddKind={
              canEdit
                ? (key) => {
                    setMonAddKind(key as "item" | "section" | "subsection");
                    setMonAddOpen(true);
                  }
                : undefined
            }
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
            onDownloadCsv={() => void downloadSheet("boq")}
            onDownloadXlsx={() => void downloadSheet("boq", "xlsx")}
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
              preferredAddKind={monAddKind}
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
            addKinds={
              canEdit || canSiteEdit
                ? [
                    { key: "item", label: "+ Item" },
                    { key: "description", label: "+ Description" },
                    { key: "subsection", label: "+ Subsection" },
                    { key: "subitem", label: "+ Sub-item" },
                    { key: "data", label: "+ Measurement" },
                    { key: "note", label: "+ Note" },
                    { key: "total", label: "+ Total" },
                  ]
                : undefined
            }
            onAddKind={
              canEdit || canSiteEdit
                ? (key) => {
                    setMbForm((f) => ({ ...f, rowKind: key as typeof f.rowKind }));
                    setMbAddOpen(true);
                  }
                : undefined
            }
            onDownloadCsv={() => void downloadSheet("mb")}
            onDownloadXlsx={() => void downloadSheet("mb", "xlsx")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={mbAddOpen && (canEdit || canSiteEdit)}
            title={
              mbForm.rowKind === "data"
                ? "Add MB measurement"
                : `Add MB ${mbForm.rowKind}`
            }
            onClose={() => setMbAddOpen(false)}
            onSave={() => mbFormRef.current?.requestSubmit()}
            saveLabel={mbForm.rowKind === "data" ? "Add measurement" : `Add ${mbForm.rowKind}`}
          >
            <form ref={mbFormRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMb}>
              <Select value={mbForm.packageName} onChange={(e) => setMbForm({ ...mbForm, packageName: e.target.value })}>
                {(summary.packages || ["Dormitory Civil", "Electric", "Plumbing", "UGWT"]).map((p: string) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Select
                value={mbForm.rowKind}
                onChange={(e) => setMbForm({ ...mbForm, rowKind: e.target.value as typeof mbForm.rowKind })}
              >
                <option value="data">Measurement (qty line)</option>
                <option value="item">Item heading</option>
                <option value="description">Description band</option>
                <option value="subsection">Subsection</option>
                <option value="subitem">Sub-item (-do)</option>
                <option value="note">Note</option>
                <option value="total">Total band</option>
              </Select>
              <Input placeholder="Sr" value={mbForm.srNo} onChange={(e) => setMbForm({ ...mbForm, srNo: e.target.value })} />
              <Input
                className="sm:col-span-2"
                placeholder={mbForm.rowKind === "data" ? "Description" : "Heading / note text"}
                value={mbForm.description}
                onChange={(e) => setMbForm({ ...mbForm, description: e.target.value })}
                required
              />
              {mbForm.rowKind === "data" && (
                <>
                  <Input placeholder="Nos" value={mbForm.nos1} onChange={(e) => setMbForm({ ...mbForm, nos1: e.target.value })} />
                  <Input placeholder="Length" value={mbForm.length} onChange={(e) => setMbForm({ ...mbForm, length: e.target.value })} />
                  <Input placeholder="Width" value={mbForm.width} onChange={(e) => setMbForm({ ...mbForm, width: e.target.value })} />
                  <Input placeholder="Height" value={mbForm.height} onChange={(e) => setMbForm({ ...mbForm, height: e.target.value })} />
                </>
              )}
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
            addKinds={
              canEdit || canSiteEdit
                ? [
                    { key: "section", label: "+ Section" },
                    { key: "subsection", label: "+ Subsection" },
                    { key: "subheader", label: "+ Subheader" },
                    { key: "data", label: "+ Bar" },
                    { key: "note", label: "+ Note" },
                  ]
                : undefined
            }
            onAddKind={
              canEdit || canSiteEdit
                ? (key) => {
                    setBbsForm((f) => ({ ...f, rowKind: key as typeof f.rowKind }));
                    setBbsAddOpen(true);
                  }
                : undefined
            }
            onDownloadCsv={() => void downloadSheet("bbs")}
            onDownloadXlsx={() => void downloadSheet("bbs", "xlsx")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={bbsAddOpen && (canEdit || canSiteEdit)}
            title={
              bbsForm.rowKind === "section"
                ? "Add BBS section"
                : bbsForm.rowKind === "subsection"
                  ? "Add BBS subsection"
                  : bbsForm.rowKind === "subheader"
                    ? "Add BBS subheader"
                    : bbsForm.rowKind === "note"
                      ? "Add BBS note"
                      : "Add BBS bar entry"
            }
            onClose={() => setBbsAddOpen(false)}
            onSave={() => bbsFormRef.current?.requestSubmit()}
            saveLabel={bbsForm.rowKind === "data" ? "Add bar entry" : `Add ${bbsForm.rowKind}`}
            size="2xl"
          >
            <form ref={bbsFormRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addBbs}>
              <Select value={bbsForm.packageName} onChange={(e) => setBbsForm({ ...bbsForm, packageName: e.target.value })}>
                {(bbsPackages.length ? bbsPackages : summary.packages || ["Dormitory BBS"]).map((p: string) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Select
                value={bbsForm.rowKind}
                onChange={(e) => setBbsForm({ ...bbsForm, rowKind: e.target.value as typeof bbsForm.rowKind })}
              >
                <option value="data">Bar entry</option>
                <option value="section">Section heading</option>
                <option value="subsection">Subsection heading</option>
                <option value="subheader">Subheader (L/B/H)</option>
                <option value="note">Note</option>
              </Select>
              <Input
                placeholder={bbsForm.rowKind === "data" ? "Sr / bar mark" : "Mark (A, 1, …)"}
                value={bbsForm.barMark}
                onChange={(e) => setBbsForm({ ...bbsForm, barMark: e.target.value })}
              />
              <Input
                className="sm:col-span-2 lg:col-span-1"
                placeholder={bbsForm.rowKind === "data" ? "Location / description" : "Section / subsection name"}
                value={bbsForm.location}
                onChange={(e) => setBbsForm({ ...bbsForm, location: e.target.value })}
                required={bbsForm.rowKind !== "data"}
              />
              {bbsForm.rowKind === "data" && (
                <>
                  <Input placeholder="Dia (mm)" value={bbsForm.diameterMm} onChange={(e) => setBbsForm({ ...bbsForm, diameterMm: e.target.value })} />
                  <Input placeholder="No per member" value={bbsForm.nosPerMember} onChange={(e) => setBbsForm({ ...bbsForm, nosPerMember: e.target.value })} />
                  <Input placeholder="No of member" value={bbsForm.nosOfMember} onChange={(e) => setBbsForm({ ...bbsForm, nosOfMember: e.target.value })} />
                  <Input placeholder="Total nos" value={bbsForm.nos} onChange={(e) => setBbsForm({ ...bbsForm, nos: e.target.value })} />
                  <Input placeholder="Shape A" value={bbsForm.shapeLenA} onChange={(e) => setBbsForm({ ...bbsForm, shapeLenA: e.target.value })} />
                  <Input placeholder="Shape B" value={bbsForm.shapeLenB} onChange={(e) => setBbsForm({ ...bbsForm, shapeLenB: e.target.value })} />
                  <Input placeholder="Shape C" value={bbsForm.shapeLenC} onChange={(e) => setBbsForm({ ...bbsForm, shapeLenC: e.target.value })} />
                  <Input placeholder="Shape D" value={bbsForm.shapeLenD} onChange={(e) => setBbsForm({ ...bbsForm, shapeLenD: e.target.value })} />
                  <Input placeholder="Shape E" value={bbsForm.shapeLenE} onChange={(e) => setBbsForm({ ...bbsForm, shapeLenE: e.target.value })} />
                  <Input placeholder="Cutting length (m)" value={bbsForm.lengthMm} onChange={(e) => setBbsForm({ ...bbsForm, lengthMm: e.target.value })} />
                  <Input placeholder="Shape code" value={bbsForm.shape} onChange={(e) => setBbsForm({ ...bbsForm, shape: e.target.value })} />
                </>
              )}
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
          <ReferenceSheetToolbar
            sheetLabel="Budget WBS"
            rowCount={summary.budget?.length}
            canEdit={canEdit}
            onDownloadCsv={() => void downloadSheet("budget")}
            onDownloadXlsx={() => void downloadSheet("budget", "xlsx")}
            message={msg || undefined}
          />
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
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!budgetFile) return;
                  const fd = new FormData();
                  fd.append("file", budgetFile);
                  fd.append("replace", "1");
                  await api(`/api/cost/${id}/budget/import`, { method: "POST", token, body: fd });
                  setBudgetFile(null);
                  setMsg("Budget WBS imported");
                  await load();
                }}
              >
                <FileField
                  file={budgetFile}
                  onChange={setBudgetFile}
                  accept=".xlsx,.xls"
                  label="Browse spreadsheet"
                  hint="Budget WBS · XLSX or XLS"
                />
                <Button type="submit" disabled={!budgetFile} className="w-full sm:w-auto">
                  Import budget sheet
                </Button>
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
            addKinds={
              canEdit
                ? [
                    { key: "chart", label: "+ Chart period" },
                    { key: "forecast", label: "+ Forecast" },
                    { key: "tracking", label: "+ Tracking" },
                  ]
                : undefined
            }
            onAddKind={
              canEdit
                ? (key) => {
                    setCfForm((f) => ({
                      ...f,
                      sheetKind: key as typeof f.sheetKind,
                    }));
                    setCfAddOpen(true);
                  }
                : undefined
            }
            onDownloadCsv={() => void downloadSheet("cashflow")}
            onDownloadXlsx={() => void downloadSheet("cashflow", "xlsx")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={cfAddOpen && canEdit}
            title={
              cfForm.sheetKind === "forecast"
                ? "Add forecast period"
                : cfForm.sheetKind === "tracking"
                  ? "Add tracking period"
                  : "Add cashflow chart period"
            }
            onClose={() => setCfAddOpen(false)}
            onSave={() => cfFormRef.current?.requestSubmit()}
            saveLabel="Add period"
          >
            <form ref={cfFormRef} className="grid sm:grid-cols-2 gap-3" onSubmit={addCashflow}>
              <Select
                value={cfForm.sheetKind}
                onChange={(e) => setCfForm({ ...cfForm, sheetKind: e.target.value as typeof cfForm.sheetKind })}
              >
                <option value="chart">Cash Flow Chart</option>
                <option value="forecast">Forecast</option>
                <option value="tracking">Tracking</option>
              </Select>
              <Input
                required
                placeholder="Period (e.g. Apr-26)"
                value={cfForm.periodLabel}
                onChange={(e) => setCfForm({ ...cfForm, periodLabel: e.target.value })}
              />
              <Input
                type="date"
                value={cfForm.periodDate}
                onChange={(e) => setCfForm({ ...cfForm, periodDate: e.target.value })}
              />
              {(cfForm.sheetKind === "forecast" || cfForm.sheetKind === "tracking") && (
                <Input
                  placeholder={cfForm.sheetKind === "forecast" ? "Structure" : "Work package"}
                  value={cfForm.structure}
                  onChange={(e) => setCfForm({ ...cfForm, structure: e.target.value })}
                />
              )}
              <Input
                type="number"
                step="any"
                placeholder="Planned ₹"
                value={cfForm.plannedAmount}
                onChange={(e) => setCfForm({ ...cfForm, plannedAmount: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="Actual ₹"
                value={cfForm.actualAmount}
                onChange={(e) => setCfForm({ ...cfForm, actualAmount: e.target.value })}
              />
            </form>
          </RegisterEntryModal>
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
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!cfFile) return;
                  const fd = new FormData();
                  fd.append("file", cfFile);
                  fd.append("replace", "1");
                  const res = await api<{ imported: number }>(`/api/cost/${id}/cashflow/import`, {
                    method: "POST",
                    token,
                    body: fd,
                  });
                  setCfFile(null);
                  setMsg(`Cashflow imported — ${res.imported} periods`);
                  await load();
                }}
              >
                <FileField
                  file={cfFile}
                  onChange={setCfFile}
                  accept=".xlsx,.xls"
                  label="Browse spreadsheet"
                  hint="Cashflow Dashboard · Chart, Forecast, Tracking"
                />
                <Button type="submit" disabled={!cfFile} className="w-full sm:w-auto">
                  Import cashflow dashboard
                </Button>
              </form>
            </Card>
          )}
          <div className="rounded-sm border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm space-y-1">
            <div>
              <strong>Budget ↔ Cashflow chart:</strong> Budget WBS ({formatINR(summary.totals.budgeted)}) · Cashflow Chart planned (
              {formatINR(summary.totals.planned)}) · Budget certified ({formatINR(summary.totals.certified)}). Progress Planned vs Actual cashflow (RA months) lives under Progress — use Sync cashflow to overlay it here without mixing BOQ qty.
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
            headers={["Period", "Package / sheet", "Planned", "Actual", "Variance", "Progress"]}
            rows={cashflowRows.map((b: any) => {
              const planned = Number(b.plannedAmount) || 0;
              const actual = Number(b.actualAmount) || 0;
              const progress = planned > 0 ? actual / planned : Number(b.progressPct) || 0;
              return [
                b.periodLabel,
                b.packageName,
                formatINR(planned),
                formatINR(actual),
                formatINR(actual - planned),
                `${Math.round(progress * 100)}%`,
              ];
            })}
            footer={
              cashflowRows.length
                ? [
                    "TOTAL",
                    `${cashflowRows.length} periods`,
                    formatINR(cashflowTotals.planned),
                    formatINR(cashflowTotals.actual),
                    formatINR(cashflowTotals.variance),
                    `${Math.round(cashflowTotals.pct * 100)}%`,
                  ]
                : undefined
            }
          />
          </div>
        </div>
      )}

      {tab === "rates" && (
        <div className="cost-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Rate difference register"
            rowCount={summary.rateDiffs?.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => setRateAddOpen(true) : undefined}
            onDownloadCsv={() => void downloadSheet("rates")}
            onDownloadXlsx={() => void downloadSheet("rates", "xlsx")}
            message={msg || undefined}
          />
          <RegisterEntryModal
            open={rateAddOpen && canEdit}
            title="Add rate difference"
            onClose={() => setRateAddOpen(false)}
            onSave={() => rateFormRef.current?.requestSubmit()}
            saveLabel="Add rate line"
          >
            <form ref={rateFormRef} className="grid sm:grid-cols-2 gap-3" onSubmit={addRateDiff}>
              <Select
                value={rateForm.materialType}
                onChange={(e) => setRateForm({ ...rateForm, materialType: e.target.value })}
              >
                <option>Steel</option>
                <option>Cement</option>
                <option>Tiles</option>
              </Select>
              <Input
                required
                placeholder="Description *"
                value={rateForm.description}
                onChange={(e) => setRateForm({ ...rateForm, description: e.target.value })}
              />
              <Input
                placeholder="Vendor"
                value={rateForm.vendorName}
                onChange={(e) => setRateForm({ ...rateForm, vendorName: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="Qty"
                value={rateForm.qty}
                onChange={(e) => setRateForm({ ...rateForm, qty: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="Basic rate"
                value={rateForm.basicRate}
                onChange={(e) => setRateForm({ ...rateForm, basicRate: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="Purchase rate"
                value={rateForm.purchaseRate}
                onChange={(e) => setRateForm({ ...rateForm, purchaseRate: e.target.value })}
              />
            </form>
          </RegisterEntryModal>
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
              <h3 className="font-semibold text-sm mb-1">Upload contractor invoices (drive-first)</h3>
              <p className="text-xs text-steel-muted mb-2">
                Drop invoice PDFs / photos — each becomes a Vendor Bill record with the file saved on SharePoint (09.02
                Contractor Invoices).  PMC picks them up while raising the RA bill so nothing gets re-typed.
              </p>
              <form
                className="space-y-3 mb-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!invoiceFiles.length) return;
                  const fd = new FormData();
                  if (billForm.vendorId) fd.append("vendorId", billForm.vendorId);
                  const party = parties.find((p) => p.id === billForm.vendorId);
                  if (party?.name) fd.append("vendorName", party.name);
                  for (const f of invoiceFiles) fd.append("files", f);
                  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/cost/${id}/bills/upload`, {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: fd,
                  });
                  const out = await res.json();
                  if (!res.ok) {
                    alert(out?.error || "Invoice upload failed");
                    return;
                  }
                  setInvoiceFiles([]);
                  await loadBills();
                }}
              >
                <Select
                  value={billForm.vendorId}
                  onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                  className="max-w-md"
                >
                  <option value="">Select contractor / vendor (optional)</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.partyType ? `· ${p.partyType}` : ""}
                    </option>
                  ))}
                </Select>
                <FilesDropzone
                  files={invoiceFiles}
                  onChange={setInvoiceFiles}
                  accept=".pdf,image/*,.xlsx,.xls,.docx,.doc"
                  label="Browse invoices"
                  hint="PDF · photos · Excel · Word — saved to 09.02 Contractor Invoices"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!invoiceFiles.length}>
                    Upload invoices
                  </Button>
                  <span className="text-[11px] text-steel-muted">
                    Files → 09_COMMERCIAL_AND_CHANGE / 09.02 Contractor Invoices
                  </span>
                </div>
              </form>
              <h3 className="font-semibold mb-2">Manual vendor / contractor bill entry · COP</h3>
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

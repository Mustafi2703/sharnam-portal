import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { formatQty } from "../../components/BoqMonitoringEditor";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { downloadAuthFile } from "../../lib/downloadReport";
import { BarChart, PieChart } from "../../components/PieChart";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { RegisterEmptyRow } from "../../components/RegisterSheetFrame";
import { RegisterSheetCell } from "../../components/RegisterSheetCell";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { DailySheetWorkflow } from "../../components/DailySheetWorkflow";

type Tab =
  | "overview"
  | "milestones"
  | "planned"
  | "monthly"
  | "hindrance"
  | "risk"
  | "legal"
  | "lessons"
  | "scurve"
  | "msproject";

const PROGRESS_REGISTER_TABS: Tab[] = ["planned", "hindrance", "risk", "legal", "milestones", "monthly", "lessons", "msproject"];

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isoDay(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

export default function ProgressPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [verify, setVerify] = useState<any>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resyncBusy, setResyncBusy] = useState(false);
  const [registerSyncBusy, setRegisterSyncBusy] = useState(false);
  const [paBusy, setPaBusy] = useState<"import" | "xlsx" | "pdf" | "sync" | "boq" | null>(null);
  const paImportRef = useRef<HTMLInputElement>(null);
  const [msProject, setMsProject] = useState<any>(null);
  const [msBusy, setMsBusy] = useState<"seed" | "import" | "xml" | null>(null);
  const msImportRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [hindranceModalOpen, setHindranceModalOpen] = useState(false);
  const [mileAddOpen, setMileAddOpen] = useState(false);
  const [riskAddOpen, setRiskAddOpen] = useState(false);
  const [legalAddOpen, setLegalAddOpen] = useState(false);
  const [actAddOpen, setActAddOpen] = useState(false);
  const [cashAddOpen, setCashAddOpen] = useState(false);
  const [manAddOpen, setManAddOpen] = useState(false);
  const [lessonAddOpen, setLessonAddOpen] = useState(false);
  const [actBusy, setActBusy] = useState(false);
  const [actForm, setActForm] = useState({
    activity: "",
    tower: "",
    unit: "Cum",
    boqQty: "",
    gfcQty: "",
    executedQty: "",
    weeklyPlanned: "",
    weeklyActual: "",
  });
  const [cashForm, setCashForm] = useState({ periodLabel: "", packageName: "", plannedAmount: "", actualAmount: "" });
  const [manForm, setManForm] = useState({ trade: "", required: "", available: "" });
  const [lessonForm, setLessonForm] = useState({ description: "", wentWell: "", notMetExpectation: "", lessonsLearnt: "" });
  const mileFormRef = useRef<HTMLFormElement>(null);
  const riskFormRef = useRef<HTMLFormElement>(null);
  const legalFormRef = useRef<HTMLFormElement>(null);
  const tab = (searchParams.get("tab") as Tab) || "overview";
  const isProgressRegister = PROGRESS_REGISTER_TABS.includes(tab);
  const pva = (searchParams.get("pva") as "all" | "cashflow" | "manpower" | "activity") || "all";
  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";
  const canVerify = user?.role === "admin" || user?.role === "office" || user?.role === "employee";
  const canResyncExcel =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

  const [hindranceForm, setHindranceForm] = useState({
    description: "",
    location: "",
    activity: "",
    category: "Design & Technical",
    type: "",
    occurredAt: "",
    daysImpacted: "",
    delayType: "Overlapping Delay",
    accountable: "",
    status: "Open",
  });
  const [riskForm, setRiskForm] = useState({
    code: "",
    name: "",
    category: "Execution",
    opportunityThreat: "Threat",
    probability: "3",
    consequence: "3",
    costImpact: "",
    description: "",
  });
  const [mileForm, setMileForm] = useState({
    code: "",
    category: "",
    activity: "",
    plannedStart: "",
    plannedEnd: "",
    plannedDays: "",
    actualDays: "",
    weightage: "",
    pctComplete: "",
    status: "In Progress",
  });
  const [legalForm, setLegalForm] = useState({
    approvalId: "",
    category: "Labour Compliance",
    authority: "",
    description: "",
    packageName: "",
    status: "Submitted",
    responsible: "Contractor",
  });

  const load = () => api(`/api/progress/${id}/summary`, { token }).then(setData);

  const loadMsProject = () => api(`/api/progress/${id}/ms-project/summary`, { token }).then(setMsProject);

  async function runVerify() {
    if (!canVerify) return;
    setVerifyBusy(true);
    try {
      const report = await api(`/api/progress/${id}/verify`, { token });
      setVerify(report);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function runResyncSor() {
    if (!canResyncExcel || !id) return;
    setResyncBusy(true);
    setMsg("");
    try {
      const out = await api<{ imported: number; verify: typeof verify }>(`/api/progress/${id}/resync-sor`, {
        method: "POST",
        token,
      });
      setVerify(out.verify);
      await load();
      setMsg(`Monthly SOR re-synced from Excel (${out.imported} rows).`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SOR resync failed");
    } finally {
      setResyncBusy(false);
    }
  }

  const sorCheckFailed = verify?.checks?.some((c: { key: string; ok: boolean }) => c.key === "count.sor" && !c.ok);

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    if (canVerify && tab === "overview") void runVerify();
  }, [id, token, canVerify, tab]);

  useEffect(() => {
    if (tab === "scurve" || tab === "msproject") void loadMsProject();
  }, [id, token, tab]);

  if (!data) return <div className="text-steel-muted py-10">Loading progress sheets…</div>;

  const pvaCashflowRows = (data.plannedActual || []).filter(
    (p: { packageName?: string }) => p.packageName !== "MS Project S-curve"
  );

  async function addHindrance(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/hindrances`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...hindranceForm,
        daysImpacted: Number(hindranceForm.daysImpacted || 0),
        occurredAt: hindranceForm.occurredAt || undefined,
      }),
    });
    setHindranceForm({
      description: "",
      location: "",
      activity: "",
      category: "Design & Technical",
      type: "",
      occurredAt: "",
      daysImpacted: "",
      delayType: "Overlapping Delay",
      accountable: "",
      status: "Open",
    });
    setMsg("Hindrance logged");
    setHindranceModalOpen(false);
    await load();
  }

  async function addRisk(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/risks`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...riskForm,
        probability: Number(riskForm.probability),
        consequence: Number(riskForm.consequence),
        costImpact: Number(riskForm.costImpact || 0),
      }),
    });
    setRiskForm({
      code: "",
      name: "",
      category: "Execution",
      opportunityThreat: "Threat",
      probability: "3",
      consequence: "3",
      costImpact: "",
      description: "",
    });
    setMsg("Risk added");
    setRiskAddOpen(false);
    await load();
  }

  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/milestones`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...mileForm,
        plannedDays: Number(mileForm.plannedDays || 0),
        actualDays: Number(mileForm.actualDays || 0),
        weightage: Number(mileForm.weightage || 0),
        pctComplete: Number(mileForm.pctComplete || 0) > 1 ? Number(mileForm.pctComplete) / 100 : Number(mileForm.pctComplete || 0),
      }),
    });
    setMileForm({
      code: "",
      category: "",
      activity: "",
      plannedStart: "",
      plannedEnd: "",
      plannedDays: "",
      actualDays: "",
      weightage: "",
      pctComplete: "",
      status: "In Progress",
    });
    setMsg("Milestone added");
    setMileAddOpen(false);
    await load();
  }

  async function importPlannedActual(file: File) {
    if (!id) return;
    setPaBusy("import");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ cashflow: number; manpower: number; activityLines: number }>(
        `/api/progress/${id}/planned-actual/import`,
        { method: "POST", token, body: fd }
      );
      setMsg(
        `Planned vs Actual imported — ${out.activityLines} activities · ${out.cashflow} cashflow rows · ${out.manpower} manpower trades`
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function loadProgressTemplate() {
    if (!id) return;
    setPaBusy("sync");
    setMsg("");
    try {
      const out = await api<{ activityLines: number; cashflow: number; manpower: number; registers?: any }>(
        `/api/progress/${id}/planned-actual/sync-template`,
        { method: "POST", token, body: JSON.stringify({ force: true }) }
      );
      setMsg(
        `Loaded Planned Vs. Actual format — ${out.activityLines} activities · ${out.cashflow} cashflow · ${out.manpower} trades (feeds DPR qty hints)`
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Template load failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function addActivityLine() {
    if (!id || !actForm.activity.trim()) return;
    setActBusy(true);
    try {
      await api(`/api/progress/${id}/activity-lines`, {
        method: "POST",
        token,
        body: JSON.stringify({
          activity: actForm.activity,
          tower: actForm.tower || null,
          unit: actForm.unit,
          boqQty: Number(actForm.boqQty || 0),
          gfcQty: Number(actForm.gfcQty || 0),
          executedQty: Number(actForm.executedQty || 0),
          weeklyPlanned: Number(actForm.weeklyPlanned || 0),
          weeklyActual: Number(actForm.weeklyActual || 0),
        }),
      });
      setActForm({
        activity: "",
        tower: "",
        unit: "Cum",
        boqQty: "",
        gfcQty: "",
        executedQty: "",
        weeklyPlanned: "",
        weeklyActual: "",
      });
      setActAddOpen(false);
      setMsg("Activity line added — DPR Maker will match it to BOQ descriptions");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Add activity failed");
    } finally {
      setActBusy(false);
    }
  }

  async function patchActivity(lineId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/activity-lines/${lineId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchMilestone(milestoneId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/milestones/${milestoneId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchHindrance(hindranceId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/hindrances/${hindranceId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchRisk(riskId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/risks/${riskId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchLegal(legalId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/legal/${legalId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchManpower(manpowerId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/manpower/${manpowerId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function patchPlannedActual(rowId: string, patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await api(`/api/progress/${id}/planned-actual/${rowId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function loadAllProgressTemplates(force = false) {
    if (!id || !canResyncExcel) return;
    setRegisterSyncBusy(true);
    setMsg("");
    try {
      const out = await api<{ registers?: any; planned?: any; verify?: typeof verify }>(
        `/api/progress/${id}/resync-registers`,
        { method: "POST", token, body: JSON.stringify({ force }) }
      );
      if (out.verify) setVerify(out.verify);
      await load();
      const reg = out.registers;
      setMsg(
        `Loaded SPDC progress packs — ${reg?.milestones?.imported ?? 0} milestones · ${reg?.hindrance?.imported ?? 0} hindrances · ${reg?.risk?.imported ?? 0} risks · ${reg?.legal?.imported ?? 0} legal · ${out.planned?.activityLines ?? 0} activity lines`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Template load failed");
    } finally {
      setRegisterSyncBusy(false);
    }
  }

  async function syncActivityFromBoq() {
    if (!id) return;
    setPaBusy("boq");
    setMsg("");
    try {
      const out = await api<{ created: number; updated: number; total: number }>(
        `/api/progress/${id}/activity-lines/sync-from-boq`,
        { method: "POST", token }
      );
      setMsg(`BOQ synced to Planned vs Actual — ${out.created} new · ${out.updated} updated · ${out.total} BOQ lines`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "BOQ sync failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function syncPvaCashflowToCost() {
    if (!id) return;
    setPaBusy("sync");
    setMsg("");
    try {
      const out = await api<{ synced: number; overlaid: number }>(
        `/api/progress/${id}/planned-actual/sync-cashflow`,
        { method: "POST", token }
      );
      setMsg(
        `Cashflow synced to Cost — ${out.synced} PVA period(s)${out.overlaid ? ` · ${out.overlaid} chart row(s) overlaid` : ""}. WPR will pick these up on next pack sync.`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function downloadPlannedActual(fmt: "xlsx" | "pdf") {
    if (!id) return;
    setPaBusy(fmt);
    setMsg("");
    try {
      if (fmt === "xlsx") {
        await downloadAuthFile(`/api/progress/${id}/planned-actual/download.xlsx`, token, `Planned-Vs-Actual.xlsx`);
        setMsg("Planned vs Actual Excel downloaded — matches client dashboard layout.");
      } else {
        await downloadAuthFile(`/api/progress/${id}/planned-actual/download.html`, token, `Planned-Vs-Actual.html`);
        setMsg("Dashboard HTML downloaded — open and Print → Save as PDF.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function importMsProject(file: File) {
    if (!id || !canEdit) return;
    setMsBusy("import");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ taskCount: number; scurvePoints: number }>(
        `/api/progress/${id}/ms-project/import`,
        { method: "POST", token, body: fd }
      );
      setMsg(`MS Project imported — ${out.taskCount} tasks · ${out.scurvePoints} S-curve points`);
      await Promise.all([load(), loadMsProject()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "MS Project import failed");
    } finally {
      setMsBusy(null);
    }
  }

  async function seedDemoSchedule() {
    if (!id || !canEdit) return;
    setMsBusy("seed");
    setMsg("");
    try {
      const out = await api<{ taskCount: number; scurvePoints: number }>(
        `/api/progress/${id}/ms-project/seed-demo`,
        { method: "POST", token }
      );
      setMsg(`Demo schedule loaded — ${out.taskCount} tasks · ${out.scurvePoints} S-curve weeks (feeds DPR + WPR).`);
      await Promise.all([load(), loadMsProject()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Demo schedule load failed");
    } finally {
      setMsBusy(null);
    }
  }

  async function downloadMsProjectXml() {
    if (!id) return;
    setMsBusy("xml");
    try {
      await downloadAuthFile(`/api/progress/${id}/ms-project/download.xml`, token, `MS-Project-Schedule.xml`);
      setMsg("MS Project XML downloaded — open in Microsoft Project or re-import after edits.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setMsBusy(null);
    }
  }

  async function addLegal(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/legal`, { method: "POST", token, body: JSON.stringify(legalForm) });
    setLegalForm({
      approvalId: "",
      category: "Labour Compliance",
      authority: "",
      description: "",
      packageName: "",
      status: "Submitted",
      responsible: "Contractor",
    });
    setMsg("Legal approval row added");
    setLegalAddOpen(false);
    await load();
  }

  async function addCashflow(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActBusy(true);
    try {
      await api(`/api/progress/${id}/planned-actual`, {
        method: "POST",
        token,
        body: JSON.stringify({
          periodLabel: cashForm.periodLabel,
          packageName: cashForm.packageName || "Overall",
          plannedAmount: Number(cashForm.plannedAmount || 0),
          actualAmount: Number(cashForm.actualAmount || 0),
        }),
      });
      setCashForm({ periodLabel: "", packageName: "", plannedAmount: "", actualAmount: "" });
      setCashAddOpen(false);
      setMsg("Cashflow month added — sync to Cost to feed WPR");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    } finally {
      setActBusy(false);
    }
  }

  async function addManpowerRow(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActBusy(true);
    try {
      await api(`/api/progress/${id}/manpower`, {
        method: "POST",
        token,
        body: JSON.stringify({
          trade: manForm.trade,
          required: Number(manForm.required || 0),
          available: Number(manForm.available || 0),
        }),
      });
      setManForm({ trade: "", required: "", available: "" });
      setManAddOpen(false);
      setMsg("Manpower trade added");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    } finally {
      setActBusy(false);
    }
  }

  async function addLesson(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActBusy(true);
    try {
      await api(`/api/closure/project/${id}/lessons`, {
        method: "POST",
        token,
        body: JSON.stringify(lessonForm),
      });
      setLessonForm({ description: "", wentWell: "", notMetExpectation: "", lessonsLearnt: "" });
      setLessonAddOpen(false);
      setMsg("Lesson learnt added");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    } finally {
      setActBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-4">
      <div className="w-full shrink-0">
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Progress module"
          title="Progress"
          subtitle={
            isProgressRegister
              ? undefined
              : "Workday-style KPIs on Overview. Switch sub-tools using the module tabs above."
          }
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Badge tone="brand">
                {data.overviewSheet?.sheetProgressPct != null
                  ? `${Math.round(Number(data.overviewSheet.sheetProgressPct) * 1000) / 10}% sheet`
                  : pct(data.totals.projectProgressPct)}
              </Badge>
              <ReportExportButtons projectId={id} kind="progress" compact />
              {canVerify && (
                <Button type="button" variant="secondary" disabled={verifyBusy} onClick={() => void runVerify()}>
                  {verifyBusy ? "Verifying…" : "Verify vs Excel"}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {!isProgressRegister && id && (
        <div className="shrink-0">
          <DailySheetWorkflow projectId={id} compact />
        </div>
      )}

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm shrink-0">{msg}</p>}

      {verify && (!isProgressRegister || !verify.ok) && (
        <details
          className={`shrink-0 rounded-lg border bg-paper ${verify.ok ? "border-ok/40" : "border-danger/40"} ${
            isProgressRegister ? "" : "open"
          }`}
          open={!isProgressRegister || !verify.ok}
        >
          <summary className="cursor-pointer px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-steel-muted">Backend vs Excel packs</div>
              <div className="font-semibold text-sm mt-0.5">
                {verify.ok ? "Progress data matches Excel" : "Mismatches found — expand to review"}
              </div>
            </div>
            <Badge tone={verify.ok ? "ok" : "danger"}>
              {verify.summary.passed}/{verify.summary.total} passed
            </Badge>
          </summary>
          <div className="px-4 pb-4 border-t border-line/60">
            {verify.msProjectOverlay &&
            (verify.msProjectOverlay.milestones > 0 ||
              verify.msProjectOverlay.plannedActual > 0 ||
              verify.msProjectOverlay.activityLines > 0) ? (
              <p className="text-xs text-steel-muted mt-2 mb-2">
                MS Project overlay excluded: {verify.msProjectOverlay.milestones} milestones ·{" "}
                {verify.msProjectOverlay.plannedActual} S-curve months · {verify.msProjectOverlay.activityLines} schedule
                lines
              </p>
            ) : null}
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-steel-muted border-b border-line">
                    <th className="py-2 pr-3">Check</th>
                    <th className="py-2 pr-3">Expected (Excel)</th>
                    <th className="py-2 pr-3">Actual (DB)</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {verify.checks.map((c: any) => (
                    <tr key={c.key} className="border-b border-line/60">
                      <td className="py-1.5 pr-3">{c.label}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{String(c.expected)}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{String(c.actual)}</td>
                      <td className="py-1.5">
                        <Badge tone={c.ok ? "ok" : "danger"}>{c.ok ? "OK" : "Fail"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canResyncExcel && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                {sorCheckFailed ? (
                  <p className="text-xs text-danger flex-1 min-w-[12rem]">
                    Monthly SOR count differs from Excel — duplicate rows from an older seed. Resync replaces them with
                    the 3 summary rows from the Monthly Progress Dashboard pack.
                  </p>
                ) : (
                  <p className="text-xs text-steel-muted flex-1 min-w-[12rem]">
                    Re-import Monthly SOR summary from the client Excel pack (admin/office).
                  </p>
                )}
                <Button
                  type="button"
                  variant={sorCheckFailed ? "primary" : "secondary"}
                  disabled={resyncBusy || verifyBusy}
                  onClick={() => void runResyncSor()}
                >
                  {resyncBusy ? "Resyncing…" : "Resync SOR from Excel"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={registerSyncBusy || verifyBusy}
                  onClick={() => void loadAllProgressTemplates(true)}
                >
                  {registerSyncBusy ? "Loading…" : "Resync all progress registers"}
                </Button>
              </div>
            )}
          </div>
        </details>
      )}

      {!isProgressRegister && (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 w-full shrink-0">
        {[
          ["Milestones", data.totals.milestones],
          ["Delayed", data.totals.delayed],
          ["Open hindrance", data.totals.openHindrance],
          ["Open risks", data.totals.openRisk],
          ["Legal approved", `${data.totals.legalApproved}/${data.totals.legal}`],
        ].map(([label, val]) => (
          <Card key={label as string} className="!p-4">
            <div className="text-[10px] uppercase tracking-wider text-steel-muted">{label}</div>
            <div className="text-2xl font-display mt-1">{val as string | number}</div>
          </Card>
        ))}
      </div>
      )}

      {tab === "overview" && (
        <div className="space-y-4 w-full">
          <div className="rounded-sm border border-line bg-paper p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ok">Workday overview</p>
                <h3 className="font-display text-lg text-ink">
                  {data.overviewSheet?.title || "Key registers at a glance"}
                </h3>
                {data.overviewSheet && (
                  <p className="text-xs text-steel-muted mt-1">
                    Dates from {data.overviewSheet.source}: start {fmtDate(data.overviewSheet.startDate)} · planned end{" "}
                    {fmtDate(data.overviewSheet.plannedEnd)} · sheet current {fmtDate(data.overviewSheet.currentDate)}
                    {data.overviewSheet.sheetProgressPct != null
                      ? ` · sheet progress ${Math.round(Number(data.overviewSheet.sheetProgressPct) * 1000) / 10}%`
                      : ""}
                    {" · "}
                    register weighted {pct(data.totals?.projectProgressPct || 0)}
                  </p>
                )}
              </div>
              <Link to={`/projects/${id}/hub/progress`} className="text-sm font-semibold text-brand">
                All Progress tools →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              {(
                [
                  ["Milestones", data.charts?.milestoneByStatus, "milestones"],
                  ["Hindrance", data.charts?.hindranceByStatus, "hindrance"],
                  ["Risk", data.charts?.riskByStatus, "risk"],
                  ["Legal", data.charts?.legalByStatus, "legal"],
                ] as const
              ).map(([title, items, tabKey]) => {
                const rows = items || [];
                const total = rows.reduce((s: number, r: any) => s + (Number(r.value) || 0), 0);
                const open = rows.find((r: any) => /open|active|pending/i.test(String(r.label || "")));
                return (
                  <Link
                    key={title}
                    to={`/projects/${id}/progress?tab=${tabKey}`}
                    className="block rounded-sm border border-line bg-sand/50 p-4 hover:border-brand/40 transition"
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider text-steel-muted">{title}</div>
                    <div className="mt-2 text-2xl font-display text-ink">{total}</div>
                    <div className="text-xs text-steel-muted mt-1">
                      {open ? `${open.label}: ${open.value}` : "Open tool →"}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-2 gap-3 min-w-0">
              <div className="min-w-0"><PieChart title="Milestones by status" items={data.charts?.milestoneByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Hindrance by status" items={data.charts?.hindranceByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Risk by status" items={data.charts?.riskByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Legal by status" items={data.charts?.legalByStatus || []} size={150} /></div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 w-full">
            <BarChart
              title="Cashflow planned vs actual"
              items={data.charts?.cashflow || []}
              valueKey="planned"
              compareKey="actual"
            />
            <BarChart title="Hindrance by activity" items={data.charts?.hindranceByActivity || []} />
          </div>
          <div className="grid md:grid-cols-2 gap-4 w-full min-w-0">
            <Card className="min-w-0 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm mb-3 shrink-0">Recent hindrances</h3>
              <div className="scroll-panel max-h-64 min-h-0 space-y-0 text-sm pr-1">
                {data.hindrances.slice(0, 8).map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 border-b border-line py-2 min-w-0">
                    <span className="min-w-0 flex-1 text-ink leading-snug break-words line-clamp-2" title={h.description}>
                      {h.description}
                    </span>
                    <span className="shrink-0 mt-0.5">
                      <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                    </span>
                  </div>
                ))}
                {!data.hindrances?.length && <p className="text-steel-muted text-sm py-2">No hindrances seeded.</p>}
              </div>
            </Card>
            <Card className="min-w-0 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm mb-3 shrink-0">Top risks by severity</h3>
              <div className="scroll-panel max-h-64 min-h-0 space-y-0 text-sm pr-1">
                {[...(data.risks || [])]
                  .sort((a: any, b: any) => Number(b.severity || 0) - Number(a.severity || 0))
                  .slice(0, 8)
                  .map((r: any) => (
                    <div key={r.id} className="flex items-start gap-2 border-b border-line py-2 min-w-0">
                      <span
                        className="min-w-0 flex-1 text-ink leading-snug break-words line-clamp-2"
                        title={r.code ? `${r.code} · ${r.name}` : r.name}
                      >
                        {r.code ? `${r.code} · ` : ""}
                        {r.name}
                      </span>
                      <span className="shrink-0 mt-0.5">
                        <Badge tone={Number(r.severity) >= 15 ? "danger" : "warn"}>Sev {r.severity}</Badge>
                      </span>
                    </div>
                  ))}
                {!data.risks?.length && <p className="text-steel-muted text-sm py-2">No risks seeded.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Milestone register"
            rowCount={data.milestones?.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => setMileAddOpen(true) : undefined}
            onGenerate={canResyncExcel ? () => void loadAllProgressTemplates(true) : undefined}
            generateLabel="Load SPDC template"
            busy={registerSyncBusy}
            message={msg || undefined}
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
            <div className="sheet-register__head shrink-0">Milestone register · sheet columns</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[64rem]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                  <th className="py-2.5 px-3">Milestone ID</th>
                  <th className="py-2.5 pr-3">Phase</th>
                  <th className="py-2.5 pr-3">Milestone Name</th>
                  <th className="py-2.5 pr-3">Planned Start</th>
                  <th className="py-2.5 pr-3">Planned End</th>
                  <th className="py-2.5 pr-3">Planned Days</th>
                  <th className="py-2.5 pr-3">Actual Start</th>
                  <th className="py-2.5 pr-3">Actual End</th>
                  <th className="py-2.5 pr-3">Actual Days</th>
                  <th className="py-2.5 pr-3">Weightage</th>
                  <th className="py-2.5 pr-3">% Complete</th>
                  <th className="py-2.5 pr-3">Stakeholder</th>
                  <th className="py-2.5 pr-3">Zone</th>
                  <th className="py-2.5 pr-3">Status2</th>
                  <th className="py-2.5 px-3">Delays</th>
                </tr>
              </thead>
              <tbody>
                {data.milestones.map((m: any) => (
                  <tr key={m.id} className="border-b border-line/70 hover:bg-sand/40">
                    <td className="py-2 px-3 font-mono text-xs">
                      <RegisterSheetCell value={m.code} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { code: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={m.category} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { category: v })} />
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      <RegisterSheetCell value={m.activity} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { activity: v })} />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(m.plannedStart)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchMilestone(m.id, { plannedStart: v || null })}
                      />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(m.plannedEnd)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchMilestone(m.id, { plannedEnd: v || null })}
                      />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <RegisterSheetCell type="number" value={m.plannedDays} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { plannedDays: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(m.actualStart)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchMilestone(m.id, { actualStart: v || null })}
                      />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(m.actualEnd)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchMilestone(m.id, { actualEnd: v || null })}
                      />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <RegisterSheetCell type="number" value={m.actualDays} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { actualDays: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={m.weightage} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { weightage: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={Math.round((m.pctComplete || 0) * 100)} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { pctComplete: Number(v) / 100 })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={m.stakeholder} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { stakeholder: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={m.zone} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { zone: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={m.status} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { status: v })} />
                    </td>
                    <td className="py-2 px-3">
                      <RegisterSheetCell type="number" value={m.varianceDays} disabled={!canEdit} onCommit={(v) => void patchMilestone(m.id, { varianceDays: Number(v) })} />
                    </td>
                  </tr>
                ))}
                {!data.milestones?.length && <RegisterEmptyRow colSpan={16} />}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "planned" && (
        <div className="progress-sheet-block space-y-4">
          <Card className="!p-3 shrink-0 border-brand/25 bg-brand-soft/30">
            <div className="text-sm font-semibold text-ink">Demo flow — Planned vs Actual → DPR → WPR</div>
            <ol className="mt-2 text-xs text-steel-muted space-y-1.5 list-decimal pl-4 max-w-3xl">
              <li>
                <strong className="text-ink">Cost</strong> — load SPDC budget, then use{" "}
                <strong className="text-ink">Sync from Cost BOQ</strong> below (activity qty from monitoring).
              </li>
              <li>
                <strong className="text-ink">S-curve tab</strong> — <strong className="text-ink">Load demo schedule</strong> or import MS Project XML.
              </li>
              <li>
                <strong className="text-ink">This tab</strong> — load SPDC template or import client Excel; optional sync cashflow to Cost.
              </li>
              <li>
                <strong className="text-ink">DPR maker</strong> — save per discipline; charts read BOQ progress + S-curve register.
              </li>
              <li>
                <strong className="text-ink">WPR maker</strong> — export for week ending; charts pull DPR history + PvA cashflow.
              </li>
            </ol>
          </Card>
          <ReferenceSheetToolbar
            sheetLabel="Planned Vs. Actual Dashboard"
            rowCount={(data.activityLines || []).length || (data.plannedActual || []).length}
            canEdit={canEdit}
            onUpload={canEdit ? (f) => importPlannedActual(f) : undefined}
            uploadHint="Upload client Excel — cashflow, manpower, and activity qty columns preserved."
            addKinds={
              canEdit
                ? [
                    { key: "activity", label: "+ Activity" },
                    { key: "cashflow", label: "+ Cashflow month" },
                    { key: "manpower", label: "+ Manpower trade" },
                  ]
                : undefined
            }
            onAddKind={
              canEdit
                ? (key) => {
                    if (key === "cashflow") setCashAddOpen(true);
                    else if (key === "manpower") setManAddOpen(true);
                    else setActAddOpen(true);
                  }
                : undefined
            }
            onDownloadXlsx={() => void downloadPlannedActual("xlsx")}
            onGenerate={
              canEdit
                ? async () => {
                    await loadProgressTemplate();
                  }
                : undefined
            }
            generateLabel="Load SPDC template"
            busy={!!paBusy || registerSyncBusy}
            message={msg}
          />
          <Card className="!p-3 shrink-0">
            <div className="text-sm font-semibold">Planned Vs. Actual — three sheets from the Excel pack</div>
            <p className="text-xs text-steel-muted mt-1 max-w-3xl">
              Same workbook as <code className="font-mono">Planned Vs. Actual Dashboard.xlsx</code>. Qty % is{" "}
              <strong>executed ÷ GFC</strong> (BOQ is the tender qty, not the %). Manpower is weekly <strong>headcount</strong>,
              not hours. Cashflow ₹ is RA planned vs actual; Cost cashflow is the separate budget chart.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(
                [
                  ["all", "All"],
                  ["cashflow", "Cashflow"],
                  ["manpower", "Manpower"],
                  ["activity", "Activity qty"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded border ${
                    pva === key
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-steel border-line hover:border-brand/40"
                  }`}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("tab", "planned");
                    if (key === "all") next.delete("pva");
                    else next.set("pva", key);
                    setSearchParams(next, { replace: true });
                  }}
                >
                  {label}
                </button>
              ))}
              <Link to={`/projects/${id}/cost?tab=cashflow`} className="text-xs font-semibold text-brand px-2 py-1">
                Open Cost cashflow →
              </Link>
              <Button type="button" variant="secondary" className="!text-xs" disabled={!!paBusy} onClick={() => void syncActivityFromBoq()}>
                {paBusy === "boq" ? "…" : "Sync from Cost BOQ"}
              </Button>
              <Button type="button" variant="secondary" className="!text-xs" disabled={!!paBusy} onClick={() => void syncPvaCashflowToCost()}>
                {paBusy === "sync" ? "…" : "Sync cashflow → Cost"}
              </Button>
            </div>
          </Card>
          <input
            ref={paImportRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            disabled={!!paBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importPlannedActual(f);
              e.target.value = "";
            }}
          />
          {(pva === "all" || pva === "cashflow" || pva === "manpower") && (
          <div className="grid lg:grid-cols-2 gap-4 w-full shrink-0">
            <BarChart
              title="Cashflow planned vs actual"
              items={data.charts?.cashflow || []}
              valueKey="planned"
              compareKey="actual"
            />
            <BarChart
              title="Manpower shortage %"
              items={(data.charts?.manpower || []).map((m: any) => ({
                label: m.label,
                value: (m.shortagePct || 0) * 100,
              }))}
            />
          </div>
          )}
          {(pva === "all" || pva === "cashflow") && (
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0 flex flex-wrap items-center justify-between gap-2">
              <span>Project cashflow · Planned Vs Actual</span>
              {canEdit && (
                <Button type="button" className="!text-xs" onClick={() => setCashAddOpen(true)}>
                  Add cashflow month
                </Button>
              )}
            </div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table min-w-[48rem] w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 pr-3">Budgeted work</th>
                  <th className="py-2.5 pr-3 text-right">Planned Work</th>
                  <th className="py-2.5 pr-3 text-right">Actual Work</th>
                  <th className="py-2.5 pr-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-right">Actual %</th>
                </tr>
              </thead>
              <tbody>
                {pvaCashflowRows.map((p: any) => {
                  const planned = Number(p.plannedAmount) || 0;
                  const actual = Number(p.actualAmount) || 0;
                  const variance = actual - planned;
                  const actualPct = planned > 0 ? actual / planned : Number(p.actualPct) || 0;
                  return (
                  <tr key={p.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-medium whitespace-nowrap">
                      <RegisterSheetCell value={p.periodLabel} disabled={!canEdit} onCommit={(v) => void patchPlannedActual(p.id, { periodLabel: v })} />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <RegisterSheetCell value={p.packageName} disabled={!canEdit} onCommit={(v) => void patchPlannedActual(p.id, { packageName: v })} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <RegisterSheetCell type="number" value={p.plannedAmount} disabled={!canEdit} onCommit={(v) => void patchPlannedActual(p.id, { plannedAmount: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <RegisterSheetCell type="number" value={p.actualAmount} disabled={!canEdit} onCommit={(v) => void patchPlannedActual(p.id, { actualAmount: Number(v) })} />
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${variance < 0 ? "text-red-700" : "text-emerald-800"}`}>
                      {inr(variance)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{pct(actualPct)}</td>
                  </tr>
                  );
                })}
                {!pvaCashflowRows.length && <RegisterEmptyRow colSpan={6} />}
              </tbody>
              {pvaCashflowRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-ink/20 bg-sand/40 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {inr(pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.plannedAmount) || 0), 0))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {inr(pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.actualAmount) || 0), 0))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {inr(
                        pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.actualAmount) || 0), 0) -
                          pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.plannedAmount) || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {pct(
                        (() => {
                          const pl = pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.plannedAmount) || 0), 0);
                          const ac = pvaCashflowRows.reduce((s: number, p: any) => s + (Number(p.actualAmount) || 0), 0);
                          return pl > 0 ? ac / pl : 0;
                        })()
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </Card>
          )}
          {(pva === "all" || pva === "manpower") && (
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0 flex flex-wrap items-center justify-between gap-2">
              <span>Weekly manpower (headcount for the week — not hours)</span>
              {canEdit && (
                <Button type="button" className="!text-xs" onClick={() => setManAddOpen(true)}>
                  Add manpower trade
                </Button>
              )}
            </div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[40rem]">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                  <th className="py-2.5 px-3">Type of Manpower</th>
                  <th className="py-2.5 pr-3 text-right">Required for week</th>
                  <th className="py-2.5 pr-3 text-right">Available</th>
                  <th className="py-2.5 pr-3 text-right">Shortage</th>
                  <th className="py-2.5 pr-3 text-right">% Shortage</th>
                  <th className="py-2.5 px-3 text-right">Rank</th>
                </tr>
              </thead>
              <tbody>
                {(data.manpower || []).map((m: any) => (
                  <tr key={m.id} className="border-b border-line/70">
                    <td className="py-2 px-3">
                      <RegisterSheetCell value={m.trade} disabled={!canEdit} onCommit={(v) => void patchManpower(m.id, { trade: v })} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <RegisterSheetCell type="number" value={m.required} disabled={!canEdit} onCommit={(v) => void patchManpower(m.id, { required: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <RegisterSheetCell type="number" value={m.available} disabled={!canEdit} onCommit={(v) => void patchManpower(m.id, { available: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.shortage}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(m.shortagePct)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{m.rank}</td>
                  </tr>
                ))}
                {!data.manpower?.length && <RegisterEmptyRow colSpan={6} />}
              </tbody>
              {(data.manpower || []).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-ink/20 bg-sand/40 font-semibold">
                    <td className="py-2 px-3">Total of above</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {(data.manpower || []).reduce((s: number, m: any) => s + (Number(m.required) || 0), 0)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {(data.manpower || []).reduce((s: number, m: any) => s + (Number(m.available) || 0), 0)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {(data.manpower || []).reduce((s: number, m: any) => s + (Number(m.shortage) || 0), 0)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {pct(
                        (() => {
                          const req = (data.manpower || []).reduce((s: number, m: any) => s + (Number(m.required) || 0), 0);
                          const short = (data.manpower || []).reduce((s: number, m: any) => s + (Number(m.shortage) || 0), 0);
                          return req > 0 ? short / req : 0;
                        })()
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </Card>
          )}
          {(pva === "all" || pva === "activity") && (
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0 flex flex-wrap items-center justify-between gap-2">
              <span>Planned Vs Actual qty ({(data.activityLines || []).length} lines) — weekly qty feeds DPR</span>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && (
                  <Button type="button" className="!text-xs" onClick={() => setActAddOpen(true)}>
                    Add activity
                  </Button>
                )}
                <Link to={`/projects/${id}/cost?tab=monitoring`} className="text-xs font-semibold text-brand">
                  Cost BOQ / monitoring ({data.totals?.boqLines || 0} lines) →
                </Link>
              </div>
            </div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-[11px] min-w-[1280px] border-collapse">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="text-left text-[10px] uppercase text-steel-muted">
                  <th className="py-2 px-2">Sr.No.</th>
                  <th className="py-2 pr-2">Tower / stage</th>
                  <th className="py-2 pr-2 min-w-[12rem]">Activity</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Planned start</th>
                  <th className="py-2 pr-2">Planned end</th>
                  <th className="py-2 pr-2 text-right">BOQ qty</th>
                  <th className="py-2 pr-2 text-right">GFC qty</th>
                  <th className="py-2 pr-2 text-right">Executed</th>
                  <th className="py-2 pr-2 text-right">Balance</th>
                  <th className="py-2 pr-2 text-right">Wk planned</th>
                  <th className="py-2 pr-2 text-right">Wk actual</th>
                  <th className="py-2 px-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {(data.activityLines || []).map((a: any, idx: number) => {
                  const gfc = Number(a.gfcQty) || 0;
                  const done = Number(a.executedQty || a.cumulativeQty) || 0;
                  const bal = a.balanceQty != null ? Number(a.balanceQty) : gfc - done;
                  const donePct = gfc > 0 ? done / gfc : Number(a.pctComplete) || 0;
                  return (
                  <tr key={a.id} className={idx % 2 === 0 ? "bg-paper" : "bg-sand/20"}>
                    <td className="py-1.5 px-2 border border-line font-mono">{a.srNo}</td>
                    <td className="py-1.5 pr-2 border border-line">
                      <RegisterSheetCell value={a.tower} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { tower: v })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line font-medium text-ink">
                      <RegisterSheetCell value={a.activity} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { activity: v })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line">
                      <RegisterSheetCell value={a.unit} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { unit: v })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(a.plannedStart)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchActivity(a.id, { plannedStart: v || null })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 border border-line whitespace-nowrap">
                      <RegisterSheetCell
                        type="date"
                        value={isoDay(a.plannedEnd)}
                        disabled={!canEdit}
                        onCommit={(v) => void patchActivity(a.id, { plannedEnd: v || null })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">
                      <RegisterSheetCell type="number" value={a.boqQty} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { boqQty: Number(v) })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">
                      <RegisterSheetCell type="number" value={a.gfcQty} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { gfcQty: Number(v) })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">
                      <RegisterSheetCell type="number" value={a.executedQty || a.cumulativeQty} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { executedQty: Number(v), cumulativeQty: Number(v) })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">{formatQty(bal)}</td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">
                      <RegisterSheetCell type="number" value={a.weeklyPlanned} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { weeklyPlanned: Number(v) })} />
                    </td>
                    <td className="py-1.5 pr-2 border border-line text-right tabular-nums">
                      <RegisterSheetCell type="number" value={a.weeklyActual} disabled={!canEdit} onCommit={(v) => void patchActivity(a.id, { weeklyActual: Number(v) })} />
                    </td>
                    <td className="py-1.5 px-2 border border-line text-right tabular-nums">{pct(donePct)}</td>
                  </tr>
                  );
                })}
                {!(data.activityLines || []).length && <RegisterEmptyRow colSpan={13} />}
              </tbody>
            </table>
            </div>
          </Card>
          )}
        </div>
      )}

      {tab === "monthly" && (
        <div className="progress-sheet-block space-y-4">
          <ReferenceSheetToolbar
            sheetLabel="Monthly Progress Dashboard"
            rowCount={data.sorStats?.length}
            canEdit={canEdit}
            onGenerate={canResyncExcel ? () => void runResyncSor() : undefined}
            generateLabel="Load Monthly Dashboard"
            busy={resyncBusy}
            uploadHint="SOR Log from Monthly Progress Dashboard.xlsx — Sr.no, Observation, Total, Open, Close, Closure Rate."
            message={msg || undefined}
          />
          <div className="grid md:grid-cols-2 gap-4 shrink-0">
            <BarChart
              title="SOR / observation closure"
              items={data.charts?.sor || []}
              valueKey="closed"
              compareKey="open"
            />
            <PieChart
              title="SOR closure rate"
              items={(data.sorStats || []).map((s: any) => ({
                label: s.observation?.slice(0, 24) || "SOR",
                value: s.closedCount || 0,
                color: s.closureRate >= 0.9 ? "#16A34A" : s.closureRate >= 0.5 ? "#D97706" : "#DC2626",
              })).filter((x: { value: number }) => x.value > 0)}
            />
          </div>
          <Card className="overflow-x-auto !p-0 sheet-register register-table-panel progress-sheet-table flex-1 min-h-0 flex flex-col">
            <div className="sheet-register__head shrink-0">Monthly Progress · SOR Log</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[40rem]">
              <thead>
                <tr>
                  <th>Sr.no.</th>
                  <th>Observation</th>
                  <th>Total</th>
                  <th>Open</th>
                  <th>Close</th>
                  <th>Closure Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.sorStats.map((s: any, i: number) => (
                  <tr key={s.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">{s.srNo ?? i + 1}</td>
                    <td className="py-2 px-3 font-medium">{s.observation}</td>
                    <td className="py-2 pr-3">{s.total}</td>
                    <td className="py-2 pr-3">{s.openCount}</td>
                    <td className="py-2 pr-3">{s.closedCount}</td>
                    <td className="py-2 px-3">{pct(s.closureRate)}</td>
                  </tr>
                ))}
                {!data.sorStats.length && (
                  <tr>
                    <td colSpan={6} className="py-6 px-3 text-steel-muted">
                      No monthly SOR rows — re-seed from Monthly Progress Dashboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "hindrance" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Hindrance Register Dashboard"
            rowCount={data.hindrances?.length}
            canEdit={canEdit}
            onAddRow={() => setHindranceModalOpen(true)}
            onGenerate={canResyncExcel ? () => void loadAllProgressTemplates(true) : undefined}
            generateLabel="Load SPDC template"
            busy={registerSyncBusy || !!paBusy}
            message={msg}
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0">Hindrance register</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Description of Hindrance</th>
                  <th className="py-2.5 pr-3">Location</th>
                  <th className="py-2.5 pr-3">Critical Activity affected</th>
                  <th className="py-2.5 pr-3">Correspondence</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Type of Hindrance</th>
                  <th className="py-2.5 pr-3">Date of Occurrence</th>
                  <th className="py-2.5 pr-3">Date Resolved</th>
                  <th className="py-2.5 pr-3">No. of Days</th>
                  <th className="py-2.5 pr-3">Baseline Start Date</th>
                  <th className="py-2.5 pr-3">Schedule Impact</th>
                  <th className="py-2.5 pr-3">Delay Type</th>
                  <th className="py-2.5 pr-3">Accountable</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3">Description of Resolution</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.hindrances.map((h: any) => (
                  <tr key={h.id} className="border-b border-line/70">
                    <td className="py-2 px-3 max-w-[220px]">
                      <RegisterSheetCell value={h.description} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { description: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.location} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { location: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.activity} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { activity: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.correspondence} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { correspondence: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.category} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { category: v })} />
                    </td>
                    <td className="py-2 pr-3 max-w-[160px]">
                      <RegisterSheetCell value={h.type} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { type: v })} />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.occurredAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.resolvedAt)}</td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={h.daysImpacted} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { daysImpacted: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.baselineStart)}</td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={h.scheduleImpact} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { scheduleImpact: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.delayType} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { delayType: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.accountable} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { accountable: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={h.status} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { status: v })} />
                    </td>
                    <td className="py-2 pr-3 max-w-[180px]">
                      <RegisterSheetCell value={h.resolutionDescription} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { resolutionDescription: v })} />
                    </td>
                    <td className="py-2 px-3 max-w-[160px]">
                      <RegisterSheetCell value={h.remarks} disabled={!canEdit} onCommit={(v) => void patchHindrance(h.id, { remarks: v })} />
                    </td>
                  </tr>
                ))}
                {!data.hindrances?.length && <RegisterEmptyRow colSpan={16} />}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "risk" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Risk Register - Dashboard"
            rowCount={data.risks?.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => setRiskAddOpen(true) : undefined}
            onGenerate={canResyncExcel ? () => void loadAllProgressTemplates(true) : undefined}
            generateLabel="Load SPDC template"
            busy={registerSyncBusy}
            message={msg || undefined}
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0">Risk register</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[56rem]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Opportunity / Threat</th>
                  <th className="py-2.5 pr-3">Risk Name</th>
                  <th className="py-2.5 pr-3 min-w-[12rem]">Detailed Description</th>
                  <th className="py-2.5 pr-3">P (1-5)</th>
                  <th className="py-2.5 pr-3">C (1-5)</th>
                  <th className="py-2.5 pr-3">Severity</th>
                  <th className="py-2.5 pr-3">Prob %</th>
                  <th className="py-2.5 pr-3">Cost Impact</th>
                  <th className="py-2.5 pr-3">Weeks</th>
                  <th className="py-2.5 pr-3">Urgency</th>
                  <th className="py-2.5 pr-3">Response</th>
                  <th className="py-2.5 pr-3">Risk Owner</th>
                  <th className="py-2.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.risks.map((r: any) => (
                  <tr key={r.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">
                      <RegisterSheetCell value={r.code} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { code: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={r.category} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { category: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={r.opportunityThreat} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { opportunityThreat: v })} />
                    </td>
                    <td className="py-2 pr-3 max-w-xs font-medium">
                      <RegisterSheetCell value={r.name} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { name: v })} />
                    </td>
                    <td className="py-2 pr-3 max-w-[14rem] text-xs text-steel-muted">
                      <RegisterSheetCell value={r.description} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { description: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={r.probability} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { probability: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={r.consequence} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { consequence: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3 font-semibold">{r.severity}</td>
                    <td className="py-2 pr-3">{Math.round((r.probabilityPct || 0) * 100)}%</td>
                    <td className="py-2 pr-3">{inr(r.costImpact)}</td>
                    <td className="py-2 pr-3">{r.weeksLikely ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={r.urgency} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { urgency: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={r.responseCategory} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { responseCategory: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={r.riskOwner} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { riskOwner: v })} />
                    </td>
                    <td className="py-2 px-3">
                      <RegisterSheetCell value={r.status} disabled={!canEdit} onCommit={(v) => void patchRisk(r.id, { status: v })} />
                    </td>
                  </tr>
                ))}
                {!data.risks?.length && <RegisterEmptyRow colSpan={15} />}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "legal" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Legal Approval Tracker"
            rowCount={data.legalApprovals?.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => setLegalAddOpen(true) : undefined}
            onGenerate={canResyncExcel ? () => void loadAllProgressTemplates(true) : undefined}
            generateLabel="Load SPDC template"
            busy={registerSyncBusy}
            message={msg || undefined}
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0">Legal Approval Tracker</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
            <table className="sheet-register__table w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Approval ID</th>
                  <th className="py-2.5 pr-3">Approval Category</th>
                  <th className="py-2.5 pr-3">Authority Name</th>
                  <th className="py-2.5 pr-3">Approval Description</th>
                  <th className="py-2.5 pr-3">Applicable Building / Package</th>
                  <th className="py-2.5 pr-3">Submission Date</th>
                  <th className="py-2.5 pr-3">Required By</th>
                  <th className="py-2.5 pr-3">Approval Received Date</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3">Delay (Days)</th>
                  <th className="py-2.5 pr-3">Responsible Party</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.legalApprovals.map((l: any) => (
                  <tr key={l.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">
                      <RegisterSheetCell value={l.approvalId} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { approvalId: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={l.category} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { category: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={l.authority} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { authority: v })} />
                    </td>
                    <td className="py-2 pr-3 max-w-[240px]">
                      <RegisterSheetCell value={l.description} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { description: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={l.packageName} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { packageName: v })} />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.submissionDate)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.requiredBy)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.receivedDate)}</td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={l.status} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { status: v })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell type="number" value={l.delayDays} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { delayDays: Number(v) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <RegisterSheetCell value={l.responsible} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { responsible: v })} />
                    </td>
                    <td className="py-2 px-3">
                      <RegisterSheetCell value={l.remarks} disabled={!canEdit} onCommit={(v) => void patchLegal(l.id, { remarks: v })} />
                    </td>
                  </tr>
                ))}
                {!data.legalApprovals?.length && <RegisterEmptyRow colSpan={12} />}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "lessons" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="Lessons Learnt — Sharnam PMC"
            rowCount={data.lessons?.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => setLessonAddOpen(true) : undefined}
            onGenerate={canResyncExcel ? () => void loadAllProgressTemplates(true) : undefined}
            generateLabel="Load SPDC template"
            busy={registerSyncBusy}
            message={msg || undefined}
            uploadHint="Rows from Lessons Learnt - Sharnam PMC.xls — add site notes without changing Excel numbers."
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
            <div className="sheet-register__head shrink-0">Lessons learnt register</div>
            <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
              <table className="sheet-register__table w-full text-sm min-w-[56rem]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                    <th className="py-2.5 px-3">S.No</th>
                    <th className="py-2.5 pr-3">Description</th>
                    <th className="py-2.5 pr-3">What went well</th>
                    <th className="py-2.5 pr-3">What did not meet expectations</th>
                    <th className="py-2.5 pr-3">How it could have been done better</th>
                    <th className="py-2.5 px-3">Value differentiator</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.lessons || []).map((l: any) => (
                    <tr key={l.id} className="border-b border-line/70 align-top">
                      <td className="py-2 px-3 font-mono text-xs">{l.srNo ?? "—"}</td>
                      <td className="py-2 pr-3 font-medium">{l.description || "—"}</td>
                      <td className="py-2 pr-3 text-sm">{l.wentWell || "—"}</td>
                      <td className="py-2 pr-3 text-sm">{l.notMetExpectation || "—"}</td>
                      <td className="py-2 pr-3 text-sm">{l.lessonsLearnt || "—"}</td>
                      <td className="py-2 px-3 text-sm">{l.valueDifferentiator || "—"}</td>
                    </tr>
                  ))}
                  {!data.lessons?.length && <RegisterEmptyRow colSpan={6} />}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "scurve" && (
        <div className="space-y-4">
          <Card className="!p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand mb-1">Schedule S-curve</p>
                <h3 className="font-display text-xl text-ink">Planned vs actual — cumulative %</h3>
                <p className="text-sm text-steel-muted mt-1 max-w-2xl">
                  Built from MS Project task baseline + % complete. Same weekly rows feed DPR dashboard charts and WPR progress slides.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={!!msBusy} onClick={() => void seedDemoSchedule()}>
                    {msBusy === "seed" ? "Loading…" : "Load demo schedule"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => msImportRef.current?.click()}>
                    {msBusy === "import" ? "Importing…" : "Import MS Project XML"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => void downloadMsProjectXml()}>
                    {msBusy === "xml" ? "Downloading…" : "Download XML"}
                  </Button>
                  <input
                    ref={msImportRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importMsProject(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>
            {msProject?.connected && msProject.scurve?.length ? (
              <>
                <ProgressScurveChart
                  points={msProject.scurve.map((p: { periodLabel: string; plannedPct: number; actualPct: number }) => ({
                    label: p.periodLabel,
                    planned: p.plannedPct,
                    actual: p.actualPct,
                  }))}
                />
                <p className="text-xs text-steel-muted mt-3">
                  {msProject.scurvePoints} weekly points · {msProject.taskCount} tasks · file:{" "}
                  <span className="font-mono">{msProject.fileFolder}/{msProject.fileName}</span>
                </p>
              </>
            ) : (
              <div className="text-center py-8 border border-dashed border-line rounded-lg space-y-3">
                <p className="text-sm text-steel-muted px-4">
                  No S-curve yet. For the demo, click <strong>Load demo schedule</strong> — or import client XML (File → Save As → XML in MS Project).
                </p>
                {canEdit && (
                  <Button type="button" onClick={() => void seedDemoSchedule()} disabled={!!msBusy}>
                    {msBusy === "seed" ? "Loading…" : "Load demo schedule"}
                  </Button>
                )}
              </div>
            )}
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-semibold text-ink mb-2">Connection to DPR / WPR</p>
            <ul className="text-sm text-steel-muted space-y-1 list-disc pl-4">
              <li>MS Project → <code className="text-xs">ProgressPlannedActual</code> (S-curve weekly %)</li>
              <li>Tasks → <code className="text-xs">ProgressActivityLine</code> → DPR planned qty hints</li>
              <li>DPR Maker dashboard charts read published DPR history + BOQ progress</li>
              <li>WPR Maker progress section reads milestones + hindrance + quality</li>
            </ul>
          </Card>
        </div>
      )}

      {tab === "msproject" && (
        <div className="progress-sheet-block space-y-3">
          <ReferenceSheetToolbar
            sheetLabel="MS Project task register"
            rowCount={msProject?.tasks?.length}
            canEdit={canEdit}
            onUpload={
              canEdit
                ? async (file) => {
                    if (!id) return;
                    setMsBusy("import");
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const out = await api<{ taskCount: number; scurvePoints: number }>(
                        `/api/progress/${id}/ms-project/import`,
                        { method: "POST", token, body: fd }
                      );
                      setMsg(`MS Project imported — ${out.taskCount} tasks · ${out.scurvePoints} S-curve points`);
                      await Promise.all([load(), loadMsProject()]);
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : "MS Project import failed");
                    } finally {
                      setMsBusy(null);
                    }
                  }
                : undefined
            }
            uploadHint="Import File → Save As → XML from Microsoft Project."
            onDownloadCsv={() => void downloadMsProjectXml()}
            busy={!!msBusy}
            message={msg}
          />
          <details className="rounded border border-line bg-paper shrink-0 text-sm">
            <summary className="cursor-pointer px-3 py-2 font-semibold text-brand-dark">Import help</summary>
            <div className="px-3 pb-3 text-steel-muted">
              Import <strong>File → Save As → XML</strong> from Microsoft Project. MPP binary is not supported.
            </div>
          </details>
          <input
              ref={msImportRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && id) {
                  void (async () => {
                    setMsBusy("import");
                    try {
                      const fd = new FormData();
                      fd.append("file", f);
                      const out = await api<{ taskCount: number; scurvePoints: number }>(
                        `/api/progress/${id}/ms-project/import`,
                        { method: "POST", token, body: fd }
                      );
                      setMsg(`MS Project imported — ${out.taskCount} tasks`);
                      await Promise.all([load(), loadMsProject()]);
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Import failed");
                    } finally {
                      setMsBusy(null);
                    }
                  })();
                }
              e.target.value = "";
            }}
          />
          <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold shrink-0">Task register · % complete · baseline</div>
            {msProject?.tasks?.length ? (
              <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
                <table className="sheet-register__table w-full text-sm min-w-[48rem]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-steel-muted border-b border-line">
                      <th className="py-2 pr-3">WBS</th>
                      <th className="py-2 pr-3">Activity</th>
                      <th className="py-2 pr-3">Plan start</th>
                      <th className="py-2 pr-3">Plan finish</th>
                      <th className="py-2 pr-3">Days</th>
                      <th className="py-2 px-3">% complete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msProject.tasks.map((t: { wbs: string; name: string; start?: string; finish?: string; durationDays: number; percentComplete: number }, i: number) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-2 pr-3 font-mono text-xs">{t.wbs}</td>
                        <td className="py-2 pr-3 max-w-[280px]">{t.name}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.start)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.finish)}</td>
                        <td className="py-2 pr-3">{Math.round(t.durationDays)}</td>
                        <td className="py-2 px-3">
                          <Badge tone={t.percentComplete >= 100 ? "ok" : t.percentComplete > 0 ? "brand" : "warn"}>
                            {Math.round(t.percentComplete)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-steel-muted py-8 text-center">
                No MS Project tasks — import client XML from Microsoft Project.
              </p>
            )}
          </Card>
        </div>
      )}

      <RegisterEntryModal
        open={mileAddOpen && canEdit}
        title="Add milestone"
        onClose={() => setMileAddOpen(false)}
        onSave={() => mileFormRef.current?.requestSubmit()}
        size="2xl"
        saveLabel="Save milestone"
      >
        <form ref={mileFormRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMilestone}>
          <Input placeholder="Code (M11)" value={mileForm.code} onChange={(e) => setMileForm({ ...mileForm, code: e.target.value })} />
          <Input placeholder="Phase" value={mileForm.category} onChange={(e) => setMileForm({ ...mileForm, category: e.target.value })} />
          <Input
            className="sm:col-span-2"
            placeholder="Milestone name"
            value={mileForm.activity}
            onChange={(e) => setMileForm({ ...mileForm, activity: e.target.value })}
            required
          />
          <Input type="date" value={mileForm.plannedStart} onChange={(e) => setMileForm({ ...mileForm, plannedStart: e.target.value })} />
          <Input type="date" value={mileForm.plannedEnd} onChange={(e) => setMileForm({ ...mileForm, plannedEnd: e.target.value })} />
          <Input placeholder="Plan days" value={mileForm.plannedDays} onChange={(e) => setMileForm({ ...mileForm, plannedDays: e.target.value })} />
          <Input placeholder="Actual days" value={mileForm.actualDays} onChange={(e) => setMileForm({ ...mileForm, actualDays: e.target.value })} />
          <Input placeholder="Weightage" value={mileForm.weightage} onChange={(e) => setMileForm({ ...mileForm, weightage: e.target.value })} />
          <Input placeholder="% complete 0–1" value={mileForm.pctComplete} onChange={(e) => setMileForm({ ...mileForm, pctComplete: e.target.value })} />
          <Select value={mileForm.status} onChange={(e) => setMileForm({ ...mileForm, status: e.target.value })}>
            {["Completed", "Delayed", "In Progress", "Not Started"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </form>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={riskAddOpen && canEdit}
        title="Identify risk"
        onClose={() => setRiskAddOpen(false)}
        onSave={() => riskFormRef.current?.requestSubmit()}
        size="2xl"
        saveLabel="Add risk"
      >
        <form ref={riskFormRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addRisk}>
          <Input placeholder="Code (R11)" value={riskForm.code} onChange={(e) => setRiskForm({ ...riskForm, code: e.target.value })} />
          <Input placeholder="Name" value={riskForm.name} onChange={(e) => setRiskForm({ ...riskForm, name: e.target.value })} required />
          <Select value={riskForm.category} onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })}>
            {["Execution", "Planning/ Scope", "Communications", "Schedule", "Estimating", "Controlling"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={riskForm.opportunityThreat} onChange={(e) => setRiskForm({ ...riskForm, opportunityThreat: e.target.value })}>
            <option>Threat</option>
            <option>Opportunity</option>
            <option>Both</option>
          </Select>
          <Input type="number" min={1} max={5} placeholder="Probability 1–5" value={riskForm.probability} onChange={(e) => setRiskForm({ ...riskForm, probability: e.target.value })} />
          <Input type="number" min={1} max={5} placeholder="Consequence 1–5" value={riskForm.consequence} onChange={(e) => setRiskForm({ ...riskForm, consequence: e.target.value })} />
          <Input placeholder="Cost impact ₹" value={riskForm.costImpact} onChange={(e) => setRiskForm({ ...riskForm, costImpact: e.target.value })} />
          <TextArea
            className="sm:col-span-2 lg:col-span-3"
            rows={2}
            placeholder="Detailed description"
            value={riskForm.description}
            onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
          />
        </form>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={actAddOpen && canEdit}
        title="Add progress activity line"
        onClose={() => setActAddOpen(false)}
        onSave={() => void addActivityLine()}
        saving={actBusy}
        saveLabel="Add line"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            className="sm:col-span-2"
            placeholder="Activity (match BOQ description for DPR auto-fill)"
            value={actForm.activity}
            onChange={(e) => setActForm({ ...actForm, activity: e.target.value })}
            required
          />
          <Input placeholder="Tower / stage" value={actForm.tower} onChange={(e) => setActForm({ ...actForm, tower: e.target.value })} />
          <Input placeholder="UOM" value={actForm.unit} onChange={(e) => setActForm({ ...actForm, unit: e.target.value })} />
          <Input
            type="number"
            step="any"
            placeholder="BOQ qty"
            value={actForm.boqQty}
            onChange={(e) => setActForm({ ...actForm, boqQty: e.target.value })}
          />
          <Input
            type="number"
            step="any"
            placeholder="GFC qty"
            value={actForm.gfcQty}
            onChange={(e) => setActForm({ ...actForm, gfcQty: e.target.value })}
          />
          <Input
            type="number"
            step="any"
            placeholder="Executed / achieved qty"
            value={actForm.executedQty}
            onChange={(e) => setActForm({ ...actForm, executedQty: e.target.value })}
          />
          <Input
            type="number"
            step="any"
            placeholder="Weekly planned qty"
            value={actForm.weeklyPlanned}
            onChange={(e) => setActForm({ ...actForm, weeklyPlanned: e.target.value })}
          />
          <Input
            type="number"
            step="any"
            placeholder="Weekly actual qty"
            value={actForm.weeklyActual}
            onChange={(e) => setActForm({ ...actForm, weeklyActual: e.target.value })}
          />
        </div>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={legalAddOpen && canEdit}
        title="Add legal approval"
        onClose={() => setLegalAddOpen(false)}
        onSave={() => legalFormRef.current?.requestSubmit()}
        size="2xl"
        saveLabel="Add row"
      >
        <form ref={legalFormRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addLegal}>
          <Input placeholder="Approval ID (LA-31)" value={legalForm.approvalId} onChange={(e) => setLegalForm({ ...legalForm, approvalId: e.target.value })} />
          <Input placeholder="Category" value={legalForm.category} onChange={(e) => setLegalForm({ ...legalForm, category: e.target.value })} />
          <Input placeholder="Authority" value={legalForm.authority} onChange={(e) => setLegalForm({ ...legalForm, authority: e.target.value })} />
          <Input
            className="sm:col-span-2"
            placeholder="Description"
            value={legalForm.description}
            onChange={(e) => setLegalForm({ ...legalForm, description: e.target.value })}
            required
          />
          <Input placeholder="Package / building" value={legalForm.packageName} onChange={(e) => setLegalForm({ ...legalForm, packageName: e.target.value })} />
          <Select value={legalForm.status} onChange={(e) => setLegalForm({ ...legalForm, status: e.target.value })}>
            {["Approved", "Submitted", "Delayed", "In Progress", "Not Submitted"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Input placeholder="Responsible" value={legalForm.responsible} onChange={(e) => setLegalForm({ ...legalForm, responsible: e.target.value })} />
        </form>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={hindranceModalOpen}
        title="Add hindrance row"
        onClose={() => setHindranceModalOpen(false)}
        onSave={async () => {
          await addHindrance({ preventDefault: () => {} } as FormEvent);
          setHindranceModalOpen(false);
        }}
        size="xl"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            className="sm:col-span-2"
            placeholder="Description"
            value={hindranceForm.description}
            onChange={(e) => setHindranceForm({ ...hindranceForm, description: e.target.value })}
            required
          />
          <Input placeholder="Location" value={hindranceForm.location} onChange={(e) => setHindranceForm({ ...hindranceForm, location: e.target.value })} />
          <Input placeholder="Activity affected" value={hindranceForm.activity} onChange={(e) => setHindranceForm({ ...hindranceForm, activity: e.target.value })} />
          <Select value={hindranceForm.category} onChange={(e) => setHindranceForm({ ...hindranceForm, category: e.target.value })}>
            {["Design & Technical", "Approval", "Execution", "Material Procurement", "Client"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Input type="date" value={hindranceForm.occurredAt} onChange={(e) => setHindranceForm({ ...hindranceForm, occurredAt: e.target.value })} />
          <Input placeholder="Days impacted" value={hindranceForm.daysImpacted} onChange={(e) => setHindranceForm({ ...hindranceForm, daysImpacted: e.target.value })} />
        </div>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={cashAddOpen && canEdit}
        title="Add cashflow month"
        onClose={() => setCashAddOpen(false)}
        onSave={() => void addCashflow({ preventDefault: () => {} } as FormEvent)}
        saving={actBusy}
        saveLabel="Add month"
      >
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={addCashflow}>
          <Input placeholder="Month (e.g. April)" value={cashForm.periodLabel} onChange={(e) => setCashForm({ ...cashForm, periodLabel: e.target.value })} required />
          <Input placeholder="RA / package (e.g. RA 09)" value={cashForm.packageName} onChange={(e) => setCashForm({ ...cashForm, packageName: e.target.value })} />
          <Input type="number" step="any" placeholder="Planned work ₹" value={cashForm.plannedAmount} onChange={(e) => setCashForm({ ...cashForm, plannedAmount: e.target.value })} />
          <Input type="number" step="any" placeholder="Actual work ₹" value={cashForm.actualAmount} onChange={(e) => setCashForm({ ...cashForm, actualAmount: e.target.value })} />
        </form>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={manAddOpen && canEdit}
        title="Add manpower trade (weekly headcount)"
        onClose={() => setManAddOpen(false)}
        onSave={() => void addManpowerRow({ preventDefault: () => {} } as FormEvent)}
        saving={actBusy}
        saveLabel="Add trade"
      >
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={addManpowerRow}>
          <Input className="sm:col-span-2" placeholder="Type of manpower" value={manForm.trade} onChange={(e) => setManForm({ ...manForm, trade: e.target.value })} required />
          <Input type="number" placeholder="Required people this week" value={manForm.required} onChange={(e) => setManForm({ ...manForm, required: e.target.value })} />
          <Input type="number" placeholder="Available people" value={manForm.available} onChange={(e) => setManForm({ ...manForm, available: e.target.value })} />
        </form>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={lessonAddOpen && canEdit}
        title="Add lesson learnt"
        onClose={() => setLessonAddOpen(false)}
        onSave={() => void addLesson({ preventDefault: () => {} } as FormEvent)}
        saving={actBusy}
        saveLabel="Add lesson"
        size="xl"
      >
        <form className="grid gap-3" onSubmit={addLesson}>
          <Input placeholder="Description / stage" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} required />
          <TextArea rows={2} placeholder="What went well" value={lessonForm.wentWell} onChange={(e) => setLessonForm({ ...lessonForm, wentWell: e.target.value })} />
          <TextArea rows={2} placeholder="What did not meet expectations" value={lessonForm.notMetExpectation} onChange={(e) => setLessonForm({ ...lessonForm, notMetExpectation: e.target.value })} />
          <TextArea rows={2} placeholder="How it could have been done better" value={lessonForm.lessonsLearnt} onChange={(e) => setLessonForm({ ...lessonForm, lessonsLearnt: e.target.value })} />
        </form>
      </RegisterEntryModal>

    </div>
  );
}

function ProgressScurveChart({ points }: { points: { label: string; planned: number; actual: number }[] }) {
  if (!points.length) return null;
  const w = 640;
  const h = 220;
  const pad = 36;
  const maxY = Math.max(100, ...points.flatMap((p) => [p.planned, p.actual])) * 1.08;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const planned = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.planned)}`).join(" ");
  const actual = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.actual)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="S-curve planned vs actual">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <path d={planned} fill="none" stroke="#2563EB" strokeWidth="2.5" />
        <path d={actual} fill="none" stroke="#0F766E" strokeWidth="2.5" />
        {[0, 25, 50, 75, 100].filter((v) => v <= maxY).map((v) => (
          <g key={v}>
            <line x1={pad - 4} y1={y(v)} x2={w - pad} y2={y(v)} stroke="var(--color-line,#e8eaed)" strokeDasharray="4 4" />
            <text x={8} y={y(v) + 4} fontSize="9" fill="var(--color-steel-muted,#5c6578)">{v}%</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-[11px] text-steel-muted mt-2">
        <span><span className="inline-block w-3 h-0.5 bg-[#2563EB] align-middle mr-1" />Planned (baseline)</span>
        <span><span className="inline-block w-3 h-0.5 bg-[#0F766E] align-middle mr-1" />Actual (% complete)</span>
      </div>
    </div>
  );
}

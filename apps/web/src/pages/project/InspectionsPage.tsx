import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, mediaUrl } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { CHART_COLORS, ColumnChart, LineChart } from "../../components/ColumnChart";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../../components/ui";
import { QUALITY_SHEET_VIEWS, qualityLegacyQapRedirect, qualitySheetFromParams, type QualitySheetKey } from "../../lib/qualitySheetViews";
import { QualitySiteRegister } from "../../components/QualitySiteRegister";
import { CubeRegisterPanel } from "../../components/CubeRegisterPanel";
import type { QapProjectMeta } from "../../components/QapDetailRegister";
import { SorLogPanel } from "../../components/SorLogPanel";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { openNcrFormWindow, ncrComplianceSummary } from "../../lib/ncrFormFields";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { QualityChecklistSummaryPanel } from "../../components/QualityChecklistSummaryPanel";
import { openFamilyChecklistFill } from "../../lib/checklistFillWindow";
import { RegisterBrandHeader } from "../../components/RegisterBrandHeader";
import { CHECKLIST_FILLED_MESSAGE } from "../../lib/inPageOverlay";
import { StatusNote } from "../../components/StatusNote";
import { SpdcInspectionFormPanel } from "../../components/SpdcInspectionFormPanel";
import { ReportExportButtons } from "../../components/ReportExportButtons";

  /** Excel register sheets — inner table scroll; dashboard / QI / checklist summary use page scroll */
const QUALITY_REGISTER_SHEETS = new Set<QualitySheetKey>([
  "sor-log",
  "site-observation",
  "site-instruction",
  "car-register",
]);

/** Dashboard-style tabs — middle column scrolls (charts + tables + QAP-style sheets) */
const QUALITY_PAGE_SCROLL_SHEETS = new Set<QualitySheetKey>(["", "qi", "checklist-summary", "cube-test"]);

/** Quality module — Quality Dashboard.xlsx sheet tabs + QI / checklist fills → DPR */
export default function InspectionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sheetView = qualitySheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [project, setProject] = useState<QapProjectMeta | null>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);
  const [irBusy, setIrBusy] = useState(false);
  const [projectVendors, setProjectVendors] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [ncrForm, setNcrForm] = useState({
    kind: "NCR" as "NCR" | "CAR",
    number: "",
    ncrType: "",
    description: "",
    location: "",
    contractor: "",
    contractorVendorId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    plannedClosure: "",
    actionRequired: "",
    toParty: "",
    fromParty: "Sharnam Project Development Consultants & Co.",
    environmentalIssues: "",
    otherCause: "",
  });
  const [ncrAddOpen, setNcrAddOpen] = useState(false);
  const [ncrAddBusy, setNcrAddBusy] = useState(false);
  const [pack, setPack] = useState<any>(null);
  const ncrAddFormRef = useRef<HTMLFormElement>(null);
  const [cubeAddOpen, setCubeAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "Site quality inspection",
    drawingId: "",
    inspectionType: "Quality Inspection",
    checklistTemplateId: "",
    assignedToId: "",
    dueDate: "",
    location: "",
  });
  const [itemText, setItemText] = useState("");
  const [msg, setMsg] = useState("");

  const canManage =
    user?.role === "admin" || user?.role === "office" || user?.role === "site_employee" || user?.role === "employee";
  const isOfficeAdmin = user?.role === "admin" || user?.role === "office";

  const [weekStart, setWeekStart] = useState(() => {
    const t = new Date();
    const m = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
  });
  const weekEnd = (() => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const weekNo = (() => {
    const d = new Date(`${weekStart}T00:00:00`);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  })();
  function shiftWeek(n: number) {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + 7 * n);
    setWeekStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  useEffect(() => {
    if (!id) return;
    api(`/api/checklist/project/${id}/quality-dashboard?from=${weekStart}&to=${weekEnd}`, { token })
      .then((d) => setDash(d))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const load = async () => {
    const [insp, d, u, t, dashRes, projRes, packRes, vendorsRes] = await Promise.all([
      api<{ inspections: any[]; canInspect: boolean; publishedDrawings: number }>(`/api/inspections/project/${id}`, {
        token,
      }),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/checklist/templates?type=QualityInspection", { token }).catch(() => []),
      api(`/api/checklist/project/${id}/quality-dashboard?from=${weekStart}&to=${weekEnd}`, { token }).catch(() => null),
      api<QapProjectMeta>(`/api/projects/${id}`, { token }).catch(() => null),
      api(`/api/projects/${id}/sheet-pack`, { token }).catch(() => null),
      api<any[]>(`/api/vendors/project/${id}`, { token }).catch(() => []),
    ]);
    setData(insp);
    setDash(dashRes);
    setPack(packRes);
    if (projRes) {
      setProject({
        id: projRes.id,
        name: projRes.name,
        code: projRes.code,
        // Register header: project card, else the project directory parties.
        clientName: projRes.clientName || (projRes as any).parties?.client || null,
        designConsultant: projRes.designConsultant || (projRes as any).parties?.consultant || null,
        contractorName: projRes.contractorName || (projRes as any).parties?.vendor || null,
        pmcName: (projRes as { pmcName?: string | null }).pmcName || (projRes as any).parties?.pmc || null,
        location: (projRes as { location?: string | null }).location,
        clientLogoUrl: (projRes as { clientLogoUrl?: string | null }).clientLogoUrl,
      });
    }
    setDrawings(d.filter((x) => x.isPublished));
    setUsers(u);
    const list = Array.isArray(t) ? t : [];
    setTemplates(list.slice(0, 50));
    setProjectVendors(Array.isArray(vendorsRes) ? vendorsRes : []);
    api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=QualityInspection`, { token })
      .then((r) => setQiAssignments(r.assignments || []))
      .catch(() => setQiAssignments([]));
    if (!active && insp.inspections?.[0]) setActive(insp.inspections[0].id);
  };

  useEffect(() => {
    // The QI sheet was the same F-01 request as the Inspection register — one place now.
    if (sheetKey === "qi" && id) navigate(`/projects/${id}/inspection-register`, { replace: true });
  }, [sheetKey, id, navigate]);

  useEffect(() => {
    if (qualityLegacyQapRedirect(searchParams) && id) {
      navigate(`/projects/${id}/qap`, { replace: true });
    }
  }, [searchParams, id, navigate]);

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    function reload() {
      void load();
    }
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === CHECKLIST_FILLED_MESSAGE && (!e.data.projectId || e.data.projectId === id)) reload();
    }
    window.addEventListener("message", onMsg);
    window.addEventListener(CHECKLIST_FILLED_MESSAGE, reload);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener(CHECKLIST_FILLED_MESSAGE, reload);
    };
  }, [id, token]);

  const selected = data?.inspections?.find((i: any) => i.id === active);
  const canFillSelected =
    !!selected &&
    selected.status !== "Closed" &&
    (canManage || selected.assignedToId === user?.id || selected.assignedTo?.id === user?.id);
  const pageTitle = sheetView.label;
  const pageSubtitle = `${sheetView.sheet} — Quality Dashboard / NCR / Cube register layout. Checklist fills map to DPR Quality section.`;

  const isQualityRegister = QUALITY_REGISTER_SHEETS.has(sheetKey);
  const useQualityPageScroll = QUALITY_PAGE_SCROLL_SHEETS.has(sheetKey);

  async function submitNcrAdd(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!ncrForm.contractorVendorId && !ncrForm.contractor?.trim()) {
      setMsg("Select a contractor / company on notice — they receive the NCR/CAR form link by email.");
      return;
    }
    const vendor = projectVendors.find((v) => v.vendorId === ncrForm.contractorVendorId);
    setNcrAddBusy(true);
    try {
      const created = await api<any>(`/api/checklist/project/${id}/ncr`, {
        method: "POST",
        token,
        body: JSON.stringify({
          kind: ncrForm.kind,
          number: ncrForm.number || undefined,
          ncrType: ncrForm.ncrType || (ncrForm.kind === "CAR" ? "Corrective Action" : "General"),
          description: ncrForm.description,
          location: ncrForm.location || undefined,
          contractor: ncrForm.contractor || undefined,
          contractorVendorId: ncrForm.contractorVendorId || undefined,
          issueDate: ncrForm.issueDate || undefined,
          plannedClosure: ncrForm.plannedClosure || undefined,
          actionRequired: ncrForm.actionRequired || undefined,
          formDataJson: {
            projectName: project?.name || project?.code || "",
            toParty: ncrForm.toParty || ncrForm.contractor || "",
            fromParty: ncrForm.fromParty || "Sharnam Project Development Consultants & Co.",
            actionRequired: ncrForm.actionRequired || "",
            environmentalIssues: ncrForm.environmentalIssues || "",
            otherCause: ncrForm.otherCause || ncrForm.ncrType || "",
          },
        }),
      });
      setNcrForm({
        kind: ncrForm.kind,
        number: "",
        ncrType: "",
        description: "",
        location: "",
        contractor: "",
        contractorVendorId: "",
        issueDate: new Date().toISOString().slice(0, 10),
        plannedClosure: "",
        actionRequired: "",
        toParty: "",
        fromParty: "Sharnam Project Development Consultants & Co.",
        environmentalIssues: "",
        otherCause: "",
      });
      setNcrAddOpen(false);
      const emailNote = vendor?.vendor?.email
        ? ` Email sent to ${vendor.vendor.email}.`
        : vendor
          ? " Selected contractor has no email on file — add email under Project → Vendors."
          : "";
      setMsg(
        `${created.number || ncrForm.kind} logged on NCR/CAR register — stakeholder email sent.${emailNote} Opening form to download / fill / resolve.`
      );
      await load();
      openNcrFormWindow(id, "quality", created.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setNcrAddBusy(false);
    }
  }

  return (
    <div
      className={`min-w-0 ${
        useQualityPageScroll
          ? "quality-module page-scroll-full flex flex-col gap-4 pb-8 w-full"
          : isQualityRegister
            ? "quality-page spdc-register-page page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2"
            : "quality-module space-y-4"
      }`}
    >
      <div className={isQualityRegister && !useQualityPageScroll ? "shrink-0 space-y-2" : undefined}>
      <PageHeader
        dense={isQualityRegister}
        eyebrow="Quality module"
        title={pageTitle}
        subtitle={sheetKey === "cube-test" ? "SPDC cube register — project, PMC and client are editable in the sheet header." : pageSubtitle}
      />
      </div>

      {sheetKey === "" && (
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3 -mt-1 shrink-0">
        <Badge tone="warn">{dash?.totals?.openInspections ?? 0} open F-01 requests</Badge>
        <Link to={`/projects/${id}/qap`}>
          <Badge tone="brand">{dash?.totals?.qapOpen ?? 0} QAP open</Badge>
        </Link>
        <Link to={`/projects/${id}/qap`}>
          <Badge tone="ok">{dash?.totals?.qapDone ?? 0} QAP done</Badge>
        </Link>
        {id ? <ReportExportButtons projectId={id} kind="quality" compact label="Quality pack" /> : null}
      </div>
      )}

      <StatusNote msg={msg} className="shrink-0" />

      {sheetKey === "" && dash && (
        <div className="space-y-4">
          {project && (
            <RegisterBrandHeader
              title="Quality dashboard"
              project={project}
              token={token}
              canEdit={canManage}
              onProjectUpdated={() => void load()}
            />
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              ["Week", dash.workbook?.dashboard?.weekLabel ?? "—"],
              ["Concreting this week (m³)", dash.weekCharts?.concretingM3 ?? 0],
              ["Samples last week", dash.workbook?.dashboard?.samplesLastWeek ?? 0],
              ["QI checklist fills", dash.totals.fills],
              ["Open QI", dash.totals.openInspections],
              ["Open NCRs", dash.totals.openNcrs ?? 0],
            ].map(([l, v]) => (
              <Card key={l as string} className="!p-4 border-brand/20">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-2xl font-display mt-1">{v as string | number}</div>
              </Card>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              ["Cubes (pass)", `${dash.totals.cubesPass ?? 0}/${dash.totals.cubes ?? 0}`, null],
              ["Open fill RFIs", dash.totals.openFillRfis, null],
              ["QAP open / done", `${dash.totals.qapOpen} / ${dash.totals.qapDone}`, `/projects/${id}/qap`],
              ["Site execution fills", dash.totals.siteExecutionFills ?? 0, null],
              ["Drawing-check fills", dash.totals.drawingCheckFills ?? 0, `/projects/${id}/drawings/checklist-logs`],
              ["Requested fills", dash.totals.requestedFills ?? 0, `/projects/${id}/quality/checklist-logs`],
            ].map(([l, v, href]) =>
              href ? (
                <Link key={l as string} to={href} className="block">
                  <Card className="!p-4 hover:border-brand/40 transition-colors">
                    <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                    <div className="text-2xl font-display mt-1">{v as string | number}</div>
                  </Card>
                </Link>
              ) : (
                <Card key={l as string} className="!p-4">
                  <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                  <div className="text-2xl font-display mt-1">{v as string | number}</div>
                </Card>
              )
            )}
          </div>
          <div className="rounded-lg border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">Quality Dashboard.xlsx</p>
                <h3 className="font-display text-lg text-ink">
                  Quality Performance Report — Week {weekNo}
                  <span className="text-sm text-steel-muted font-sans"> · {new Date(`${weekStart}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} to {new Date(`${weekEnd}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </h3>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => shiftWeek(-1)}>
                  ← Previous week
                </Button>
                <label className="text-xs text-steel-muted">
                  Week starting
                  <input
                    type="date"
                    className="mt-1 block rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
                    value={weekStart}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const d = new Date(`${e.target.value}T00:00:00`);
                      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                      setWeekStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                    }}
                  />
                </label>
                <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => shiftWeek(1)}>
                  Next week →
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                ["Checklist fills", dash.weekCharts?.kpis?.fills ?? 0],
                ["Cube sets cast", dash.weekCharts?.kpis?.setsCast ?? 0],
                ["Failed at 7 days (this week)", dash.weekCharts?.kpis?.fail7 ?? 0],
                ["Failed at 28 days (open)", dash.weekCharts?.kpis?.fail28 ?? 0],
                ["Observations raised", dash.weekCharts?.kpis?.observations ?? 0],
                ["Open NCRs (all)", dash.weekCharts?.kpis?.openNcrs ?? 0],
              ].map(([l, v]) => (
                <Card key={l as string} className="!p-3">
                  <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                  <div className="text-xl font-display mt-1">{v as string | number}</div>
                </Card>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                ["Concrete poured (m³)", dash.weekCharts?.concretingM3 ?? 0, "From DPR concrete / RCC / PCC lines this week"],
                ["Site observation success rate", dash.weekCharts?.successRates?.siteObservation != null ? `${dash.weekCharts.successRates.siteObservation}%` : "—", "Closed ÷ raised, project to date"],
                ["Site instruction success rate", dash.weekCharts?.successRates?.siteInstruction != null ? `${dash.weekCharts.successRates.siteInstruction}%` : "—", "Closed ÷ issued, project to date"],
              ].map(([l, v, h]) => (
                <Card key={l as string} className="!p-3">
                  <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                  <div className="text-xl font-display mt-1">{v as string | number}</div>
                  <div className="text-[10px] text-steel-muted">{h}</div>
                </Card>
              ))}
            </div>
            <Card padding={false}>
              <div className="px-4 py-2.5 border-b border-line bg-sand/40 flex items-center justify-between">
                <span className="font-semibold text-sm">Bad Quality Practice — Week {weekNo}</span>
                <Link to={`/projects/${id}/inspections?sheet=site-observation`} className="text-xs font-semibold text-brand">Site observations →</Link>
              </div>
              {(dash.weekCharts?.badPractice || []).length ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 p-3">
                  {dash.weekCharts.badPractice.map((b: any) => (
                    <div key={b.id} className="rounded-lg border border-line overflow-hidden bg-white">
                      {b.photos?.[0] ? (
                        <a href={mediaUrl(b.photos[0].url)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(b.photos[0].url)} alt={b.title} className="w-full h-32 object-cover" />
                        </a>
                      ) : (
                        <div className="h-32 grid place-items-center text-[11px] text-steel-muted bg-sand/30">No photo</div>
                      )}
                      <div className="p-2 text-xs">
                        <div className="font-semibold truncate">{b.title}</div>
                        <div className="text-steel-muted">
                          {b.type} · {b.location || "—"} · {b.status}
                          {b.photos?.length > 1 ? ` · ${b.photos.length} photos` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-steel-muted">No high-severity or photographed observations this week.</p>
              )}
            </Card>
            {(dash.weekCharts?.kpis?.ncDue || []).length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <div className="font-semibold mb-1">28-day cube failures — raise an NCR</div>
                <ul className="list-disc ml-5 space-y-0.5 text-xs">
                  {dash.weekCharts.kpis.ncDue.map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <Link to={`/projects/${id}/quality/ncr-fill-log`} className="inline-block mt-2 text-xs font-semibold underline">
                  Open NCR / CAR →
                </Link>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4 items-start">
              <ColumnChart
                title="Observations this week — open vs closed"
                subtitle="SOR log: site observations, instructions, NCR / CAR"
                items={dash.weekCharts?.sorOpenClosed || []}
                series={[
                  { key: "open", label: "Open", color: CHART_COLORS.red },
                  { key: "closed", label: "Closed", color: CHART_COLORS.green },
                ]}
                yLabel="Count"
                emptyText="No observations raised this week."
              />
              <LineChart
                title="Cube compressive strength — 7 days"
                subtitle="Set average (3 cubes) against the 7-day limit, N/mm²"
                items={dash.weekCharts?.cubeSeries || []}
                series={[
                  { key: "strength", label: "Compressive strength", color: CHART_COLORS.navy },
                  { key: "limit", label: "7-day limit (IS / SPDC)", color: CHART_COLORS.orange },
                ]}
                yLabel="N/mm²"
                emptyText="No cube results yet."
              />
              <ColumnChart
                title="Cube compressive strength — 28 days"
                subtitle="Set average against the grade (fck), N/mm²"
                items={dash.weekCharts?.cubeSets28 || []}
                series={[
                  { key: "avg28", label: "28-day average", color: CHART_COLORS.navy },
                  { key: "fck", label: "Grade (fck)", color: CHART_COLORS.orange },
                ]}
                yLabel="N/mm²"
                emptyText="No 28-day results yet."
              />
              <ColumnChart
                title="Checklist fills by day"
                items={dash.weekCharts?.fillsByDay || []}
                series={[{ key: "value", label: "Fills", color: CHART_COLORS.teal }]}
                yLabel="Fills"
                emptyText="No checklist fills this week."
              />
              <ColumnChart
                title="Checklist fills by discipline"
                items={dash.weekCharts?.fillsByDiscipline || []}
                series={[{ key: "value", label: "Fills", color: CHART_COLORS.blue }]}
                yLabel="Fills"
                emptyText="No checklist fills this week."
              />
              <ColumnChart
                title="NCR / CAR raised this week by status"
                items={dash.weekCharts?.ncrByStatus || []}
                series={[{ key: "value", label: "NCR / CAR", color: CHART_COLORS.orange }]}
                yLabel="Count"
                emptyText="No NCR / CAR raised this week."
              />
              <PieChart title="QAP status (latest week sheet)" items={dash.charts?.byQapStatus || []} />
            </div>
            <details className="rounded-lg border border-line bg-white p-3">
              <summary className="text-xs font-semibold text-steel-muted cursor-pointer">All-time totals</summary>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
                <PieChart title="NCR / CAR status" items={dash.charts?.byNcrStatus || []} />
                <PieChart title="SOR register by status" items={dash.charts?.sorByStatus || []} />
                <PieChart title="Cube test results" items={dash.charts?.byCubeResult || []} />
              </div>
            </details>
          </div>
          {dash.reportMapping && (
            <Card className="text-xs text-steel-muted">
              <h3 className="font-semibold text-sm text-ink mb-2">Which fills update Progress Reports (DPR / WPR)?</h3>
              <ul className="grid sm:grid-cols-2 gap-1.5">
                {Object.entries(dash.reportMapping).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-semibold text-ink">{k}</span> → {String(v)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {sheetKey === "sor-log" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <SorLogPanel
          projectId={id!}
          summary={dash?.workbook?.sorLog || []}
          entries={dash?.sorEntries || []}
        />
        </div>
      )}

      {sheetKey === "checklist-summary" && dash && (
        <QualityChecklistSummaryPanel
          projectId={id!}
          token={token}
          dash={dash}
          canManage={canManage}
          onChanged={load}
        />
      )}

      {sheetKey === "car-register" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
          <div className="shrink-0">
        <ReferenceSheetToolbar
          sheetLabel="NCR / CAR register — Quality Dashboard"
          rowCount={dash?.ncrs?.length}
          canEdit={canManage}
          message={msg || undefined}
          onAddRow={canManage ? () => setNcrAddOpen(true) : undefined}
        />
        </div>
        <Card padding={false} className="register-table-panel spdc-register-panel register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line shrink-0 flex flex-wrap items-start justify-between gap-2">
          <div>
          <h3 className="font-semibold mb-1">NCR / CAR register (Quality Dashboard · NCR 01)</h3>
          <p className="text-xs text-steel-muted mb-1">
            <strong>NCR</strong> = Non-Conformance Report · <strong>CAR</strong> = Corrective Action Request — form follows NCR 01.xlsx
          </p>
          {id && (
            <a href={`/projects/${id}/quality/ncr-fill-log`} className="text-xs font-semibold text-brand underline">
              Open NCR / CAR fill log →
            </a>
          )}
          </div>
          {isOfficeAdmin && id && (
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={async () => {
                try {
                  const out = await api<{ synced: number }>(`/api/checklist/project/${id}/ncr/sync-sharepoint`, {
                    method: "POST",
                    token,
                  });
                  setMsg(`SharePoint synced — ${out.synced} NCR/CAR form(s) + register. Nightly day-close also runs after hours.`);
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Sync failed");
                }
              }}
            >
              Sync SharePoint
            </Button>
          )}
          </div>
          <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
            <table className="sheet-register__table min-w-[40rem] w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left">No.</th>
                  <th className="text-left">NCR Issue Date</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Contractor</th>
                  <th className="text-left">Brief Description of Non Conformance</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Planned Closure</th>
                  <th className="text-left">Actual Closure</th>
                  <th className="text-left">Compliance</th>
                  <th className="text-left">Status</th>
                  {canManage && <th className="text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {(dash?.ncrs || []).map((n: any) => {
                  const compliance = ncrComplianceSummary(n.formDataJson);
                  return (
                  <tr key={n.id}>
                    <td className="text-left font-mono text-xs">{n.number}</td>
                    <td className="text-left text-xs whitespace-nowrap">
                      {n.issueDate ? String(n.issueDate).slice(0, 10) : "—"}
                    </td>
                    <td className="text-left">{n.ncrType || "—"}</td>
                    <td className="text-left text-xs">{n.contractor || "—"}</td>
                    <td className="text-left max-w-md">{n.description}</td>
                    <td className="text-left text-xs">{n.location || "—"}</td>
                    <td className="text-left text-xs whitespace-nowrap">
                      {n.plannedClosure ? String(n.plannedClosure).slice(0, 10) : "—"}
                    </td>
                    <td className="text-left text-xs whitespace-nowrap">
                      {n.actualClosure ? String(n.actualClosure).slice(0, 10) : "—"}
                    </td>
                    <td className="text-left">
                      <Badge tone={compliance.tone}>{compliance.label}</Badge>
                      {compliance.followUpCount > 0 && (
                        <span className="block text-[10px] text-steel-muted font-mono mt-0.5">
                          {compliance.followUpCount} follow-up{compliance.followUpCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="text-left">
                      <button
                        type="button"
                        className="inline-flex"
                        onClick={() => n.status === "Open" && id && openNcrFormWindow(id, "quality", n.id)}
                        title={n.status === "Open" ? "Open NCR form (NCR 01)" : undefined}
                      >
                        <Badge tone={n.status === "Open" ? "warn" : "ok"}>{n.status}</Badge>
                      </button>
                    </td>
                    {canManage && (
                      <td className="text-left space-x-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !px-2 !text-xs"
                          onClick={() => id && openNcrFormWindow(id, "quality", n.id)}
                        >
                          {n.status === "Open" ? "Fill form" : "View form"}
                        </Button>
                        {isOfficeAdmin && n.status === "Open" && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="!py-1 !px-2 !text-xs"
                            onClick={async () => {
                              if (!id) return;
                              const isCar = /^CAR/i.test(n.number || "");
                              try {
                                await api(`/api/checklist/project/${id}/ncr/${n.id}/follow-up`, {
                                  method: "POST",
                                  token,
                                  body: JSON.stringify({}),
                                });
                                setMsg(`${isCar ? "CAR" : "NCR"} follow-up sent for ${n.number}`);
                                await load();
                              } catch (err) {
                                setMsg(err instanceof Error ? err.message : "Follow-up failed");
                              }
                            }}
                          >
                            {/^CAR/i.test(n.number || "") ? "CAR follow-up" : "NCR follow-up"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !px-2 !text-xs"
                          onClick={() =>
                            void downloadAuthFile(
                              `/api/checklist/project/${id}/ncr/${n.id}/export.xlsx`,
                              token,
                              `${n.number || "NCR"}.xlsx`
                            )
                          }
                        >
                          Excel
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !px-2 !text-xs"
                          onClick={() =>
                            void downloadAuthFile(
                              `/api/checklist/project/${id}/ncr/${n.id}/export.pdf`,
                              token,
                              `${n.number || "NCR"}.pdf`
                            )
                          }
                        >
                          PDF
                        </Button>
                      </td>
                    )}
                  </tr>
                  );
                })}
                {!dash?.ncrs?.length && (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="empty text-left">
                      No NCR rows yet — raise one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <RegisterEntryModal
          open={ncrAddOpen && canManage}
          title="Raise NCR / CAR — SPDC NCR 01"
          size="3xl"
          onClose={() => setNcrAddOpen(false)}
          saving={ncrAddBusy}
          saveLabel={ncrForm.kind === "CAR" ? "Raise CAR" : "Raise NCR"}
          onSave={() => ncrAddFormRef.current?.requestSubmit()}
        >
          <form ref={ncrAddFormRef} className="ncr01-raise space-y-3" onSubmit={submitNcrAdd}>
            <p className="text-xs text-steel-muted leading-relaxed">
              Matches <strong>NCR 01.xlsx · NCR CAR</strong> sheet.{" "}
              <strong>NCR</strong> = Non-Conformance Report · <strong>CAR</strong> = Corrective Action Request.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="ncr01-field">
                <span>Document</span>
                <Select
                  value={ncrForm.kind}
                  onChange={(e) => setNcrForm({ ...ncrForm, kind: e.target.value as "NCR" | "CAR" })}
                >
                  <option value="NCR">NCR — Non-Conformance Report</option>
                  <option value="CAR">CAR — Corrective Action Request</option>
                </Select>
              </label>
              <label className="ncr01-field">
                <span>NCR / CAR No. (optional — auto if blank)</span>
                <Input value={ncrForm.number} onChange={(e) => setNcrForm({ ...ncrForm, number: e.target.value })} placeholder="NCR-001 / CAR-001" />
              </label>
              <label className="ncr01-field">
                <span>Date</span>
                <Input type="date" value={ncrForm.issueDate} onChange={(e) => setNcrForm({ ...ncrForm, issueDate: e.target.value })} required />
              </label>
              <label className="ncr01-field">
                <span>Date by which action must be completed</span>
                <Input type="date" value={ncrForm.plannedClosure} onChange={(e) => setNcrForm({ ...ncrForm, plannedClosure: e.target.value })} />
              </label>
              <label className="ncr01-field">
                <span>To (company on notice)</span>
                <Select
                  value={ncrForm.contractorVendorId}
                  onChange={(e) => {
                    const vid = e.target.value;
                    const link = projectVendors.find((v) => v.vendorId === vid);
                    const name = link?.vendor?.name || ncrForm.contractor;
                    setNcrForm({
                      ...ncrForm,
                      contractorVendorId: vid,
                      contractor: name,
                      toParty: name,
                    });
                  }}
                  required={!ncrForm.contractor.trim()}
                >
                  <option value="">Select contractor…</option>
                  {projectVendors.map((pv) => (
                    <option key={pv.vendorId} value={pv.vendorId}>
                      {pv.vendor?.name || pv.vendorId}
                      {pv.vendor?.email ? ` · ${pv.vendor.email}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="ncr01-field">
                <span>To — name if not in list</span>
                <Input
                  value={ncrForm.contractor}
                  onChange={(e) => setNcrForm({ ...ncrForm, contractor: e.target.value, toParty: e.target.value })}
                  placeholder="Contractor / agency name"
                />
              </label>
              <label className="ncr01-field">
                <span>From (PMC)</span>
                <Input value={ncrForm.fromParty} onChange={(e) => setNcrForm({ ...ncrForm, fromParty: e.target.value })} />
              </label>
              <label className="ncr01-field">
                <span>Location</span>
                <Input value={ncrForm.location} onChange={(e) => setNcrForm({ ...ncrForm, location: e.target.value })} placeholder="Grid / area / structure" />
              </label>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-steel-muted pt-1">
              Action Required as a Result of
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="ncr01-field">
                <span>Environmental Issues</span>
                <Input
                  value={ncrForm.environmentalIssues}
                  onChange={(e) => setNcrForm({ ...ncrForm, environmentalIssues: e.target.value })}
                  placeholder="— if none"
                />
              </label>
              <label className="ncr01-field">
                <span>Type (register)</span>
                <Select value={ncrForm.ncrType} onChange={(e) => setNcrForm({ ...ncrForm, ncrType: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="General">General</option>
                  <option value="Workmanship">Workmanship</option>
                  <option value="Material">Material</option>
                  <option value="Documentation">Documentation</option>
                  <option value="Dimensional">Dimensional</option>
                  <option value="Schedule">Schedule</option>
                  <option value="Safety">Safety</option>
                  <option value="Corrective Action">Corrective Action</option>
                  <option value="Other">Other</option>
                </Select>
              </label>
              <label className="ncr01-field sm:col-span-2">
                <span>Other</span>
                <Input
                  value={ncrForm.otherCause}
                  onChange={(e) => setNcrForm({ ...ncrForm, otherCause: e.target.value })}
                  placeholder="e.g. General — Project Schedule & Mix Design"
                />
              </label>
            </div>
            <label className="ncr01-field">
              <span>Description of the problem which requires rectification</span>
              <TextArea
                rows={4}
                value={ncrForm.description}
                onChange={(e) => setNcrForm({ ...ncrForm, description: e.target.value })}
                required
              />
            </label>
            <label className="ncr01-field">
              <span>Action required to rectify the problem (and prevent recurrence)</span>
              <TextArea
                rows={3}
                value={ncrForm.actionRequired}
                onChange={(e) => setNcrForm({ ...ncrForm, actionRequired: e.target.value })}
              />
            </label>
            {!projectVendors.length && (
              <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                Assign contractors under Project → Vendors first — they receive the form link by email when raised.
              </p>
            )}
          </form>
        </RegisterEntryModal>
        </div>
      )}

      {sheetKey === "site-observation" && id && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <QualitySiteRegister
          projectId={id}
          token={token}
          recordType="Site Observation"
          canEdit={canManage}
          onChanged={load}
        />
        </div>
      )}

      {sheetKey === "site-instruction" && id && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <QualitySiteRegister
          projectId={id}
          token={token}
          recordType="Site Instruction"
          canEdit={canManage}
          onChanged={load}
        />
        </div>
      )}

      {sheetKey === "cube-test" && id && (
        <div className="cube-sheet-page quality-module page-scroll-full flex flex-col gap-3 pb-8 min-w-0 w-full">
          <WorkflowStrip
            active={2}
            steps={[
              { label: "Cast & register", hint: "Footing groups + 7D/28D" },
              { label: "Lab results", hint: "Inline edit strength" },
              { label: "Download", hint: "XLSX / PDF" },
              { label: "DPR link", hint: "Cube stats on quality dashboard" },
            ]}
          />
          <div className="shrink-0">
          <ReferenceSheetToolbar
            sheetLabel="SPDC Cube Register"
            rowCount={dash?.cubes?.length}
            canEdit={canManage}
            message={msg || undefined}
            onAddRow={canManage ? () => setCubeAddOpen(true) : undefined}
            uploadHint="Import the client SPDC CUBE REGISTER .xlsx (columns B–M)."
            onUpload={
              canManage
                ? async (file) => {
                    if (!id || !/\.xlsx?$/i.test(file.name)) {
                      setMsg("Upload an SPDC CUBE REGISTER .xlsx file");
                      return;
                    }
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("replace", "1");
                    const out = await api<{ imported: number; groups: number }>(
                      `/api/checklist/project/${id}/cubes/import`,
                      { method: "POST", token, body: fd }
                    );
                    setMsg(`Imported ${out.imported} specimens (${out.groups} groups)`);
                    await load();
                  }
                : undefined
            }
            onDownloadXlsx={async () => {
              if (!id) return;
              await downloadAuthFile(`/api/checklist/project/${id}/cubes/download.xlsx`, token, `Cube-Register-${project?.code || id}.xlsx`);
            }}
            onDownloadHtml={async () => {
              if (!id) return;
              await downloadAuthFile(`/api/checklist/project/${id}/cubes/download.html`, token, `Cube-Register-${project?.code || id}.html`);
            }}
          />
          </div>
          <div className="cube-page__register flex flex-col min-w-0">
            <CubeRegisterPanel
              projectId={id}
              token={token}
              rows={dash?.cubes || []}
              canEdit={canManage}
              onChanged={load}
              project={project}
              addOpen={cubeAddOpen}
              onAddClose={() => setCubeAddOpen(false)}
              onProjectUpdated={load}
            />
          </div>
        </div>
      )}

      {sheetKey === "qi" && (
        <>
      <WorkflowStrip
        active={1}
        steps={[
          { label: "Raise QI", hint: "Pick checklist template" },
          { label: "Mark Ready", hint: "Assignee fills form" },
          { label: "Pass / Fail", hint: "≥3 photos" },
          { label: "Close", hint: "Or request QI fill" },
        ]}
      />

      {canManage && (
        <SpdcInspectionFormPanel
          key={`qi-ir-${project?.id || "loading"}-${project?.clientName || ""}-${project?.contractorName || ""}`}
          formKind="QualityIR"
          users={users}
          checklistAssignments={qiAssignments}
          masterHref={`/projects/${id}/quality/checklist-master`}
          project={project || undefined}
          busy={irBusy}
          onSubmit={async (payload) => {
            setIrBusy(true);
            setMsg("");
            try {
              await api(`/api/rfis/project/${id}`, {
                method: "POST",
                token,
                body: JSON.stringify({
                  subject: payload.subject,
                  question: payload.question,
                  rfiKind: payload.rfiKind,
                  irNumber: payload.irNumber || null,
                  formDataJson: payload.formDataJson,
                  assignedToId: payload.assignedToId || null,
                  linkedAssignmentId: payload.linkedAssignmentId || null,
                  linkedChecklistItemId: qiAssignments.find((a) => a.id === payload.linkedAssignmentId)?.template?.id || null,
                  linkedDrawingId: null,
                }),
              });
              setMsg("Request for Inspection (SPDC/QA/F-01) raised — it is in the Inspection register.");
              await load();
            } finally {
              setIrBusy(false);
            }
          }}
        />
      )}
      <StatusNote msg={msg} className="mt-2" />

      {canManage && (
        <details className="rounded-xl border border-line bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-steel-muted select-none">Quick checklist inspection (internal, no F-01 form)</summary>
        <Card>
          <h3 className="font-semibold mb-3">Raise inspection</h3>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                const created = await api<any>(`/api/inspections/project/${id}`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    title: form.title,
                    inspectionType: form.inspectionType,
                    checklistTemplateId: form.checklistTemplateId || null,
                    assignedToId: form.assignedToId || null,
                    dueDate: form.dueDate || null,
                    location: form.location,
                    status: "Draft",
                  }),
                });
                setActive(created.id);
                setMsg("Inspection created as Draft — mark Ready when the checklist form should be filled.");
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              className="sm:col-span-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Inspection title"
              required
            />
            <Select value={form.inspectionType} onChange={(e) => setForm({ ...form, inspectionType: e.target.value })}>
              {["Quality Inspection", "Quality Action Plan", "Safety", "Handover"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select
              value={form.checklistTemplateId}
              onChange={(e) => setForm({ ...form, checklistTemplateId: e.target.value })}
            >
              <option value="">Checklist template (optional → form lines)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
              <option value="">Assignee</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} · {u.role}
                </option>
              ))}
            </Select>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button type="submit" className="sm:col-span-2 lg:col-span-3">
              Create draft inspection
            </Button>
          </form>
        </Card>
        </details>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <Card padding={false}>
          <div className="px-4 py-3 border-b font-semibold bg-sand/40">Inspections</div>
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {data?.inspections?.map((i: any) => (
              <button
                key={i.id}
                type="button"
                className={`w-full text-left px-4 py-3 ${active === i.id ? "bg-brand-soft" : ""}`}
                onClick={() => setActive(i.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-sm">{i.title}</span>
                  <Badge tone={i.status === "Ready" || i.status === "Closed" ? "ok" : "warn"}>{i.status}</Badge>
                </div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {i.location || "Site"} · {i.assignedTo?.fullName || "Unassigned"} · {i.items?.length || 0} lines
                </div>
              </button>
            ))}
            {!data?.inspections?.length && <li className="p-4 text-sm text-steel-muted">No inspections yet.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select an inspection</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl">{selected.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge>{selected.status}</Badge>
                  <Badge tone="neutral">{selected.inspectionType}</Badge>
                  {selected.location && <Badge tone="brand">{selected.location}</Badge>}
                </div>
                <p className="text-sm text-steel-muted mt-2">
                  Assignee: {selected.assignedTo?.fullName || "—"} · By {selected.createdBy?.fullName}
                  {canFillSelected && !canManage ? " · You can fill this checklist" : ""}
                </p>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {selected.status === "Draft" && (
                    <Button
                      type="button"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "Ready" }),
                        });
                        await load();
                      }}
                    >
                      Mark Ready (form open)
                    </Button>
                  )}
                  {selected.status === "Ready" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "In Progress" }),
                        });
                        await load();
                      }}
                    >
                      Start fill
                    </Button>
                  )}
                  {selected.status !== "Closed" && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "Closed" }),
                        });
                        await load();
                      }}
                    >
                      Close
                    </Button>
                  )}
                  <Link to={`/projects/${id}/dms`} className="text-sm font-semibold text-brand self-center">
                    Open Inspections folder →
                  </Link>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm mb-2">Checklist form lines</h3>
                <ul className="space-y-3">
                  {selected.items?.map((it: any) => {
                    let attachments: { url: string; name: string; kind: string; comment?: string }[] = [];
                    try {
                      attachments = JSON.parse(it.attachmentsJson || "[]");
                    } catch {
                      attachments = [];
                    }
                    return (
                      <li key={it.id} className="border border-line rounded-lg p-3 text-sm space-y-2">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{it.description}</span>
                          <div className="flex gap-1">
                            {canFillSelected &&
                              ["Pass", "Fail", "N/A", "Open"].map((st) => (
                              <button
                                key={st}
                                type="button"
                                className={`text-[11px] px-2 py-1 border rounded ${it.status === st ? "bg-brand text-white border-brand" : "border-line"}`}
                                onClick={async () => {
                                  await api(`/api/inspections/items/${it.id}`, {
                                    method: "PATCH",
                                    token,
                                    body: JSON.stringify({ status: st }),
                                  });
                                  await load();
                                }}
                              >
                                {st}
                              </button>
                            ))}
                            {!canFillSelected && (
                              <Badge tone={it.status === "Pass" ? "ok" : it.status === "Fail" ? "warn" : "neutral"}>
                                {it.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <TextArea
                          rows={2}
                          placeholder="Comment for this line"
                          defaultValue={it.remarks || ""}
                          readOnly={!canFillSelected}
                          onBlur={async (e) => {
                            if (!canFillSelected) return;
                            const remarks = e.target.value;
                            if (remarks === (it.remarks || "")) return;
                            await api(`/api/inspections/items/${it.id}`, {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ remarks }),
                            });
                            await load();
                          }}
                        />
                        <div className="grid sm:grid-cols-2 gap-2">
                          {canFillSelected && (
                          <label className="text-[11px] text-steel-muted block">
                            Photos / docs
                            <input
                              type="file"
                              multiple
                              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                              capture="environment"
                              className="block mt-1 text-xs w-full"
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (!files?.length) return;
                                const fd = new FormData();
                                Array.from(files).forEach((f) => fd.append("files", f));
                                if (it.remarks) fd.append("remarks", it.remarks);
                                await api(`/api/inspections/items/${it.id}/attachments`, {
                                  method: "POST",
                                  token,
                                  body: fd,
                                });
                                e.target.value = "";
                                await load();
                              }}
                            />
                          </label>
                          )}
                          <div className="text-[11px] text-steel-muted">
                            {attachments.length ? (
                              <ul className="space-y-1">
                                {attachments.map((a, idx) => (
                                  <li key={`${a.url}-${idx}`}>
                                    <a href={a.url} target="_blank" rel="noreferrer" className="text-brand font-medium">
                                      {a.kind === "photo" ? "Photo" : "Doc"}: {a.name}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              "No attachments yet"
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {canManage && (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/inspections/${selected.id}/items`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ description: itemText }),
                    });
                    setItemText("");
                    await load();
                  }}
                >
                  <Input className="flex-1" placeholder="Add form line" value={itemText} onChange={(e) => setItemText(e.target.value)} required />
                  <Button type="submit">Add</Button>
                </form>
              )}
            </div>
          )}
        </Card>
      </div>

      {dash?.recentFills?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Recent QI checklist fills → DPR Quality section</h3>
          <ul className="text-sm space-y-2">
            {dash.recentFills.slice(0, 8).map((f: any) => (
              <li key={f.id} className="flex flex-wrap justify-between gap-2 border-b border-line/60 pb-2">
                <span>{f.assignment?.template?.name || "Checklist"}</span>
                <span className="text-steel-muted text-xs">
                  {f.submittedBy?.fullName} · {new Date(f.createdAt).toLocaleDateString()} · {f.progress?.answered ?? 0}/{f.progress?.total ?? f.progress?.answered ?? 0} items answered
                </span>
              </li>
            ))}
          </ul>
          <Link to={`/projects/${id}/quality/checklist-logs`} className="inline-block mt-3 text-sm font-semibold text-brand">
            Open full QI fill log →
          </Link>
        </Card>
      )}
        </>
      )}
    </div>
  );
}

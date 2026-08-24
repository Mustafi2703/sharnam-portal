import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { RegisterEmptyRow } from "../../components/RegisterSheetFrame";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { safetySheetFromParams } from "../../lib/safetySheetViews";
import { openNcrFormWindow } from "../../lib/ncrFormFields";
import { HiraRegisterTable } from "../../components/HiraRegisterTable";

const TYPES = ["Observation", "Near Miss", "Incident", "Toolbox Talk", "JHA", "NCR", "Site Instruction"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const NCR_CATEGORIES = [
  "Working at height",
  "PPE non-compliance",
  "Housekeeping",
  "Electrical",
  "Scaffolding",
  "Excavation",
  "General",
];

const emptyForm = (ncrView: boolean) => ({
  recordType: ncrView ? "NCR" : "Observation",
  title: "",
  description: "",
  severity: "Medium",
  status: "Open",
  location: "",
  correctiveAction: "",
  ncrNumber: "",
  activityTask: "",
  category: "",
  rootCause: "",
  contributingFactors: "",
  immediateAction: "",
  longTermAction: "",
  responsibleParty: "",
  targetCompletion: "",
  timeImpact: "",
  costImpact: "",
  actionTaken: "",
  issuedTo: "",
  followUpDate: "",
});

export default function SafetyPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const sheetView = safetySheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const ncrView = sheetKey === "ncr-summary" || sheetKey === "ncr-form" || searchParams.get("view") === "ncr";
  const { token, user } = useAuth();
  const [data, setData] = useState<{ records: any[]; stats: any } | null>(null);
  const [dash, setDash] = useState<any>(null);
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm(ncrView));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const hiraAutoSyncRef = useRef(false);
  const canCreate = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const canEdit = canCreate;

  useEffect(() => {
    const defaultType =
      sheetKey === "site-instruction"
        ? "Site Instruction"
        : sheetKey === "hira"
          ? "JHA"
          : sheetKey === "ncr-summary" || sheetKey === "ncr-form"
            ? "NCR"
            : sheetKey === "observation" || sheetKey === "unsafe-act-summary"
              ? "Observation"
              : "Observation";
    setForm((f) => ({ ...emptyForm(ncrView), recordType: defaultType }));
    setFilter("All");
  }, [sheetKey, ncrView]);

  const load = async () => {
    const [res, d] = await Promise.all([
      api<{ records: any[]; stats: any }>(`/api/safety/project/${id}`, { token }),
      api(`/api/checklist/project/${id}/safety-dashboard`, { token }).catch(() => null),
    ]);
    setData(res);
    setDash(d);
    if (!active && res.records[0]) setActive(res.records[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const hiraRows = useMemo(
    () => (data?.records || []).filter((r) => r.recordType === "JHA"),
    [data]
  );

  useEffect(() => {
    if (sheetKey !== "hira" || !canCreate || !id) return;
    if (hiraRows.length >= 20) return;
    if (hiraAutoSyncRef.current) return;
    hiraAutoSyncRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        const out = await api<{ imported: number }>(`/api/safety/project/${id}/hira/sync-template`, {
          method: "POST",
          token,
        });
        setMsg(`Loaded ${out.imported} HIRA risk lines from Safety Dashboard.xlsx`);
        await load();
      } catch (err) {
        hiraAutoSyncRef.current = false;
        setMsg(err instanceof Error ? err.message : "HIRA template load failed");
      } finally {
        setBusy(false);
      }
    })();
  }, [sheetKey, hiraRows.length, canCreate, id, token]);

  const filtered = useMemo(() => {
    const rows = data?.records || [];
    if (sheetView.kpiOnly) return [];
    if (sheetView.filter) return rows.filter(sheetView.filter);
    if (filter === "All") return rows;
    if (filter === "Open" || filter === "Closed") return rows.filter((r) => r.status === filter);
    return rows.filter((r) => r.recordType === filter);
  }, [data, filter, sheetView]);

  const registerRows = filtered;
  const sheetHasRegister = !sheetView.kpiOnly && sheetKey !== "";
  const isRegisterSheet = sheetHasRegister && sheetKey !== "hira";

  useEffect(() => {
    if (!sheetHasRegister) return;
    if (filtered.length && !filtered.some((r) => r.id === active)) {
      setActive(filtered[0].id);
    }
  }, [sheetKey, filtered, active, sheetHasRegister]);

  async function createRecord(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const title =
        form.title ||
        (form.recordType === "NCR" && form.ncrNumber ? form.ncrNumber : `${form.recordType} — ${form.location || "Site"}`);
      const row = await api<any>(`/api/safety/project/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify({ ...form, title }),
      });
      setForm(emptyForm(ncrView));
      setAddOpen(false);
      setActive(row.id);
      setMsg(`${form.recordType} logged — feeds Safety dashboard and DPR/WPR safety block.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  const showNcrFields = ncrView || form.recordType === "NCR";
  const formTypes =
    sheetView.filter && sheetKey === "site-instruction"
      ? ["Site Instruction"]
      : sheetView.filter && sheetKey === "hira"
        ? ["JHA"]
        : sheetView.filter && (sheetKey === "ncr-summary" || sheetKey === "ncr-form")
          ? ["NCR"]
          : sheetView.filter && (sheetKey === "observation" || sheetKey === "unsafe-act-summary")
            ? ["Observation"]
            : TYPES;

  return (
    <div className={`min-w-0 ${isRegisterSheet || sheetKey === "hira" ? "page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden" : "space-y-4"}`}>
      <div className="shrink-0 space-y-2">
      <PageHeader
        dense
        eyebrow="Safety module"
        title={sheetView.label}
        subtitle={`${sheetView.sheet} — seeded from client Safety Dashboard / Safety NCR workbooks.`}
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between border-b border-line pb-3 -mt-1">
        <div className="flex flex-wrap gap-1.5 items-center">
          <Badge tone="warn">{dash?.totals?.open ?? data?.stats.open ?? 0} open</Badge>
          <Badge tone="danger">{dash?.totals?.incidents ?? data?.stats.incidents ?? 0} incidents</Badge>
          <Badge tone="brand">{sheetKey === "hira" ? hiraRows.length : filtered.length} in this sheet</Badge>
          <Badge tone="neutral">{dash?.totals?.checklistFills ?? 0} safety checklist fills</Badge>
          <ReportExportButtons projectId={id} kind="safety" compact />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-brand shrink-0">
          <Link to={`/projects/${id}/safety/checklist-logs`}>Safety fill log →</Link>
          <Link to={`/projects/${id}/safety/checklist-master`}>Safety checklist master →</Link>
          <Link to={`/projects/${id}/rfis?kind=SafetyChecklist`}>Raise Safety RFI →</Link>
        </div>
      </div>
      </div>

      {sheetView.kpiOnly && dash?.onePager && (
        <Card>
          <h3 className="font-semibold mb-3">Safety Hours — HSE indicators</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ["Safe man-hours (cumulative)", dash.onePager.safeManHours],
              ["Toolbox talks", dash.onePager.toolboxTalks],
              ["Site safety instructions", dash.onePager.siteInstructions],
              ["Incidents (one pager)", dash.onePager.totalIncidents],
              ["Unsafe acts (one pager)", dash.onePager.totalUnsafeActs],
              ["NCRs (one pager)", dash.onePager.totalNcrs],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-line p-3">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-xl font-display mt-1">{v as number}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!sheetView.kpiOnly && sheetKey === "" && dash && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              ["Incidents (sheet)", dash.onePager?.totalIncidents ?? dash.totals.incidents],
              ["Unsafe acts (sheet)", dash.onePager?.totalUnsafeActs ?? dash.totals.unsafeActs],
              ["NCRs (sheet)", dash.onePager?.totalNcrs ?? dash.totals.ncrLike],
              ["Safe man-hours", dash.onePager?.safeManHours ?? 0],
              ["Toolbox talks", dash.onePager?.toolboxTalks ?? 0],
              ["Site instructions", dash.onePager?.siteInstructions ?? dash.totals.siteInstructions],
            ].map(([l, v]) => (
              <Card key={l as string} className="!p-4 border-brand/20">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-2xl font-display mt-1">{v as number}</div>
              </Card>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              ["Total records", dash.totals.records],
              ["Open", dash.totals.open],
              ["NCR / NC", dash.totals.ncrLike],
              ["Unsafe acts", dash.totals.unsafeActs],
              ["Site instructions", dash.totals.siteInstructions],
              ["Checklist fills", dash.totals.checklistFills],
            ].map(([l, v]) => (
              <Card key={l as string} className="!p-4">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-2xl font-display mt-1">{v as number}</div>
              </Card>
            ))}
          </div>
          <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-3">
              Safety Dashboard.xlsx — one pager breakdown
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <PieChart title="By record type" items={dash.charts?.byType || []} />
              <PieChart title="By severity" items={dash.charts?.bySeverity || []} />
              <PieChart title="By status" items={dash.charts?.byStatus || []} />
            </div>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2 shrink-0">{msg}</p>}

      {sheetKey === "hira" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <HiraRegisterTable
          rows={hiraRows}
          activeId={active}
          onSelect={setActive}
          canEdit={canCreate}
          busy={busy}
          onLoadTemplate={async () => {
            if (!id) return;
            setBusy(true);
            setMsg("");
            try {
              const out = await api<{ imported: number }>(`/api/safety/project/${id}/hira/sync-template`, {
                method: "POST",
                token,
              });
              setMsg(`Loaded ${out.imported} HIRA risk lines from Safety Dashboard.xlsx`);
              await load();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "HIRA template load failed");
            } finally {
              setBusy(false);
            }
          }}
        />
        </div>
      )}

      {isRegisterSheet && (
        <>
        <div className="shrink-0 space-y-2">
        <ReferenceSheetToolbar
          sheetLabel={`${sheetView.label} — ${sheetView.sheet}`}
          rowCount={registerRows.length}
          canEdit={canCreate}
          busy={busy}
          message={msg || undefined}
          onAddRow={canCreate ? () => setAddOpen((v) => !v) : undefined}
        />

      {addOpen && canCreate && (
        <Card className="!p-3 shrink-0">
          <h3 className="font-semibold mb-2 text-sm">
            {showNcrFields ? "Raise Safety NCR" : `Log ${sheetView.label.toLowerCase()}`}
          </h3>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={createRecord}>
            <Select value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value })}>
              {formTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            {showNcrFields && (
              <>
                <Input
                  placeholder="NCR number (e.g. Safari-Safety NCR-001)"
                  value={form.ncrNumber}
                  onChange={(e) => setForm({ ...form, ncrNumber: e.target.value })}
                />
                <Input
                  placeholder="Activity / task"
                  value={form.activityTask}
                  onChange={(e) => setForm({ ...form, activityTask: e.target.value })}
                />
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Category</option>
                  {NCR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </>
            )}
            <Input
              className="lg:col-span-2"
              placeholder="Title (optional — auto from NCR no / location)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Issued to / contractor" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} />
            <Input
              placeholder="Responsible party"
              value={form.responsibleParty}
              onChange={(e) => setForm({ ...form, responsibleParty: e.target.value })}
            />
            <TextArea
              className="sm:col-span-2 lg:col-span-3"
              rows={2}
              placeholder="Description of non-conformity / observation"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
            {showNcrFields && (
              <>
                <TextArea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Root cause"
                  value={form.rootCause}
                  onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
                />
                <TextArea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Contributing factors"
                  value={form.contributingFactors}
                  onChange={(e) => setForm({ ...form, contributingFactors: e.target.value })}
                />
                <TextArea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Immediate corrective action"
                  value={form.immediateAction}
                  onChange={(e) => setForm({ ...form, immediateAction: e.target.value })}
                />
                <TextArea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Long-term corrective action"
                  value={form.longTermAction}
                  onChange={(e) => setForm({ ...form, longTermAction: e.target.value })}
                />
                <Input
                  type="date"
                  placeholder="Target completion"
                  value={form.targetCompletion}
                  onChange={(e) => setForm({ ...form, targetCompletion: e.target.value })}
                />
                <Input
                  type="date"
                  placeholder="Follow-up date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                />
                <Input
                  placeholder="Time impact (days)"
                  value={form.timeImpact}
                  onChange={(e) => setForm({ ...form, timeImpact: e.target.value })}
                />
                <Input
                  placeholder="Cost impact (INR)"
                  value={form.costImpact}
                  onChange={(e) => setForm({ ...form, costImpact: e.target.value })}
                />
              </>
            )}
            <Input
              placeholder="Corrective / action taken"
              value={form.correctiveAction || form.actionTaken}
              onChange={(e) => setForm({ ...form, correctiveAction: e.target.value, actionTaken: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2 lg:col-span-3">
              {form.recordType === "NCR" ? "Raise Safety NCR" : "Save safety record"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </form>
        </Card>
      )}

        <div className="flex flex-wrap gap-1">
          {["All", "Open", "Closed", ...TYPES].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium border ${
                filter === f ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        </div>

        <div className="register-tab-body">
        <Card padding={false} className="sheet-register register-table-panel spdc-register-panel register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="sheet-register__head shrink-0">
            <h3 className="font-semibold text-sm text-left">
              {sheetView.label} register ({sheetView.sheet})
            </h3>
          </div>
          <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
            <table className="sheet-register__table min-w-[48rem] w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Ref / title</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Status</th>
                  {canEdit && <th className="text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {registerRows.map((n) => (
                  <tr
                    key={n.id}
                    className={`cursor-pointer ${active === n.id ? "bg-brand-soft/40" : ""}`}
                    onClick={() => setActive(n.id)}
                  >
                    <td className="text-left font-mono text-xs">{n.ncrNumber || n.title}</td>
                    <td className="text-left">{n.recordType || "—"}</td>
                    <td className="text-left">{n.location || "—"}</td>
                    <td className="text-left">{n.category || "—"}</td>
                    <td className="text-left max-w-xs truncate">{n.description || "—"}</td>
                    <td className="text-left">
                      <button
                        type="button"
                        onClick={() =>
                          n.status === "Open" && n.recordType === "NCR" && id
                            ? openNcrFormWindow(id, "safety", n.id)
                            : setActive(n.id)
                        }
                      >
                        <Badge tone={n.status === "Open" ? "warn" : "ok"}>{n.status}</Badge>
                      </button>
                    </td>
                    {canEdit && (
                      <td className="text-left" onClick={(e) => e.stopPropagation()}>
                        {n.status === "Open" && n.recordType === "NCR" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="!py-1 !px-2 !text-xs"
                            onClick={() => id && openNcrFormWindow(id, "safety", n.id)}
                          >
                            Fill NCR form
                          </Button>
                        ) : n.status === "Open" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="!py-1 !px-2 !text-xs"
                            onClick={async () => {
                              await api(`/api/safety/${n.id}`, {
                                method: "PATCH",
                                token,
                                body: JSON.stringify({ status: "Closed" }),
                              });
                              setMsg(`${n.ncrNumber || n.title} closed`);
                              await load();
                            }}
                          >
                            Close
                          </Button>
                        ) : (
                          <span className="text-xs text-steel-muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!registerRows.length && (
                  <RegisterEmptyRow colSpan={canEdit ? 7 : 6} message="No rows for this sheet — use + Add row or upload Excel." />
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </div>
        </>
      )}

    </div>
  );
}

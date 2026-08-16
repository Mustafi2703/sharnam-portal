import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../../components/ui";
import { QUALITY_SHEET_VIEWS, qualitySheetFromParams } from "../../lib/qualitySheetViews";

/** Quality module — Quality Dashboard.xlsx sheet tabs + QI / checklist fills → DPR */
export default function InspectionsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetView = qualitySheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [qapForm, setQapForm] = useState({ weekLabel: "", activity: "", discipline: "" });
  const [ncrForm, setNcrForm] = useState({
    kind: "NCR" as "NCR" | "CAR",
    number: "",
    ncrType: "",
    description: "",
    location: "",
    contractor: "",
  });
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

  const load = async () => {
    const [insp, d, u, t, dashRes] = await Promise.all([
      api<{ inspections: any[]; canInspect: boolean; publishedDrawings: number }>(`/api/inspections/project/${id}`, {
        token,
      }),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/checklist/templates?type=QualityInspection", { token }).catch(() => []),
      api(`/api/checklist/project/${id}/quality-dashboard`, { token }).catch(() => null),
    ]);
    setData(insp);
    setDash(dashRes);
    setDrawings(d.filter((x) => x.isPublished));
    setUsers(u);
    const list = Array.isArray(t) ? t : [];
    setTemplates(list.slice(0, 50));
    if (!active && insp.inspections?.[0]) setActive(insp.inspections[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const selected = data?.inspections?.find((i: any) => i.id === active);
  const pageTitle = sheetView.label;
  const pageSubtitle = `${sheetView.sheet} — seeded from client Quality Dashboard / NCR / Cube workbooks. Checklist fills map to DPR Quality section.`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality module"
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="warn">{dash?.totals?.openInspections ?? 0} open QI</Badge>
            <Badge tone="brand">{dash?.totals?.qapOpen ?? 0} QAP open</Badge>
            <Badge tone="ok">{dash?.totals?.qapDone ?? 0} QAP done</Badge>
            <Link to={`/projects/${id}/quality/checklist-master`} className="text-sm font-semibold text-brand">
              Checklist master →
            </Link>
            <Link to={`/projects/${id}/quality/checklist-logs`} className="text-sm font-semibold text-brand">
              QI fill log →
            </Link>
            <Link to={`/projects/${id}/rfis?kind=QualityInspection`} className="text-sm font-semibold text-brand">
              Request QI fill →
            </Link>
            <Link to={`/projects/${id}/safety`} className="text-sm font-semibold text-brand">
              Safety →
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1">
        {QUALITY_SHEET_VIEWS.map((s) => (
          <button
            key={s.key || "dashboard"}
            type="button"
            onClick={() => setSearchParams(s.key ? { sheet: s.key } : {})}
            className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
              sheetKey === s.key ? "bg-brand text-white border-brand" : "bg-paper border-line text-ink"
            }`}
            title={s.sheet}
          >
            {s.label}
          </button>
        ))}
        <Link
          to={`/projects/${id}/hub/quality`}
          className="rounded-sm px-2.5 py-1.5 text-xs font-medium border border-line text-steel-muted"
        >
          Quality hub →
        </Link>
      </div>

      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      {sheetKey === "" && dash && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              ["Week", dash.workbook?.dashboard?.weekLabel ?? "—"],
              ["Concreting (m³)", dash.workbook?.dashboard?.concretingM3 ?? 0],
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
              ["Cubes (pass)", `${dash.totals.cubesPass ?? 0}/${dash.totals.cubes ?? 0}`],
              ["Open fill RFIs", dash.totals.openFillRfis],
              ["QAP open / done", `${dash.totals.qapOpen} / ${dash.totals.qapDone}`],
              ["Site execution fills", dash.totals.siteExecutionFills ?? 0],
            ].map(([l, v]) => (
              <Card key={l as string} className="!p-4">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-2xl font-display mt-1">{v as string | number}</div>
              </Card>
            ))}
          </div>
          <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-3">
              Quality Dashboard.xlsx — breakdown
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <PieChart title="NCR / CAR status" items={dash.charts?.byNcrStatus || []} />
              <PieChart title="Cube test results" items={dash.charts?.byCubeResult || []} />
              <PieChart title="QAP status" items={dash.charts?.byQapStatus || []} />
              <PieChart title="Checklist fills by discipline" items={dash.charts?.fillsByDiscipline || []} />
              <PieChart title="QI fills (last 14 days)" items={dash.charts?.fillsByDay || []} />
            </div>
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

      {sheetKey === "sor-log" && dash?.workbook?.sorLog?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">SOR Log (Quality Dashboard.xlsx)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-3">Observation type</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Open</th>
                  <th className="py-2 pr-3">Closed</th>
                  <th className="py-2">Closure rate</th>
                </tr>
              </thead>
              <tbody>
                {dash.workbook.sorLog.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-2 pr-3">{r.label}</td>
                    <td className="py-2 pr-3 font-mono">{r.total}</td>
                    <td className="py-2 pr-3">{r.open}</td>
                    <td className="py-2 pr-3">{r.closed}</td>
                    <td className="py-2 font-mono">{(r.closureRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sheetKey === "checklist-summary" && dash?.workbook && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Checklists filled by discipline (Sheet2)</h3>
            <ul className="space-y-2 text-sm">
              {(dash.workbook.checklistByDiscipline || []).map((r: any) => (
                <li key={r.discipline} className="flex justify-between border-b border-line/60 pb-1">
                  <span>{r.discipline}</span>
                  <span className="font-mono font-semibold">{r.filled}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Checklist catalog (Sheet1)</h3>
            <div className="max-h-[24rem] overflow-y-auto text-sm space-y-1">
              {(dash.workbook.checklistCatalog || []).slice(0, 30).map((r: any) => (
                <div key={r.srNo} className="border-b border-line/40 pb-1">
                  <span className="font-mono text-xs text-brand mr-2">{r.srNo}</span>
                  {r.name}
                  <span className="text-steel-muted text-xs ml-2">· {r.category}</span>
                </div>
              ))}
            </div>
            <Link to={`/projects/${id}/quality/checklist-master`} className="inline-block mt-3 text-sm font-semibold text-brand">
              Manage / add checklist line items →
            </Link>
          </Card>
        </div>
      )}

      {sheetKey === "car-register" && (
        <Card>
          <h3 className="font-semibold mb-3">NCR / CAR register (Quality Dashboard · NCR 01)</h3>
          {canManage && (
            <form
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 pb-4 border-b border-line"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(`/api/checklist/project/${id}/ncr`, {
                    method: "POST",
                    token,
                    body: JSON.stringify(ncrForm),
                  });
                  setNcrForm({
                    kind: ncrForm.kind,
                    number: "",
                    ncrType: "",
                    description: "",
                    location: "",
                    contractor: "",
                  });
                  setMsg(`${ncrForm.kind} raised — feeds DPR quality block and WPR quality slide`);
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <Select
                value={ncrForm.kind}
                onChange={(e) => setNcrForm({ ...ncrForm, kind: e.target.value as "NCR" | "CAR" })}
              >
                <option value="NCR">NCR (defect)</option>
                <option value="CAR">CAR (corrective action)</option>
              </Select>
              <Input
                placeholder="Number (optional — auto if blank)"
                value={ncrForm.number}
                onChange={(e) => setNcrForm({ ...ncrForm, number: e.target.value })}
              />
              <Input
                placeholder="Type (Workmanship / Material / …)"
                value={ncrForm.ncrType}
                onChange={(e) => setNcrForm({ ...ncrForm, ncrType: e.target.value })}
              />
              <TextArea
                className="sm:col-span-2 lg:col-span-3"
                placeholder="Description — what failed / corrective action required"
                value={ncrForm.description}
                onChange={(e) => setNcrForm({ ...ncrForm, description: e.target.value })}
                required
              />
              <Input
                placeholder="Location"
                value={ncrForm.location}
                onChange={(e) => setNcrForm({ ...ncrForm, location: e.target.value })}
              />
              <Input
                placeholder="Contractor"
                value={ncrForm.contractor}
                onChange={(e) => setNcrForm({ ...ncrForm, contractor: e.target.value })}
              />
              <Button type="submit">Raise {ncrForm.kind}</Button>
            </form>
          )}
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Status</th>
                  {canManage && <th className="py-2">Action</th>}
                </tr>
              </thead>
              <tbody>
                {(dash?.ncrs || []).map((n: any) => (
                  <tr key={n.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-mono text-xs">{n.number}</td>
                    <td className="py-2 pr-3">{n.ncrType || "—"}</td>
                    <td className="py-2 pr-3 max-w-md truncate">{n.description}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={n.status === "Open" ? "warn" : "ok"}>{n.status}</Badge>
                    </td>
                    {canManage && (
                      <td className="py-2">
                        {n.status === "Open" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="!py-1 !px-2 !text-xs"
                            onClick={async () => {
                              await api(`/api/checklist/project/${id}/ncr/${n.id}`, {
                                method: "PATCH",
                                token,
                                body: JSON.stringify({
                                  status: "Closed",
                                  actualClosure: new Date().toISOString().slice(0, 10),
                                }),
                              });
                              setMsg(`${n.number} closed`);
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
                {!dash?.ncrs?.length && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="py-6 text-steel-muted">
                      No NCR rows yet — run <code className="text-xs">npm run db:seed-quality-safety-demo</code> or raise one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sheetKey === "cube-test" && (
        <Card>
          <h3 className="font-semibold mb-3">Cube register (Quality Dashboard · SPDC Cube Register)</h3>
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-3">Sr</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Strength</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {(dash?.cubes || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-mono text-xs">{c.srNo || "—"}</td>
                    <td className="py-2 pr-3 max-w-md truncate">{c.description}</td>
                    <td className="py-2 pr-3">{c.grade || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{c.strength ?? "—"}</td>
                    <td className="py-2">
                      <Badge tone={/pass/i.test(c.result || "") ? "ok" : "warn"}>{c.result || "—"}</Badge>
                    </td>
                  </tr>
                ))}
                {!dash?.cubes?.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-steel-muted">
                      No cube rows seeded yet — re-seed from SPDC Cube Register.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sheetKey === "qap-detail" && dash?.qap?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Quality Assurance Plan · Detail</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-3">Week</th>
                  <th className="py-2 pr-3">Activity</th>
                  <th className="py-2 pr-3">Discipline</th>
                  <th className="py-2 pr-3">Ctr / PMC / Client</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {dash.qap.slice(0, 12).map((q: any) => (
                  <tr key={q.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-mono text-xs">{q.weekLabel}</td>
                    <td className="py-2 pr-3">{q.activity}</td>
                    <td className="py-2 pr-3 text-steel-muted">{q.discipline || "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {q.contractorOk ? "✓" : "·"} / {q.pmcOk ? "✓" : "·"} / {q.clientOk ? "✓" : "·"}
                    </td>
                    <td className="py-2">
                      <Badge tone={q.status === "Done" || q.completedAt ? "ok" : "warn"}>{q.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sheetKey === "qap-detail" && canManage && (
        <Card>
          <h3 className="font-semibold mb-3">Add QAP activity</h3>
          <form
            className="grid sm:grid-cols-4 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/api/checklist/project/${id}/qap`, {
                  method: "POST",
                  token,
                  body: JSON.stringify(qapForm),
                });
                setQapForm({ weekLabel: "", activity: "", discipline: "" });
                setMsg("QAP row added");
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              placeholder="Week label (e.g. W50)"
              value={qapForm.weekLabel}
              onChange={(e) => setQapForm({ ...qapForm, weekLabel: e.target.value })}
              required
            />
            <Input
              className="sm:col-span-2"
              placeholder="Activity"
              value={qapForm.activity}
              onChange={(e) => setQapForm({ ...qapForm, activity: e.target.value })}
              required
            />
            <Input
              placeholder="Discipline"
              value={qapForm.discipline}
              onChange={(e) => setQapForm({ ...qapForm, discipline: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-4 sm:w-auto">
              Add to QAP
            </Button>
          </form>
        </Card>
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
                    linkedDrawingId: form.drawingId || null,
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
            <Select value={form.drawingId} onChange={(e) => setForm({ ...form, drawingId: e.target.value })}>
              <option value="">Published drawing</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.drawingNumber} — {d.title}
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
          {msg && <p className="text-sm mt-2 text-steel-muted">{msg}</p>}
        </Card>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b font-semibold bg-sand/40">Inspections</div>
          <ul className="divide-y max-h-[55vh] overflow-y-auto">
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
                  {i.drawing?.drawingNumber || "No drawing"} · {i.assignedTo?.fullName || "Unassigned"} · {i.items?.length || 0} lines
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
                  {selected.drawing && <Badge tone="brand">{selected.drawing.drawingNumber}</Badge>}
                </div>
                <p className="text-sm text-steel-muted mt-2">
                  Assignee: {selected.assignedTo?.fullName || "—"} · By {selected.createdBy?.fullName}
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
                            {["Pass", "Fail", "N/A", "Open"].map((st) => (
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
                          </div>
                        </div>
                        <TextArea
                          rows={2}
                          placeholder="Comment for this line"
                          defaultValue={it.remarks || ""}
                          onBlur={async (e) => {
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
                  {f.submittedBy?.fullName} · {new Date(f.createdAt).toLocaleDateString()} · {f.progress?.answered ?? 0}/
                  {f.progress?.total ?? "?"} lines
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

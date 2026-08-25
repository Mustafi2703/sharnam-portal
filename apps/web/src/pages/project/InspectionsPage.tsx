import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../../components/ui";
import { QUALITY_SHEET_VIEWS, qualityLegacyQapRedirect, qualitySheetFromParams, type QualitySheetKey } from "../../lib/qualitySheetViews";
import { QualitySiteRegister } from "../../components/QualitySiteRegister";
import { CubeRegisterPanel } from "../../components/CubeRegisterPanel";
import type { QapProjectMeta } from "../../components/QapDetailRegister";
import { SorLogPanel } from "../../components/SorLogPanel";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { openNcrFormWindow } from "../../lib/ncrFormFields";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { QualityChecklistSummaryPanel } from "../../components/QualityChecklistSummaryPanel";

/** Excel register sheets — fill viewport; dashboard / QI workflow excluded */
const QUALITY_REGISTER_SHEETS = new Set<QualitySheetKey>([
  "sor-log",
  "site-observation",
  "site-instruction",
  "checklist-summary",
  "car-register",
  "cube-test",
]);

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
  const [active, setActive] = useState<string | null>(null);
  const [ncrForm, setNcrForm] = useState({
    kind: "NCR" as "NCR" | "CAR",
    number: "",
    ncrType: "",
    description: "",
    location: "",
    contractor: "",
  });
  const [ncrEdit, setNcrEdit] = useState<any>(null);
  const [ncrEditForm, setNcrEditForm] = useState({
    ncrType: "",
    description: "",
    location: "",
    status: "Open",
    plannedClosure: "",
    actualClosure: "",
  });
  const [ncrModalBusy, setNcrModalBusy] = useState(false);
  const [ncrAddOpen, setNcrAddOpen] = useState(false);
  const [cubeAddOpen, setCubeAddOpen] = useState(false);
  const [cubeSharePointUrl, setCubeSharePointUrl] = useState<string | null>(null);
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
    const [insp, d, u, t, dashRes, projRes] = await Promise.all([
      api<{ inspections: any[]; canInspect: boolean; publishedDrawings: number }>(`/api/inspections/project/${id}`, {
        token,
      }),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/checklist/templates?type=QualityInspection", { token }).catch(() => []),
      api(`/api/checklist/project/${id}/quality-dashboard`, { token }).catch(() => null),
      api<QapProjectMeta>(`/api/projects/${id}`, { token }).catch(() => null),
    ]);
    setData(insp);
    setDash(dashRes);
    if (projRes) {
      setProject({
        id: projRes.id,
        name: projRes.name,
        code: projRes.code,
        clientName: projRes.clientName,
        designConsultant: projRes.designConsultant,
        contractorName: projRes.contractorName,
        clientLogoUrl: (projRes as { clientLogoUrl?: string | null }).clientLogoUrl,
      });
    }
    setDrawings(d.filter((x) => x.isPublished));
    setUsers(u);
    const list = Array.isArray(t) ? t : [];
    setTemplates(list.slice(0, 50));
    if (!active && insp.inspections?.[0]) setActive(insp.inspections[0].id);
  };

  useEffect(() => {
    if (qualityLegacyQapRedirect(searchParams) && id) {
      navigate(`/projects/${id}/qap`, { replace: true });
    }
  }, [searchParams, id, navigate]);

  useEffect(() => {
    void load();
  }, [id, token]);

  const selected = data?.inspections?.find((i: any) => i.id === active);
  const canFillSelected =
    !!selected &&
    selected.status !== "Closed" &&
    (canManage || selected.assignedToId === user?.id || selected.assignedTo?.id === user?.id);
  const pageTitle = sheetView.label;
  const pageSubtitle = `${sheetView.sheet} — seeded from client Quality Dashboard / NCR / Cube workbooks. Checklist fills map to DPR Quality section.`;

  const isQualityRegister = QUALITY_REGISTER_SHEETS.has(sheetKey);

  return (
    <div
      className={`min-w-0 ${
        isQualityRegister
          ? "page-stack--register spdc-register-page flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2"
          : "space-y-4"
      }`}
    >
      <div className={isQualityRegister ? "shrink-0 space-y-2" : undefined}>
      <PageHeader
        dense={isQualityRegister}
        eyebrow="Quality module"
        title={pageTitle}
        subtitle={sheetKey === "cube-test" ? "SPDC cube register — 100-row sheet viewport; scroll inside the panel." : pageSubtitle}
      />
      </div>

      {sheetKey !== "cube-test" && !isQualityRegister && (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between border-b border-line pb-3 -mt-1 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="warn">{dash?.totals?.openInspections ?? 0} open QI</Badge>
          <Link to={`/projects/${id}/qap`}>
            <Badge tone="brand">{dash?.totals?.qapOpen ?? 0} QAP open</Badge>
          </Link>
          <Link to={`/projects/${id}/qap`}>
            <Badge tone="ok">{dash?.totals?.qapDone ?? 0} QAP done</Badge>
          </Link>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-brand shrink-0">
          <Link to={`/projects/${id}/quality/checklist-master`}>Checklist master →</Link>
          <Link to={`/projects/${id}/quality/checklist-logs`}>QI fill log →</Link>
          <Link to={`/projects/${id}/rfis?kind=QualityInspection`}>Raise quality RFI →</Link>
          <Link to={`/projects/${id}/qap`}>Quality Assurance Plan →</Link>
        </div>
      </div>
      )}

      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2 shrink-0">{msg}</p>}

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
              ["Cubes (pass)", `${dash.totals.cubesPass ?? 0}/${dash.totals.cubes ?? 0}`, null],
              ["Open fill RFIs", dash.totals.openFillRfis, null],
              ["QAP open / done", `${dash.totals.qapOpen} / ${dash.totals.qapDone}`, `/projects/${id}/qap`],
              ["Site execution fills", dash.totals.siteExecutionFills ?? 0, null],
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
          <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-3">
              Quality Dashboard.xlsx — breakdown
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <PieChart title="NCR / CAR status" items={dash.charts?.byNcrStatus || []} />
              <PieChart title="SOR register by type" items={dash.charts?.sorByType || []} />
              <PieChart title="SOR register by status" items={dash.charts?.sorByStatus || []} />
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
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <QualityChecklistSummaryPanel
          projectId={id!}
          token={token}
          dash={dash}
          canManage={canManage}
          onChanged={load}
        />
        </div>
      )}

      {sheetKey === "car-register" && (
        <>
          <div className="shrink-0">
        <ReferenceSheetToolbar
          sheetLabel="NCR / CAR register — Quality Dashboard"
          rowCount={dash?.ncrs?.length}
          canEdit={canManage}
          message={msg || undefined}
          onAddRow={canManage ? () => setNcrAddOpen((v) => !v) : undefined}
        />
        </div>
        <Card padding={false} className="register-table-panel spdc-register-panel register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line shrink-0">
          <h3 className="font-semibold mb-3">NCR / CAR register (Quality Dashboard · NCR 01)</h3>
          {ncrAddOpen && canManage && (
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
                  setNcrAddOpen(false);
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
          </div>
          <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
            <table className="sheet-register__table min-w-[40rem] w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left">No</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Status</th>
                  {canManage && <th className="text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {(dash?.ncrs || []).map((n: any) => (
                  <tr key={n.id}>
                    <td className="text-left font-mono text-xs">{n.number}</td>
                    <td className="text-left">{n.ncrType || "—"}</td>
                    <td className="text-left max-w-md">{n.description}</td>
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
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !px-2 !text-xs"
                          onClick={() => {
                            setNcrEdit(n);
                            setNcrEditForm({
                              ncrType: n.ncrType || "",
                              description: n.description || "",
                              location: n.location || "",
                              status: n.status || "Open",
                              plannedClosure: n.plannedClosure ? String(n.plannedClosure).slice(0, 10) : "",
                              actualClosure: n.actualClosure ? String(n.actualClosure).slice(0, 10) : "",
                            });
                          }}
                        >
                          Quick edit
                        </Button>
                        {n.status === "Open" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="!py-1 !px-2 !text-xs"
                            onClick={() => id && openNcrFormWindow(id, "quality", n.id)}
                          >
                            Close via form
                          </Button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
                {!dash?.ncrs?.length && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="empty text-left">
                      No NCR rows yet — run <code className="text-xs">npm run db:seed-quality-safety-demo</code> or raise one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <RegisterEntryModal
          open={!!ncrEdit}
          title={`Edit ${ncrEdit?.number || "NCR/CAR"}`}
          size="xl"
          onClose={() => setNcrEdit(null)}
          saving={ncrModalBusy}
          onSave={async () => {
            if (!ncrEdit || !id) return;
            setNcrModalBusy(true);
            try {
              await api(`/api/checklist/project/${id}/ncr/${ncrEdit.id}`, {
                method: "PATCH",
                token,
                body: JSON.stringify({
                  ncrType: ncrEditForm.ncrType,
                  description: ncrEditForm.description,
                  location: ncrEditForm.location,
                  status: ncrEditForm.status,
                  plannedClosure: ncrEditForm.plannedClosure || null,
                  actualClosure: ncrEditForm.actualClosure || null,
                }),
              });
              setMsg(`${ncrEdit.number} updated`);
              setNcrEdit(null);
              await load();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Update failed");
            } finally {
              setNcrModalBusy(false);
            }
          }}
        >
          <Select value={ncrEditForm.status} onChange={(e) => setNcrEditForm({ ...ncrEditForm, status: e.target.value })}>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </Select>
          <Input placeholder="Type" value={ncrEditForm.ncrType} onChange={(e) => setNcrEditForm({ ...ncrEditForm, ncrType: e.target.value })} />
          <TextArea placeholder="Description" value={ncrEditForm.description} onChange={(e) => setNcrEditForm({ ...ncrEditForm, description: e.target.value })} />
          <Input placeholder="Location" value={ncrEditForm.location} onChange={(e) => setNcrEditForm({ ...ncrEditForm, location: e.target.value })} />
          <Input type="date" value={ncrEditForm.plannedClosure} onChange={(e) => setNcrEditForm({ ...ncrEditForm, plannedClosure: e.target.value })} />
          <Input type="date" value={ncrEditForm.actualClosure} onChange={(e) => setNcrEditForm({ ...ncrEditForm, actualClosure: e.target.value })} />
        </RegisterEntryModal>
        </>
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
        <>
          <div className="shrink-0">
          <ReferenceSheetToolbar
            sheetLabel="SPDC Cube Register"
            rowCount={dash?.cubes?.length}
            canEdit={canManage}
            message={msg || undefined}
            onAddRow={canManage ? () => setCubeAddOpen((v) => !v) : undefined}
            onDownloadXlsx={async () => {
              if (!id) return;
              await downloadAuthFile(`/api/checklist/project/${id}/cubes/download.xlsx`, token, `Cube-Register-${project?.code || id}.xlsx`);
            }}
            onPublishSharePoint={
              canManage
                ? async () => {
                    if (!id) return;
                    try {
                      const out = await api<{ url?: string; sharePointUrl?: string }>(
                        `/api/checklist/project/${id}/cubes/publish`,
                        { method: "POST", token, body: JSON.stringify({}) }
                      );
                      const link = out.sharePointUrl || out.url || null;
                      setCubeSharePointUrl(link);
                      setMsg("Cube register published to SharePoint");
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Publish failed");
                    }
                  }
                : undefined
            }
            sharePointUrl={cubeSharePointUrl}
          />
          </div>
          <div className="cube-page__register register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
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
        </>
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

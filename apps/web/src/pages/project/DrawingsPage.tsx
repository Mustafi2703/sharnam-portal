import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, PageHeader, Select } from "../../components/ui";
import { UploadModal } from "../../components/UploadModal";
import { DrawingPreCheckPanel } from "../../components/DrawingPreCheckPanel";

const API_BASE = import.meta.env.VITE_API_URL || "";
const REV_SLOTS = ["R0", "R1", "R2", "R3", "R4", "R5"] as const;

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fileKind(nameOrUrl?: string | null) {
  const n = (nameOrUrl || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/.test(n)) return "image";
  if (/\.pdf(\?|$)/.test(n)) return "pdf";
  return "other";
}

export default function DrawingsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ title: string; fileUrl: string; fileName?: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [revUnlockToken, setRevUnlockToken] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState("");
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [fillDrawingId, setFillDrawingId] = useState("");
  const [fillTemplateId, setFillTemplateId] = useState("");
  const [fillAssignmentId, setFillAssignmentId] = useState("");
  const [fillMsg, setFillMsg] = useState("");
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    buildingArea: "",
    tlNo: "",
    revisionNumber: "R0",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [revForm, setRevForm] = useState({ revisionNumber: "", revisionLabel: "", publish: true });
  const [revFile, setRevFile] = useState<File | null>(null);
  const canUpload = canManageDrawings(user?.role);
  const clientOnly = isClientViewOnly(user?.role);

  const load = async () => {
    const [d, a, t] = await Promise.all([
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=SiteExecution`, { token }).catch(() => ({
        assignments: [],
      })),
      api<any[]>(`/api/checklist/templates?type=SiteExecution`, { token }).catch(() => []),
    ]);
    setDrawings(d);
    setAssignments(a.assignments || []);
    setTemplates(t);
    if (!fillDrawingId && d[0]) setFillDrawingId(d[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    if (searchParams.get("upload") === "1" && canUpload) {
      setShowRegister(true);
      setFormError("");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canUpload, setSearchParams]);

  const disciplines = ["All", ...Array.from(new Set(drawings.map((d) => d.discipline)))];
  const filtered = useMemo(
    () => (filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter)),
    [drawings, filter]
  );
  const uploadTarget = drawings.find((d) => d.id === uploadForId);
  const fillDrawing = drawings.find((d) => d.id === fillDrawingId);
  const latestRev = useMemo(() => {
    const revs = [...(fillDrawing?.revisions || [])].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return revs[0] || null;
  }, [fillDrawing]);
  const assignedIds = new Set(assignments.map((a) => a.template?.id));
  const availableTemplates = templates.filter((t) => !assignedIds.has(t.id));

  async function assignChecklistOnDrawing() {
    if (!fillTemplateId) return;
    setFillMsg("");
    try {
      const a = await api<any>(`/api/checklist/project/${id}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ templateId: fillTemplateId }),
      });
      setFillAssignmentId(a.id);
      setFillMsg(`Checklist “${a.template?.name || "assigned"}” ready — raise fill RFI next.`);
      await load();
    } catch (err) {
      setFillMsg(err instanceof Error ? err.message : "Assign failed");
    }
  }

  async function raiseDrawingFillRfi() {
    setFillMsg("");
    const assignmentId = fillAssignmentId || assignments[0]?.id;
    if (!assignmentId) {
      setFillMsg("Assign a checklist first.");
      return;
    }
    if (!fillDrawingId) {
      setFillMsg("Select a drawing.");
      return;
    }
    const assignment = assignments.find((a) => a.id === assignmentId) || { id: assignmentId, template: { name: "Checklist" } };
    try {
      const rfi = await api<any>(`/api/rfis/project/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          rfiKind: "DrawingChecklist",
          subject: `Fill checklist vs ${fillDrawing?.drawingNumber || "drawing"} ${latestRev?.revisionNumber || "latest"}`,
          question: `Please complete checklist “${assignment.template?.name || "assigned"}” against drawing ${fillDrawing?.drawingNumber} · ${fillDrawing?.title || ""} · revision ${latestRev?.revisionNumber || "latest"}. Communication matrix parties and responsible vendor fill this form.`,
          linkedDrawingId: fillDrawingId,
          linkedAssignmentId: assignmentId,
          linkedChecklistItemId: assignment.template?.id || null,
          attachmentNote: latestRev ? `Latest rev ${latestRev.revisionNumber}` : "No revision yet",
        }),
      });
      setFillMsg(`Fill RFI ${rfi.number} raised for matrix / vendor.`);
    } catch (err) {
      setFillMsg(err instanceof Error ? err.message : "RFI failed");
    }
  }

  async function exportCsv() {
    const res = await fetch(`${API_BASE}/api/drawings/project/${id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return setMsg("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gfc-drawing-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function registerDrawing(e: FormEvent) {
    e.preventDefault();
    if (!unlockToken) {
      setFormError("Complete Drawing Check Master first.");
      return;
    }
    setBusy(true);
    setMsg("");
    setFormError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("unlockToken", unlockToken);
      if (plannedDate) fd.append("plannedDate", plannedDate);
      if (actualDate) fd.append("actualDate", actualDate);
      if (file) fd.append("file", file);
      await api(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
      setForm({
        drawingNumber: "",
        title: "",
        discipline: form.discipline,
        buildingArea: "",
        tlNo: "",
        revisionNumber: "R0",
        publish: true,
      });
      setFile(null);
      setUnlockToken(null);
      setShowRegister(false);
      setMsg("Drawing saved to GFC register (check + revision logged).");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function closeRegister() {
    setShowRegister(false);
    setFile(null);
    setFormError("");
    setUnlockToken(null);
  }

  async function uploadRevision(e: FormEvent) {
    e.preventDefault();
    if (!uploadForId) return;
    if (!revUnlockToken) {
      setFormError("Complete Drawing Check Master before revision upload.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("revisionNumber", revForm.revisionNumber);
      fd.append("revisionLabel", revForm.revisionLabel || revForm.revisionNumber);
      fd.append("publish", String(revForm.publish));
      fd.append("unlockToken", revUnlockToken);
      if (plannedDate) fd.append("plannedDate", plannedDate);
      if (actualDate) fd.append("actualDate", actualDate);
      if (revFile) fd.append("file", revFile);
      await api(`/api/drawings/${uploadForId}/revisions`, { method: "POST", token, body: fd });
      setUploadForId(null);
      setRevFile(null);
      setRevUnlockToken(null);
      setExpandedId(uploadForId);
      setMsg("Revision uploaded — planned/actual logged on the GFC register.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Revision upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openUploadRev(d: any) {
    const next = `R${Math.min(d.revisions?.length || 0, 5)}`;
    setUploadForId(d.id);
    setRevUnlockToken(null);
    setFormError("");
    setPlannedDate("");
    setActualDate(new Date().toISOString().slice(0, 10));
    setExpandedId(d.id);
    setRevForm({
      revisionNumber: next,
      revisionLabel: `${next} — ${new Date().toLocaleDateString()}`,
      publish: true,
    });
    setRevFile(null);
  }

  const viewerKind = fileKind(viewer?.fileName || viewer?.fileUrl);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module · GFC"
        title="Drawing register"
        subtitle={
          clientOnly
            ? "View published sheets and revision dates. Clients cannot upload."
            : "Upload opens Drawing Check Master (same fill pattern as Quality/Safety). Complete the linked checklist, then upload the sheet. Raise Ask (drawing RFI) for clarifications, or Request checklist fill for matrix/vendor."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
              Export GFC CSV
            </Button>
            {canUpload && (
              <Button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  setFormError("");
                }}
              >
                Upload drawing
              </Button>
            )}
          </div>
        }
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      <div className="flex flex-wrap gap-1">
        {disciplines.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`rounded px-3 py-1 text-xs font-medium border ${
              filter === d ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {canUpload && (
        <Card className="!p-5 border-brand/25 bg-brand-soft/20">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-display text-lg">Checklist + request fill (latest revision)</h3>
              <p className="text-sm text-steel-muted mt-1 max-w-2xl">
                Assign a site checklist, then request fill so matrix / vendor open the form against the latest revision —
                they can upload docs and new drawings / revisions from the fill screen.
              </p>
            </div>
            <Link to={`/projects/${id}/rfis?kind=DrawingChecklist`} className="text-sm font-semibold text-brand">
              Request checklist fill →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="text-xs text-steel-muted block">
              Drawing
              <Select className="mt-1" value={fillDrawingId} onChange={(e) => setFillDrawingId(e.target.value)}>
                <option value="">Select drawing…</option>
                {drawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.drawingNumber} — {d.title}
                  </option>
                ))}
              </Select>
            </label>
            <div className="text-sm">
              <div className="text-xs text-steel-muted">Latest revision</div>
              <div className="font-mono font-semibold mt-1.5">
                {latestRev ? `${latestRev.revisionNumber} · ${fmtDate(latestRev.createdAt)}` : "No revision yet"}
              </div>
            </div>
            <label className="text-xs text-steel-muted block">
              Assign checklist type
              <Select className="mt-1" value={fillTemplateId} onChange={(e) => setFillTemplateId(e.target.value)}>
                <option value="">Template…</option>
                {availableTemplates.slice(0, 80).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs text-steel-muted block">
              Or pick assigned checklist
              <Select className="mt-1" value={fillAssignmentId} onChange={(e) => setFillAssignmentId(e.target.value)}>
                <option value="">Assignment…</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.template?.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!fillTemplateId} onClick={() => void assignChecklistOnDrawing()}>
              Assign checklist
            </Button>
            <Button type="button" disabled={!fillDrawingId} onClick={() => void raiseDrawingFillRfi()}>
              Raise request fill (matrix / vendor)
            </Button>
            {fillAssignmentId && (
              <Link
                to={`/projects/${id}/checklist/fill/${fillAssignmentId}?family=SiteExecution`}
                className="self-center text-sm font-semibold text-brand"
              >
                Open fill form →
              </Link>
            )}
          </div>
          {fillMsg && <p className="text-sm text-steel-muted mt-3">{fillMsg}</p>}
        </Card>
      )}

      {canUpload && showRegister && !unlockToken && id && (
        <div className="fixed inset-0 z-[70] bg-ink/45 flex items-center justify-center p-3">
          <div className="w-full max-w-2xl">
            <DrawingPreCheckPanel
              projectId={id}
              onCancel={closeRegister}
              onUnlocked={(tok) => setUnlockToken(tok)}
            />
          </div>
        </div>
      )}

      {canUpload && (
        <UploadModal
          open={showRegister && !!unlockToken}
          title="Upload drawing"
          context={`Project · GFC register · check complete · ${form.discipline}`}
          file={file}
          onFile={setFile}
          accept=".pdf,.png,.jpg,.jpeg,.dwg,.webp"
          primaryLabel={form.publish ? "Upload & publish" : "Upload to register"}
          busy={busy}
          error={formError}
          onClose={closeRegister}
          onSubmit={registerDrawing}
          fields={[
            {
              kind: "text",
              name: "drawingNumber",
              label: "Drawing no.",
              required: true,
              placeholder: "A-101",
              value: form.drawingNumber,
              onChange: (v) => setForm({ ...form, drawingNumber: v }),
            },
            {
              kind: "text",
              name: "title",
              label: "Title",
              required: true,
              placeholder: "Ground floor plan",
              value: form.title,
              onChange: (v) => setForm({ ...form, title: v }),
            },
            {
              kind: "select",
              name: "discipline",
              label: "Discipline",
              value: form.discipline,
              onChange: (v) => setForm({ ...form, discipline: v }),
              options: ["Architecture", "Structural", "MEP", "Civil"],
            },
            {
              kind: "text",
              name: "buildingArea",
              label: "Building / Area",
              placeholder: "Block A",
              value: form.buildingArea,
              onChange: (v) => setForm({ ...form, buildingArea: v }),
            },
            {
              kind: "text",
              name: "tlNo",
              label: "TL No",
              value: form.tlNo,
              onChange: (v) => setForm({ ...form, tlNo: v }),
            },
            {
              kind: "text",
              name: "revisionNumber",
              label: "First revision",
              placeholder: "R0",
              value: form.revisionNumber,
              onChange: (v) => setForm({ ...form, revisionNumber: v }),
            },
            {
              kind: "text",
              name: "plannedDate",
              label: "Planned date",
              value: plannedDate,
              onChange: setPlannedDate,
              placeholder: "YYYY-MM-DD",
            },
            {
              kind: "text",
              name: "actualDate",
              label: "Actual date",
              value: actualDate,
              onChange: setActualDate,
              placeholder: "YYYY-MM-DD",
            },
            {
              kind: "checkbox",
              name: "publish",
              label: "Publish now (shows on register; fill RFIs use latest rev)",
              checked: form.publish,
              onChange: (v) => setForm({ ...form, publish: v }),
            },
          ]}
        />
      )}

      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">INDORE · Drawing register</div>
            <div className="text-[11px] text-white/70">Discipline · Area · TL · DWG · R0–R5 dates · browse / revisions</div>
          </div>
          <Badge tone="neutral">{drawings.filter((d) => d.isPublished).length} published</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-sand text-left text-[10px] uppercase tracking-wide text-steel-muted">
              <tr>
                <th className="px-2 py-2">Discipline</th>
                <th className="px-2 py-2">Building/Area</th>
                <th className="px-2 py-2">TL No</th>
                <th className="px-2 py-2">DWG. No.</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Browse</th>
                {REV_SLOTS.map((r) => (
                  <th key={r} className="px-2 py-2 text-center">
                    {r}
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Total</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const revsAsc = [...(d.revisions || [])].sort(
                  (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                const latest = revsAsc[revsAsc.length - 1];
                const open = expandedId === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr className={`border-t border-line ${open ? "bg-brand-soft/30" : "hover:bg-sand/40"}`}>
                      <td className="px-2 py-2 text-xs">{d.discipline}</td>
                      <td className="px-2 py-2 text-xs">{d.buildingArea || "—"}</td>
                      <td className="px-2 py-2 text-xs font-mono">{d.tlNo || "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-brand font-semibold">{d.drawingNumber}</td>
                      <td className="px-2 py-2 font-medium max-w-[180px]">{d.title}</td>
                      <td className="px-2 py-2">
                        {latest?.fileUrl ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand hover:underline"
                            onClick={() =>
                              setViewer({
                                title: `${d.drawingNumber} · ${d.currentRev}`,
                                fileUrl: latest.fileUrl,
                                fileName: latest.fileName,
                              })
                            }
                          >
                            Open
                          </button>
                        ) : (
                          <span className="text-xs text-steel-muted">—</span>
                        )}
                      </td>
                      {REV_SLOTS.map((_, i) => {
                        const r = revsAsc[i];
                        const label = r
                          ? r.actualDate || r.plannedDate
                            ? `${r.plannedDate ? `P:${fmtDate(r.plannedDate)}` : ""} ${r.actualDate ? `A:${fmtDate(r.actualDate)}` : ""}`.trim() ||
                              fmtDate(r.createdAt)
                            : fmtDate(r.createdAt)
                          : "—";
                        return (
                          <td key={i} className="px-2 py-2 text-[10px] text-center font-mono text-steel-muted whitespace-nowrap" title={r?.revisionLabel || ""}>
                            {label}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-mono text-xs">{revsAsc.length}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setExpandedId(open ? null : d.id)}>
                            {open ? "Hide log" : "Log"}
                          </Button>
                          {canUpload && (
                            <Button type="button" variant="secondary" className="!px-2 !py-1 !text-xs" onClick={() => openUploadRev(d)}>
                              Upload rev
                            </Button>
                          )}
                          {canUpload && !d.isPublished && (
                            <Button
                              type="button"
                              variant="primary"
                              className="!px-2 !py-1 !text-xs"
                              onClick={async () => {
                                await api(`/api/drawings/${d.id}/publish`, { method: "POST", token });
                                setMsg("Published — checklists unlock. You can still upload further revisions.");
                                await load();
                              }}
                            >
                              Publish
                            </Button>
                          )}
                          {d.isPublished && <Badge tone="ok">Pub</Badge>}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line bg-[#f8fafc]">
                        <td colSpan={15} className="px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-mono uppercase tracking-wide text-steel-muted">
                              Upload log — {d.drawingNumber} ({d.currentRev})
                            </h4>
                            {canUpload && (
                              <Button type="button" className="!text-xs !py-1" onClick={() => openUploadRev(d)}>
                                + Next revision
                              </Button>
                            )}
                          </div>
                          <ul className="space-y-2">
                            {revsAsc.map((r: any, idx: number) => (
                              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
                                <div>
                                  <div className="font-semibold">
                                    {r.revisionNumber || `R${idx}`}
                                    {idx === revsAsc.length - 1 && <span className="ml-2 text-[10px] text-brand font-mono">CURRENT</span>}
                                  </div>
                                  <div className="text-xs text-steel-muted">
                                    {fmtDate(r.createdAt)} · {r.revisionLabel || "—"}
                                    {r.uploadedBy?.fullName ? ` · ${r.uploadedBy.fullName}` : ""}
                                  </div>
                                  {r.fileName && <div className="text-[11px] font-mono mt-0.5">{r.fileName}</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                                  {r.fileUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() =>
                                        setViewer({
                                          title: `${d.drawingNumber} · ${r.revisionNumber}`,
                                          fileUrl: r.fileUrl,
                                          fileName: r.fileName,
                                        })
                                      }
                                    >
                                      View
                                    </Button>
                                  )}
                                </div>
                              </li>
                            ))}
                            {!revsAsc.length && <li className="text-sm text-steel-muted">No uploads yet.</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-sm text-steel-muted">
                    No drawings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canUpload && uploadForId && uploadTarget && !revUnlockToken && id && (
        <div className="fixed inset-0 z-[70] bg-ink/45 flex items-center justify-center p-3">
          <div className="w-full max-w-2xl">
            <DrawingPreCheckPanel
              projectId={id}
              onCancel={() => {
                setUploadForId(null);
                setRevFile(null);
                setFormError("");
              }}
              onUnlocked={(tok) => setRevUnlockToken(tok)}
            />
          </div>
        </div>
      )}

      {canUpload && uploadForId && uploadTarget && (
        <UploadModal
          open={!!revUnlockToken}
          title="Upload revision"
          context={`${uploadTarget.drawingNumber} · current ${uploadTarget.currentRev} · check complete`}
          file={revFile}
          onFile={setRevFile}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg"
          primaryLabel="Upload & log planned/actual"
          busy={busy}
          error={formError}
          onClose={() => {
            setUploadForId(null);
            setRevFile(null);
            setRevUnlockToken(null);
            setFormError("");
          }}
          onSubmit={uploadRevision}
          fields={[
            {
              kind: "text",
              name: "revisionNumber",
              label: "Revision",
              required: true,
              placeholder: "R1",
              value: revForm.revisionNumber,
              onChange: (v) => setRevForm({ ...revForm, revisionNumber: v }),
            },
            {
              kind: "text",
              name: "revisionLabel",
              label: "Label / note",
              value: revForm.revisionLabel,
              onChange: (v) => setRevForm({ ...revForm, revisionLabel: v }),
            },
            {
              kind: "text",
              name: "plannedDate",
              label: "Planned date",
              value: plannedDate,
              onChange: setPlannedDate,
              placeholder: "YYYY-MM-DD",
            },
            {
              kind: "text",
              name: "actualDate",
              label: "Actual date",
              value: actualDate,
              onChange: setActualDate,
              placeholder: "YYYY-MM-DD",
            },
            {
              kind: "checkbox",
              name: "publish",
              label: "Set as current published revision",
              checked: revForm.publish,
              onChange: (v) => setRevForm({ ...revForm, publish: v }),
            },
          ]}
        />
      )}

      {viewer && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-procore-navy text-white">
              <div className="min-w-0">
                <div className="font-semibold truncate">{viewer.title}</div>
                <div className="text-[11px] text-white/70 truncate">{viewer.fileName || viewer.fileUrl}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={viewer.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-white/90">
                  Open tab
                </a>
                <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setViewer(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[50vh] bg-sand/60">
              {viewerKind === "image" && (
                <img src={viewer.fileUrl} alt={viewer.title} className="max-h-[75vh] mx-auto object-contain p-4" />
              )}
              {viewerKind === "pdf" && (
                <iframe title={viewer.title} src={viewer.fileUrl} className="w-full h-[75vh] border-0" />
              )}
              {viewerKind === "other" && (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm text-steel-muted">Preview not available for this file type. Download or open in a new tab.</p>
                  <a href={viewer.fileUrl} className="text-brand font-semibold" target="_blank" rel="noreferrer">
                    Download / open file →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

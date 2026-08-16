import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { UploadModal } from "../../components/UploadModal";
import { DrawingCheckModal } from "../../components/DrawingCheckModal";
import { DrawingsModuleNav } from "../../components/DrawingsModuleNav";
import { DrawingFileViewer } from "../../components/DrawingFileViewer";
import { drawingFileKind, resolveDrawingFileUrl, type DrawingPreview } from "../../lib/drawingPreview";
import PdfMarkup from "../../components/PdfMarkup";
import ImageMarkup from "../../components/ImageMarkup";

const API_BASE = import.meta.env.VITE_API_URL || "";
const REV_SLOTS = ["R0", "R1", "R2", "R3", "R4", "R5"] as const;

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function previewFromRev(d: { drawingNumber?: string; currentRev?: string }, rev: { revisionNumber?: string; fileUrl?: string; fileName?: string }): DrawingPreview {
  const fileName = rev.fileName || rev.fileUrl || "";
  return {
    title: `${d.drawingNumber} · ${rev.revisionNumber || d.currentRev || "—"}`,
    fileUrl: resolveDrawingFileUrl(rev.fileUrl),
    fileName,
    kind: drawingFileKind(fileName),
  };
}

export default function DrawingsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DrawingPreview | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [precheckOpen, setPrecheckOpen] = useState(false);
  const [precheckMode, setPrecheckMode] = useState<"register" | "revision">("register");
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
  const [showRegisterLine, setShowRegisterLine] = useState(false);
  const [registerLineBusy, setRegisterLineBusy] = useState(false);
  const [dumpBusy, setDumpBusy] = useState(false);
  const [markupTarget, setMarkupTarget] = useState<{
    file: File;
    target: "register" | "revision";
    preview?: string;
  } | null>(null);
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

  function startUploadFlow() {
    if (!id) return;
    setFormError("");
    setUnlockToken(null);
    setShowRegister(false);
    setPrecheckMode("register");
    setPrecheckOpen(true);
    setMsg("Complete Drawing Check Master in the overlay — upload opens when it unlocks.");
  }

  useEffect(() => {
    if (!id || !canUpload) return;
    if (searchParams.get("upload") === "1") {
      startUploadFlow();
      setSearchParams({}, { replace: true });
    }
  }, [id, canUpload, searchParams, setSearchParams]);

  function onPrecheckUnlocked(tok: string) {
    setPrecheckOpen(false);
    setFormError("");
    if (precheckMode === "revision") {
      setRevUnlockToken(tok);
      setMsg("Checklist unlocked — finish the revision upload.");
    } else {
      setUnlockToken(tok);
      setShowRegister(true);
      setMsg("Checklist unlocked — finish the upload form.");
    }
  }

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

  async function addRegisterLine(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setRegisterLineBusy(true);
    setMsg("");
    try {
      await api(`/api/drawings/project/${id}/register-line`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setMsg(`Register line ${form.drawingNumber} added — upload GFC file when ready (Drawing Check unlocks upload).`);
      setShowRegisterLine(false);
      setForm({
        drawingNumber: "",
        title: "",
        discipline: "Architecture",
        buildingArea: "",
        tlNo: "",
        revisionNumber: "R0",
        publish: false,
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to add register line");
    } finally {
      setRegisterLineBusy(false);
    }
  }

  async function syncRegistersToDrive() {
    if (!id) return;
    setDumpBusy(true);
    setMsg("");
    try {
      const r = await api<{ ok: boolean; registers?: { name: string; rows: number }[] }>(
        `/api/dms/${id}/dump-logs`,
        { method: "POST", token }
      );
      const names = (r.registers || []).map((x) => x.name).slice(0, 4).join(", ");
      setMsg(`Registers synced to SharePoint — ${r.registers?.length || 0} CSVs (e.g. ${names}…).`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SharePoint sync failed");
    } finally {
      setDumpBusy(false);
    }
  }

  function pickDrawingFile(f: File | null, target: "register" | "revision") {
    if (!f) {
      if (target === "register") setFile(null);
      else setRevFile(null);
      return;
    }
    const canMarkup =
      f.type === "application/pdf" ||
      f.type.startsWith("image/") ||
      /\.(pdf|png|jpe?g|webp)$/i.test(f.name);
    if (canMarkup) {
      setMarkupTarget({
        file: f,
        target,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      });
      return;
    }
    if (target === "register") setFile(f);
    else setRevFile(f);
  }

  function applyMarkedFile(marked: File) {
    if (!markupTarget) return;
    if (markupTarget.target === "register") setFile(marked);
    else setRevFile(marked);
    if (markupTarget.preview) URL.revokeObjectURL(markupTarget.preview);
    setMarkupTarget(null);
  }

  function closeMarkup() {
    if (markupTarget?.preview) URL.revokeObjectURL(markupTarget.preview);
    setMarkupTarget(null);
  }

  function openLatestViewer(d: any) {
    const revsAsc = [...(d.revisions || [])].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const latest = revsAsc[revsAsc.length - 1];
    if (!latest?.fileUrl) return;
    setViewer(previewFromRev(d, latest));
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
    if (!id) return;
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
    setPrecheckMode("revision");
    setPrecheckOpen(true);
    setMsg("Complete Drawing Check Master in the overlay — revision upload unlocks after.");
  }

  return (
    <div className="space-y-4 min-w-0">
      {id && <DrawingsModuleNav projectId={id} />}

      <PageHeader
        dense
        eyebrow="Drawings module · GFC"
        title="Drawing register"
        subtitle={
          clientOnly
            ? "View published sheets and revision dates."
            : "Upload runs Drawing Check Master first, then opens here. Other tools are in the tabs above."
        }
        actions={
          canUpload ? (
            <>
              <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setShowRegisterLine((v) => !v)}>
                {showRegisterLine ? "Cancel line" : "Add line"}
              </Button>
              <Button type="button" className="flex-1 sm:flex-none" onClick={() => startUploadFlow()}>
                Upload GFC
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3 -mt-1">
        <div
          className="flex gap-1 overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-0.5 min-w-0"
          role="tablist"
          aria-label="Filter by discipline"
        >
          {disciplines.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={filter === d}
              onClick={() => setFilter(d)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap ${
                filter === d ? "bg-procore-navy text-white border-procore-navy" : "bg-paper text-ink border-line"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <details className="relative shrink-0 self-stretch sm:self-auto">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden h-full flex items-center">
            <span className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand/60">
              Export & sync ▾
            </span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-line bg-paper shadow-lg p-2 space-y-1">
            <ReportExportButtons projectId={id} kind="drawings" label="Register" menu />
            <Button
              type="button"
              variant="ghost"
              className="w-full !justify-start !text-sm !py-2"
              onClick={(e) => {
                void exportCsv();
                (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
              }}
            >
              Export GFC CSV
            </Button>
            {canUpload && (
              <Button
                type="button"
                variant="ghost"
                className="w-full !justify-start !text-sm !py-2"
                disabled={dumpBusy}
                onClick={(e) => {
                  void syncRegistersToDrive();
                  (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}
              >
                {dumpBusy ? "Syncing…" : "Sync logs → SharePoint"}
              </Button>
            )}
          </div>
        </details>
      </div>

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {canUpload && showRegisterLine && (
        <Card>
          <h3 className="font-semibold mb-1">Add GFC register line (no file yet)</h3>
          <p className="text-xs text-steel-muted mb-3">
            Reserve a drawing number in the register. Upload the PDF/DWG later via <strong>Upload GFC</strong> — Drawing Check Master unlocks the file step.
          </p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => void addRegisterLine(e)}>
            <Input
              placeholder="Drawing number"
              value={form.drawingNumber}
              onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })}
              required
            />
            <Input
              className="sm:col-span-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["Architecture", "Structural", "MEP", "Facade", "Landscape", "Interior"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input
              placeholder="Building / area"
              value={form.buildingArea}
              onChange={(e) => setForm({ ...form, buildingArea: e.target.value })}
            />
            <Input
              placeholder="TL no."
              value={form.tlNo}
              onChange={(e) => setForm({ ...form, tlNo: e.target.value })}
            />
            <Button type="submit" disabled={registerLineBusy}>
              {registerLineBusy ? "Saving…" : "Save register line"}
            </Button>
          </form>
        </Card>
      )}

      {canUpload && (
        <Card className="!p-5 border-brand/30 bg-paper text-ink">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-display text-lg text-ink">Checklist + request fill (latest revision)</h3>
              <p className="text-sm text-ink/75 mt-1 max-w-2xl">
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

      {canUpload && showRegister && !unlockToken && !precheckOpen && (
        <Card className="border-warn/40 bg-[color-mix(in_srgb,var(--color-warn)_12%,var(--color-paper))]">
          <div className="font-semibold text-ink">Waiting for Drawing Check Master</div>
          <p className="text-sm text-steel-muted mt-1">
            Finish the checklist overlay, or open it again to continue.
          </p>
          <Button type="button" className="mt-3" onClick={() => startUploadFlow()}>
            Re-open checklist
          </Button>
        </Card>
      )}

      {canUpload && id && (
        <DrawingCheckModal
          open={precheckOpen}
          projectId={id}
          mode={precheckMode}
          contextLabel={
            precheckMode === "revision" && uploadTarget
              ? `${uploadTarget.drawingNumber} · next revision`
              : "New drawing · GFC register"
          }
          onClose={() => {
            setPrecheckOpen(false);
            if (precheckMode === "revision" && !revUnlockToken) {
              setUploadForId(null);
            }
          }}
          onUnlocked={(tok) => onPrecheckUnlocked(tok)}
        />
      )}

      {canUpload && (
        <UploadModal
          open={showRegister && !!unlockToken}
          title="Upload drawing"
          context={`Project · GFC register · check complete · ${form.discipline}`}
          file={file}
          onFile={(f) => pickDrawingFile(f, "register")}
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

      <Card padding={false} className="overflow-hidden drawings-register">
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
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand hover:underline text-left"
                              onClick={() => openLatestViewer(d)}
                            >
                              Latest · Open
                            </button>
                            <span className="text-[10px] font-mono text-steel-muted">{latest.revisionNumber || d.currentRev}</span>
                          </div>
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
                                      onClick={() => setViewer(previewFromRev(d, r))}
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

      {canUpload && uploadForId && uploadTarget && !revUnlockToken && !precheckOpen && (
        <Card className="border-brand/40 bg-brand-soft/40">
          <h3 className="font-semibold text-sm">Waiting for Drawing Check Master</h3>
          <p className="text-sm text-steel-muted mt-1">
            Fill the checklist overlay for revision of {uploadTarget.drawingNumber}. When it unlocks, the upload form opens here.
          </p>
          <Button type="button" className="mt-3" onClick={() => openUploadRev(uploadTarget)}>
            Re-open checklist
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 ml-2"
            onClick={() => {
              setUploadForId(null);
              setRevFile(null);
              setFormError("");
            }}
          >
            Cancel
          </Button>
        </Card>
      )}

      {canUpload && uploadForId && uploadTarget && (
        <UploadModal
          open={!!revUnlockToken}
          title="Upload revision"
          context={`${uploadTarget.drawingNumber} · current ${uploadTarget.currentRev} · check complete`}
          file={revFile}
          onFile={(f) => pickDrawingFile(f, "revision")}
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

      {markupTarget && (
        <div className="markup-modal" role="dialog" aria-modal="true" aria-label="Drawing PDF markup">
          <div className="markup-modal__backdrop" onClick={closeMarkup} />
          <div className="markup-modal__panel max-w-4xl">
            <div className="markup-modal__head">
              <span>
                Mark up {markupTarget.target === "register" ? "new drawing" : "revision"} before upload
              </span>
              <button type="button" className="markup-modal__close" onClick={closeMarkup}>
                ×
              </button>
            </div>
            <div className="markup-modal__body">
              {markupTarget.file.type === "application/pdf" ||
              markupTarget.file.name.toLowerCase().endsWith(".pdf") ? (
                <PdfMarkup
                  src={markupTarget.file}
                  saveLabel="Use marked PDF"
                  onCancel={closeMarkup}
                  onSave={async (pages) => {
                    applyMarkedFile(pages[0] || markupTarget.file);
                  }}
                />
              ) : (
                <ImageMarkup
                  src={markupTarget.preview || markupTarget.file}
                  saveLabel="Use marked image"
                  filename="drawing-markup"
                  onCancel={closeMarkup}
                  onSave={async (marked) => {
                    applyMarkedFile(marked);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {viewer && <DrawingFileViewer preview={viewer} variant="modal" onClose={() => setViewer(null)} />}
    </div>
  );
}

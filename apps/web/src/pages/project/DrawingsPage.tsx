import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { UploadModal } from "../../components/UploadModal";
import { DrawingUploadFilePicker } from "../../components/DrawingUploadFilePicker";
import { DrawingCheckModal } from "../../components/DrawingCheckModal";
import { DrawingFileViewer } from "../../components/DrawingFileViewer";
import { DrawingIssueFields } from "../../components/DrawingIssueFields";
import { RevisionIssueLogSummary } from "../../components/RevisionIssueLogSummary";
import {
  appendIssueToFormData,
  emptyDrawingIssueDraft,
  issueDraftHasData,
  issueFromRevision,
} from "../../lib/drawingIssueFields";
import {
  drawingFileKind,
  resolveDrawingFileUrl,
  revisionPreviewFromRecord,
  type DrawingRevisionPreview,
} from "../../lib/drawingPreview";
import {
  gfcCurrentRevision,
  gfcDateLabel,
  gfcNextRevisionNumber,
  gfcRevisionForSlot,
  gfcRevSlots,
  gfcRevisionsByNumber,
  normalizeRevNumber,
} from "../../lib/gfcRegister";
import { MASTER_REGISTER_DISCIPLINES } from "../../lib/masterDrawingRegister";

const GFC_DISCIPLINE_TABS = [
  "Architecture",
  "Structural",
  "MEPF",
  "Civil",
  "Facade",
  "Interior",
  "Fire",
  "Electrical",
  "Mechanical",
] as const;

const API_BASE = import.meta.env.VITE_API_URL || "";

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function previewFromRev(d: { drawingNumber?: string; currentRev?: string }, rev: any): DrawingRevisionPreview {
  return revisionPreviewFromRecord(d, rev);
}

export default function DrawingsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DrawingRevisionPreview | null>(null);
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
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    buildingArea: "",
    tlNo: "",
    revisionNumber: "R0",
    publish: true,
  });
  const [registerPdf, setRegisterPdf] = useState<File | null>(null);
  const [registerDwg, setRegisterDwg] = useState<File | null>(null);
  const [revPdf, setRevPdf] = useState<File | null>(null);
  const [revDwg, setRevDwg] = useState<File | null>(null);
  const [registerIssue, setRegisterIssue] = useState(emptyDrawingIssueDraft);
  const [revIssue, setRevIssue] = useState(emptyDrawingIssueDraft);
  const [revForm, setRevForm] = useState({ revisionNumber: "", revisionLabel: "", publish: true });
  const [revUploadMode, setRevUploadMode] = useState<"new" | "replace" | "update">("new");
  const [revReplaceRole, setRevReplaceRole] = useState<"pdf" | "dwg">("pdf");
  const [replaceRevisionId, setReplaceRevisionId] = useState<string | null>(null);
  const [dumpBusy, setDumpBusy] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addRowForm, setAddRowForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    buildingArea: "",
    tlNo: "",
  });
  const canUpload = canManageDrawings(user?.role);
  const clientOnly = isClientViewOnly(user?.role);

  const load = async () => {
    const d = await api<any[]>(`/api/drawings/project/${id}`, { token });
    setDrawings(d);
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

  const disciplines = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set([
          ...GFC_DISCIPLINE_TABS,
          ...MASTER_REGISTER_DISCIPLINES,
          ...drawings.map((d) => d.discipline).filter(Boolean),
        ])
      ),
    ],
    [drawings]
  );

  async function addGfcRow(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setFormError("");
    try {
      await api(`/api/drawings/project/${id}/register-line`, {
        method: "POST",
        token,
        body: JSON.stringify({
          drawingNumber: addRowForm.drawingNumber.trim(),
          title: addRowForm.title.trim(),
          discipline: addRowForm.discipline,
          buildingArea: addRowForm.buildingArea.trim() || undefined,
          tlNo: addRowForm.tlNo.trim() || undefined,
          revisionNumber: "R0",
        }),
      });
      setMsg(`GFC row ${addRowForm.drawingNumber} added — also synced to master register. Upload PDF/DWG when ready.`);
      setAddRowOpen(false);
      setAddRowForm({
        drawingNumber: "",
        title: "",
        discipline: filter !== "All" ? filter : "Architecture",
        buildingArea: "",
        tlNo: "",
      });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add row");
    } finally {
      setBusy(false);
    }
  }
  const filtered = useMemo(
    () => (filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter)),
    [drawings, filter]
  );
  const revSlots = useMemo(() => gfcRevSlots(drawings), [drawings]);
  const uploadTarget = drawings.find((d) => d.id === uploadForId);
  const replaceRev = useMemo(() => {
    if (!uploadTarget || !replaceRevisionId) return null;
    return (uploadTarget.revisions || []).find((r: any) => r.id === replaceRevisionId) || null;
  }, [uploadTarget, replaceRevisionId]);
  const revModalOpen =
    revUploadMode === "new"
      ? !!uploadForId && !!revUnlockToken
      : !!uploadForId && !!replaceRevisionId;

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

  function revisionHasFiles(rev: any) {
    return !!(rev?.pdfFileUrl || rev?.dwgFileUrl || rev?.fileUrl);
  }

  function openLatestViewer(d: any) {
    const latest = gfcCurrentRevision(d);
    if (!latest || !revisionHasFiles(latest)) return;
    setViewer(previewFromRev(d, latest));
  }

  async function patchRevisionPlanned(revId: string, plannedDate: string) {
    await api(`/api/drawings/revision/${revId}/dates`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ plannedDate: plannedDate || null }),
    });
    await load();
  }

  async function registerDrawing(e: FormEvent) {
    e.preventDefault();
    if (!unlockToken) {
      setFormError("Complete Drawing Check Master first.");
      return;
    }
    if (!registerPdf && !registerDwg) {
      setFormError("Choose at least one of PDF or DWG.");
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
      if (registerPdf) fd.append("pdf", registerPdf);
      if (registerDwg) fd.append("dwg", registerDwg);
      appendIssueToFormData(fd, registerIssue);
      await api<any>(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
      setForm({
        drawingNumber: "",
        title: "",
        discipline: form.discipline,
        buildingArea: "",
        tlNo: "",
        revisionNumber: "R0",
        publish: true,
      });
      setRegisterPdf(null);
      setRegisterDwg(null);
      setRegisterIssue(emptyDrawingIssueDraft());
      setUnlockToken(null);
      setShowRegister(false);
      setMsg("Drawing saved to GFC register (PDF + DWG).");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function closeRegister() {
    setShowRegister(false);
    setRegisterPdf(null);
    setRegisterDwg(null);
    setRegisterIssue(emptyDrawingIssueDraft());
    setFormError("");
    setUnlockToken(null);
  }

  function resetRevUpload() {
    setUploadForId(null);
    setRevPdf(null);
    setRevDwg(null);
    setRevIssue(emptyDrawingIssueDraft());
    setRevUnlockToken(null);
    setReplaceRevisionId(null);
    setRevUploadMode("new");
    setRevReplaceRole("pdf");
    setFormError("");
  }

  async function uploadRevision(e: FormEvent) {
    e.preventDefault();
    if (!uploadForId) return;
    if (revUploadMode === "replace") {
      const replaceFile = revReplaceRole === "dwg" ? revDwg : revPdf;
      const hasIssue = issueDraftHasData(revIssue);
      if (!replaceFile && !hasIssue) {
        setFormError(`Choose a ${revReplaceRole.toUpperCase()} file or receive/issue details.`);
        return;
      }
    } else if (revUploadMode === "update") {
      if (!revPdf && !revDwg && !issueDraftHasData(revIssue)) {
        setFormError("Choose PDF/DWG or optional receive/issue details.");
        return;
      }
    } else if (!revPdf && !revDwg) {
      setFormError("Choose at least one of PDF or DWG.");
      return;
    }
    setBusy(true);
    setMsg("");
    setFormError("");
    try {
      if (revUploadMode === "replace" && replaceRevisionId) {
        const replaceFile = revReplaceRole === "dwg" ? revDwg : revPdf;
        if (replaceFile) {
          const fd = new FormData();
          fd.append("file", replaceFile);
          fd.append("fileRole", revReplaceRole);
          fd.append("note", revForm.revisionLabel || `${revReplaceRole.toUpperCase()} updated on revision`);
          appendIssueToFormData(fd, revIssue);
          await api(`/api/drawings/revision/${replaceRevisionId}/file`, { method: "PATCH", token, body: fd });
        } else {
          const fd = new FormData();
          fd.append("note", revForm.revisionLabel || "Receive & issue update");
          appendIssueToFormData(fd, revIssue);
          await api(`/api/drawings/revision/${replaceRevisionId}/file`, { method: "PATCH", token, body: fd });
        }
        setExpandedId(uploadForId);
        setMsg(`${revForm.revisionNumber} updated — same revision row; register stays in sync.`);
      } else if (revUploadMode === "update" && replaceRevisionId && !revPdf && !revDwg && issueDraftHasData(revIssue)) {
        const fd = new FormData();
        fd.append("note", revForm.revisionLabel || "Receive & issue update");
        appendIssueToFormData(fd, revIssue);
        await api(`/api/drawings/revision/${replaceRevisionId}/file`, { method: "PATCH", token, body: fd });
        setExpandedId(uploadForId);
        setMsg(`${revForm.revisionNumber} receive/issue saved.`);
      } else {
        if (revUploadMode === "new" && !revUnlockToken) {
          setFormError("Complete Drawing Check Master before a new revision upload.");
          return;
        }
        const fd = new FormData();
        fd.append("revisionNumber", revForm.revisionNumber);
        fd.append("revisionLabel", revForm.revisionLabel || revForm.revisionNumber);
        fd.append("publish", String(revForm.publish));
        if (revUnlockToken) fd.append("unlockToken", revUnlockToken);
        if (plannedDate) fd.append("plannedDate", plannedDate);
        if (actualDate) fd.append("actualDate", actualDate);
        if (revPdf) fd.append("pdf", revPdf);
        if (revDwg) fd.append("dwg", revDwg);
        appendIssueToFormData(fd, revIssue);
        const hadRev = (uploadTarget?.revisions || []).some(
          (r: any) => normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(revForm.revisionNumber)
        );
        await api<any>(`/api/drawings/${uploadForId}/revisions`, { method: "POST", token, body: fd });
        setExpandedId(uploadForId);
        setMsg(
          hadRev
            ? `${revForm.revisionNumber} updated on the same revision row — register and current rev refreshed.`
            : "Revision uploaded — PDF and DWG logged on the GFC register."
        );
      }
      resetRevUpload();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Revision upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openUploadRev(d: any) {
    if (!id) return;
    const next = gfcNextRevisionNumber(d.revisions || []);
    setUploadForId(d.id);
    setRevUploadMode("new");
    setReplaceRevisionId(null);
    setRevUnlockToken(null);
    setRevPdf(null);
    setRevDwg(null);
    setRevIssue(emptyDrawingIssueDraft());
    setFormError("");
    setPlannedDate("");
    setActualDate(new Date().toISOString().slice(0, 10));
    setExpandedId(d.id);
    setRevForm({
      revisionNumber: next,
      revisionLabel: `${next} — ${new Date().toLocaleDateString()}`,
      publish: true,
    });
    setPrecheckMode("revision");
    setPrecheckOpen(true);
    setMsg("Complete Drawing Check Master in the overlay — revision upload unlocks after.");
  }

  function openReplaceRevision(d: any, rev: any, role: "pdf" | "dwg" = "pdf") {
    setUploadForId(d.id);
    setRevUploadMode("replace");
    setReplaceRevisionId(rev.id);
    setRevReplaceRole(role);
    setRevUnlockToken(null);
    setRevPdf(null);
    setRevDwg(null);
    setRevIssue(issueFromRevision(rev));
    setFormError("");
    setPrecheckOpen(false);
    setPlannedDate("");
    setActualDate(new Date().toISOString().slice(0, 10));
    setExpandedId(d.id);
    setRevForm({
      revisionNumber: rev.revisionNumber,
      revisionLabel: `${rev.revisionNumber} — ${role.toUpperCase()} update`,
      publish: !!rev.published,
    });
    setMsg(`Replace ${role.toUpperCase()} on ${rev.revisionNumber} — upload modal opens from the log accordion.`);
  }

  function openUpdateRevision(d: any, rev: any) {
    setUploadForId(d.id);
    setRevUploadMode("update");
    setReplaceRevisionId(rev.id);
    setRevReplaceRole("pdf");
    setRevUnlockToken(null);
    setRevPdf(null);
    setRevDwg(null);
    setRevIssue(issueFromRevision(rev));
    setFormError("");
    setPrecheckOpen(false);
    setPlannedDate(rev.plannedDate ? String(rev.plannedDate).slice(0, 10) : "");
    setActualDate(
      rev.actualDate ? String(rev.actualDate).slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setExpandedId(d.id);
    setRevForm({
      revisionNumber: rev.revisionNumber,
      revisionLabel: rev.revisionLabel || rev.revisionNumber,
      publish: !!rev.published,
    });
    setMsg(`Update ${rev.revisionNumber} on ${d.drawingNumber} — no checklist needed for same-revision changes.`);
  }

  return (
    <div className="space-y-4 min-w-0">
      <PageHeader
        dense
        eyebrow="Drawings module · GFC"
        title="GFC register"
        subtitle={
          clientOnly
            ? "View published sheets and revision dates."
            : "Upload PDF/DWG, revisions, and site receive/issue signatures. DCI master lines live under Master register."
        }
        actions={
          canUpload ? (
            <>
              <Link
                to={`/projects/${id}/drawings/register?sheet=master`}
                className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold text-brand hover:bg-sand/60"
              >
                Master register →
              </Link>
              <Button type="button" variant="secondary" onClick={() => {
                setAddRowForm((f) => ({
                  ...f,
                  discipline: filter !== "All" ? filter : f.discipline,
                }));
                setAddRowOpen(true);
              }}>
                + Add row
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

      {canUpload && addRowOpen && (
        <Card className="border-brand/30">
          <h3 className="font-semibold mb-1">Add GFC register row (no file yet)</h3>
          <p className="text-xs text-steel-muted mb-3">
            Creates a discipline line on GFC register and mirrors it on the master drawing register. Upload PDF/DWG later via Drawing Check.
          </p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addGfcRow}>
            <Input
              required
              placeholder="DWG / drawing number"
              value={addRowForm.drawingNumber}
              onChange={(e) => setAddRowForm({ ...addRowForm, drawingNumber: e.target.value })}
            />
            <Input
              required
              placeholder="Drawing title"
              value={addRowForm.title}
              onChange={(e) => setAddRowForm({ ...addRowForm, title: e.target.value })}
            />
            <Select
              value={addRowForm.discipline}
              onChange={(e) => setAddRowForm({ ...addRowForm, discipline: e.target.value })}
            >
              {[...GFC_DISCIPLINE_TABS, ...MASTER_REGISTER_DISCIPLINES.filter((d) => !GFC_DISCIPLINE_TABS.includes(d as typeof GFC_DISCIPLINE_TABS[number]))].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Input
              placeholder="Building / area"
              value={addRowForm.buildingArea}
              onChange={(e) => setAddRowForm({ ...addRowForm, buildingArea: e.target.value })}
            />
            <Input
              placeholder="TL No"
              value={addRowForm.tlNo}
              onChange={(e) => setAddRowForm({ ...addRowForm, tlNo: e.target.value })}
            />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save row"}</Button>
              <Button type="button" variant="secondary" onClick={() => setAddRowOpen(false)}>Cancel</Button>
            </div>
          </form>
          {formError && <p className="text-sm text-danger mt-2">{formError}</p>}
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
          file={registerPdf || registerDwg}
          onFile={() => undefined}
          canSubmit={!!registerPdf || !!registerDwg}
          filePicker={
            <DrawingUploadFilePicker
              pdfFile={registerPdf}
              dwgFile={registerDwg}
              onPdfFile={setRegisterPdf}
              onDwgFile={setRegisterDwg}
            />
          }
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
            {
              kind: "custom",
              node: id ? (
                <DrawingIssueFields projectId={id} token={token} value={registerIssue} onChange={setRegisterIssue} />
              ) : null,
            },
          ]}
        />
      )}

      <Card padding={false} className="overflow-hidden drawings-register">
        <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">GFC drawing log</div>
            <div className="text-[11px] text-white/70">Discipline · Area · TL · DWG · R0–Rn · upload log &amp; signatures</div>
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
                {revSlots.map((r) => (
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
                const revsByNum = gfcRevisionsByNumber(d.revisions || []);
                const latest = gfcCurrentRevision(d);
                const open = expandedId === d.id;
                const colSpan = 6 + revSlots.length + 2;
                return (
                  <Fragment key={d.id}>
                    <tr className={`border-t border-line ${open ? "bg-brand-soft/30" : "hover:bg-sand/40"}`}>
                      <td className="px-2 py-2 text-xs">{d.discipline}</td>
                      <td className="px-2 py-2 text-xs">{d.buildingArea || "—"}</td>
                      <td className="px-2 py-2 text-xs font-mono">{d.tlNo || "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-brand font-semibold">{d.drawingNumber}</td>
                      <td className="px-2 py-2 font-medium max-w-[180px]">{d.title}</td>
                      <td className="px-2 py-2">
                        {latest && revisionHasFiles(latest) ? (
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
                      {revSlots.map((slot) => {
                        const r = gfcRevisionForSlot(d.revisions || [], slot);
                        const plannedDay = r?.plannedDate
                          ? new Date(r.plannedDate).toISOString().slice(0, 10)
                          : "";
                        return (
                          <td
                            key={slot}
                            className="px-1 py-1 text-[10px] text-center font-mono text-steel-muted whitespace-nowrap align-top"
                            title={r?.revisionLabel || ""}
                          >
                            {canUpload && r?.id ? (
                              <div className="space-y-0.5">
                                <input
                                  type="date"
                                  className="w-full max-w-[6.5rem] text-[10px] border border-line rounded px-0.5 py-0.5 bg-white"
                                  value={plannedDay}
                                  onChange={(e) => void patchRevisionPlanned(r.id, e.target.value)}
                                />
                                <div className="text-[9px] text-steel-muted">{gfcDateLabel(r).replace(/^P:/, "A:")}</div>
                              </div>
                            ) : (
                              gfcDateLabel(r)
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-mono text-xs">{revsByNum.length}</td>
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
                        <td colSpan={colSpan} className="px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-mono uppercase tracking-wide text-steel-muted">
                              Upload log — {d.drawingNumber} · current {d.currentRev || "—"}
                            </h4>
                            {canUpload && (
                              <Button type="button" className="!text-xs !py-1" onClick={() => openUploadRev(d)}>
                                + Next revision
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-steel-muted mb-3">
                            Update the same revision many times — replace PDF/DWG or re-upload with the same rev number. Register columns and current rev stay in sync.
                          </p>
                          <ul className="space-y-2">
                            {revsByNum.map((r: any, idx: number) => (
                              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
                                <div>
                                  <div className="font-semibold">
                                    {r.revisionNumber || `R${idx}`}
                                    {normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(d.currentRev) && (
                                      <span className="ml-2 text-[10px] text-brand font-mono">CURRENT</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-steel-muted">
                                    {fmtDate(r.createdAt)} · {r.revisionLabel || "—"}
                                    {r.uploadedBy?.fullName ? ` · ${r.uploadedBy.fullName}` : ""}
                                  </div>
                                  {r.pdfFileName && <div className="text-[11px] font-mono mt-0.5">PDF · {r.pdfFileName}</div>}
                                  {r.dwgFileName && <div className="text-[11px] font-mono">DWG · {r.dwgFileName}</div>}
                                  {!r.pdfFileName && !r.dwgFileName && r.fileName && (
                                    <div className="text-[11px] font-mono mt-0.5">{r.fileName}</div>
                                  )}
                                  <RevisionIssueLogSummary rev={r} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                                  {r.pdfFileUrl && <Badge tone="neutral">PDF</Badge>}
                                  {r.dwgFileUrl && <Badge tone="neutral">DWG</Badge>}
                                  {revisionHasFiles(r) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() => setViewer(previewFromRev(d, r))}
                                    >
                                      View
                                    </Button>
                                  )}
                                  {canUpload && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() => openUpdateRevision(d, r)}
                                    >
                                      Update files
                                    </Button>
                                  )}
                                  {canUpload && (r.pdfFileUrl || drawingFileKind(r.fileName || r.fileUrl) === "pdf") && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() => openReplaceRevision(d, r, "pdf")}
                                    >
                                      Replace PDF
                                    </Button>
                                  )}
                                  {canUpload && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() => openReplaceRevision(d, r, "dwg")}
                                    >
                                      Replace DWG
                                    </Button>
                                  )}
                                </div>
                              </li>
                            ))}
                            {!revsByNum.length && <li className="text-sm text-steel-muted">No uploads yet.</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={6 + revSlots.length + 2} className="px-4 py-10 text-center text-sm text-steel-muted">
                    No drawings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canUpload && uploadForId && uploadTarget && revUploadMode === "new" && !revUnlockToken && !precheckOpen && (
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
              resetRevUpload();
            }}
          >
            Cancel
          </Button>
        </Card>
      )}

      {canUpload && uploadForId && uploadTarget && (
        <UploadModal
          open={revModalOpen}
          title={
            revUploadMode === "replace"
              ? `Replace ${revReplaceRole.toUpperCase()}`
              : revUploadMode === "update"
                ? "Update same revision"
                : "Upload revision"
          }
          context={
            revUploadMode === "replace"
              ? `${uploadTarget.drawingNumber} · ${revForm.revisionNumber} · ${revReplaceRole.toUpperCase()} only`
              : revUploadMode === "update"
                ? `${uploadTarget.drawingNumber} · ${revForm.revisionNumber} · add/replace PDF or DWG on same row (no checklist)`
                : `${uploadTarget.drawingNumber} · new ${revForm.revisionNumber} · checklist complete`
          }
          file={revPdf || revDwg}
          onFile={() => undefined}
          canSubmit={
            revUploadMode === "replace"
              ? !!(revReplaceRole === "dwg" ? revDwg : revPdf) || issueDraftHasData(revIssue)
              : revUploadMode === "update"
                ? !!revPdf || !!revDwg || issueDraftHasData(revIssue)
                : !!revPdf || !!revDwg
          }
          filePicker={
            revUploadMode === "replace" && revReplaceRole === "dwg" ? (
              <DrawingUploadFilePicker
                pdfFile={null}
                dwgFile={revDwg}
                onPdfFile={() => undefined}
                onDwgFile={setRevDwg}
              />
            ) : revUploadMode === "replace" && revReplaceRole === "pdf" ? (
              <DrawingUploadFilePicker
                pdfFile={revPdf}
                dwgFile={null}
                onPdfFile={setRevPdf}
                onDwgFile={() => undefined}
              />
            ) : (
              <DrawingUploadFilePicker pdfFile={revPdf} dwgFile={revDwg} onPdfFile={setRevPdf} onDwgFile={setRevDwg} />
            )
          }
          primaryLabel={
            revUploadMode === "replace" || revUploadMode === "update"
              ? "Save on same revision"
              : "Upload & log planned/actual"
          }
          busy={busy}
          error={formError}
          onClose={resetRevUpload}
          onSubmit={uploadRevision}
          fields={[
            ...(revUploadMode === "replace"
              ? [
                  {
                    kind: "text" as const,
                    name: "revisionLabel",
                    label: "Log note",
                    value: revForm.revisionLabel,
                    onChange: (v: string) => setRevForm({ ...revForm, revisionLabel: v }),
                  },
                ]
              : revUploadMode === "update"
                ? [
                    {
                      kind: "text" as const,
                      name: "revisionNumber",
                      label: "Revision (fixed)",
                      value: revForm.revisionNumber,
                      onChange: () => undefined,
                    },
                    {
                      kind: "text" as const,
                      name: "revisionLabel",
                      label: "Label / note",
                      value: revForm.revisionLabel,
                      onChange: (v: string) => setRevForm({ ...revForm, revisionLabel: v }),
                    },
                    {
                      kind: "text" as const,
                      name: "plannedDate",
                      label: "Planned date",
                      value: plannedDate,
                      onChange: setPlannedDate,
                      placeholder: "YYYY-MM-DD",
                    },
                    {
                      kind: "text" as const,
                      name: "actualDate",
                      label: "Actual date",
                      value: actualDate,
                      onChange: setActualDate,
                      placeholder: "YYYY-MM-DD",
                    },
                    {
                      kind: "checkbox" as const,
                      name: "publish",
                      label: "Set as current published revision",
                      checked: revForm.publish,
                      onChange: (v: boolean) => setRevForm({ ...revForm, publish: v }),
                    },
                  ]
                : [
                    {
                      kind: "text" as const,
                      name: "revisionNumber",
                      label: "Revision",
                      required: true,
                      placeholder: "R1",
                      value: revForm.revisionNumber,
                      onChange: (v: string) => setRevForm({ ...revForm, revisionNumber: v }),
                    },
                    {
                      kind: "text" as const,
                      name: "revisionLabel",
                      label: "Label / note",
                      value: revForm.revisionLabel,
                      onChange: (v: string) => setRevForm({ ...revForm, revisionLabel: v }),
                    },
                    {
                      kind: "text" as const,
                      name: "plannedDate",
                      label: "Planned date",
                      value: plannedDate,
                      onChange: setPlannedDate,
                      placeholder: "YYYY-MM-DD",
                    },
                    {
                      kind: "text" as const,
                      name: "actualDate",
                      label: "Actual date",
                      value: actualDate,
                      onChange: setActualDate,
                      placeholder: "YYYY-MM-DD",
                    },
                    {
                      kind: "checkbox" as const,
                      name: "publish",
                      label: "Set as current published revision",
                      checked: revForm.publish,
                      onChange: (v: boolean) => setRevForm({ ...revForm, publish: v }),
                    },
                  ]),
            {
              kind: "custom" as const,
              node: (
                <DrawingIssueFields
                  projectId={id!}
                  token={token}
                  value={revIssue}
                  onChange={setRevIssue}
                  existingClientSignUrl={replaceRev?.clientSignUrl}
                  existingPmcSignUrl={replaceRev?.pmcSignUrl}
                  existingSiteEngineerSignUrl={replaceRev?.siteEngineerSignUrl}
                />
              ),
            },
          ]}
        />
      )}

      {viewer && <DrawingFileViewer revision={viewer} variant="modal" onClose={() => setViewer(null)} />}
    </div>
  );
}

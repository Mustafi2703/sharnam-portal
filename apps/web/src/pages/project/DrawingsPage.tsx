import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { UploadModal } from "../../components/UploadModal";
import { DrawingUploadFilePicker } from "../../components/DrawingUploadFilePicker";
import { DrawingFileViewer } from "../../components/DrawingFileViewer";
import { drawingUnlockStorageKey, isDrawingUnlockMessage, openDrawingCheckWindow } from "../../lib/drawingCheckWindow";
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
  revisionPreviewFromRecord,
  type DrawingRevisionPreview,
} from "../../lib/drawingPreview";
import {
  drawingCheckFilled,
  gfcCurrentRevision,
  gfcNextRevisionNumber,
  gfcRevisionForSlot,
  gfcRevSlots,
  gfcRevisionsByNumber,
  normalizeRevNumber,
  revisionUploadStatus,
} from "../../lib/gfcRegister";
import { MASTER_REGISTER_DISCIPLINES } from "../../lib/masterDrawingRegister";
import { downloadAuthFile } from "../../lib/downloadReport";
import { StatusNote } from "../../components/StatusNote";

const GFC_DISCIPLINE_TABS = ["Architecture", "Structural", "MEPF"] as const;
const GFC_REVISION_CHOICES = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"] as const;

function RevisionShareLinks({
  rev,
  label,
  compact,
  onOpen,
}: {
  rev: any;
  label?: string;
  compact?: boolean;
  onOpen: (fileUrl?: string) => void;
}) {
  const status = revisionUploadStatus(rev);
  return (
    <div className={`flex flex-col ${compact ? "items-center" : "items-start"} gap-0.5`}>
      {label && <span className="text-[10px] font-mono text-steel-muted">{label}</span>}
      {status.pdfUrl ? (
        <button type="button" className="text-[10px] font-semibold text-brand hover:underline" onClick={() => onOpen(status.pdfUrl || undefined)}>
          Open PDF
        </button>
      ) : (
        <span className="text-[10px] text-steel-muted">PDF not uploaded</span>
      )}
      {status.dwgUrl ? (
        <button type="button" className="text-[10px] font-semibold text-brand hover:underline" onClick={() => onOpen(status.dwgUrl || undefined)}>
          Open DWG
        </button>
      ) : (
        <span className="text-[10px] text-steel-muted">DWG not uploaded</span>
      )}
    </div>
  );
}

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
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DrawingRevisionPreview | null>(null);
  const [viewerRevId, setViewerRevId] = useState<string | null>(null);
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
  const [extraPdfs, setExtraPdfs] = useState<File[]>([]);
  const [registerIssue, setRegisterIssue] = useState(emptyDrawingIssueDraft);
  const [revIssue, setRevIssue] = useState(emptyDrawingIssueDraft);
  const [revForm, setRevForm] = useState({ revisionNumber: "", revisionLabel: "", publish: true });
  const [revUploadMode, setRevUploadMode] = useState<"new" | "replace" | "update">("new");
  const [uploadStep, setUploadStep] = useState<"confirm" | "files">("files");
  const [revReplaceRole, setRevReplaceRole] = useState<"pdf" | "dwg">("pdf");
  const [replaceRevisionId, setReplaceRevisionId] = useState<string | null>(null);
  const [dumpBusy, setDumpBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [editRow, setEditRow] = useState<{
    id: string;
    drawingNumber: string;
    title: string;
    discipline: string;
    buildingArea: string;
    tlNo: string;
  } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
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
    setDrawingsLoaded(false);
    const d = await api<any[]>(`/api/drawings/project/${id}`, { token });
    setDrawings(d);
    setDrawingsLoaded(true);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const precheckModeRef = useRef(precheckMode);
  precheckModeRef.current = precheckMode;

  function applyDrawingUnlock(tok: string) {
    setPrecheckOpen(false);
    setFormError("");
    if (precheckModeRef.current === "revision") {
      setRevUnlockToken(tok);
      setUploadStep("files");
      setMsg("Checklist complete. Add stakeholder signatures, then upload the PDF and DWG.");
    } else {
      setUnlockToken(tok);
      setShowRegister(true);
      setMsg("Checklist unlocked — finish the upload form.");
    }
  }

  function launchDrawingCheck(
    mode: "register" | "revision",
    drawing?: { id: string; revisions?: { id: string; published?: boolean }[] },
    revisionNumber?: string,
  ) {
    if (!id) return false;
    setPrecheckMode(mode);
    precheckModeRef.current = mode;
    const latest = drawing?.revisions?.find((r) => r.published) || drawing?.revisions?.[0];
    openDrawingCheckWindow(
      id,
      mode,
      mode === "revision" && drawing
        ? { drawingId: drawing.id, revisionId: latest?.id, revisionNumber }
        : undefined,
    );
    setPrecheckOpen(true);
    return true;
  }

  function startUploadFlow() {
    if (!id) return;
    setFormError("");
    setUnlockToken(null);
    setShowRegister(false);
    setUploadForId(null);
    if (!launchDrawingCheck("register")) return;
    setMsg("Complete Drawing Check Master in the popup — upload opens when it unlocks.");
  }

  useEffect(() => {
    if (!id || !canUpload) return;
    const uploadMode = searchParams.get("upload");
    const drawingIdParam = searchParams.get("drawingId")?.trim() || "";

    if (uploadMode === "rev" && drawingIdParam) {
      if (!drawingsLoaded) return;
      const match = drawings.find((d) => d.id === drawingIdParam);
      setSearchParams({}, { replace: true });
      if (match) {
        openUploadRev(match);
        setMsg(`Upload revision on GFC for ${match.drawingNumber}`);
      }
      return;
    }

    if (uploadMode !== "1") return;

    const drawingNumber = searchParams.get("drawingNumber")?.trim() || "";
    if (drawingNumber && !drawingsLoaded) return;

    const title = searchParams.get("title") || "";
    const discipline = searchParams.get("discipline") || "Architecture";
    setSearchParams({}, { replace: true });

    if (drawingNumber) {
      const norm = (s: string) =>
        String(s)
          .replace(/\s·\s*\d+$/, "")
          .trim()
          .toUpperCase();
      const match = drawings.find((d) => norm(d.drawingNumber) === norm(drawingNumber));
      if (match) {
        openUploadRev(match);
        setMsg(`Master register → upload GFC revision for ${match.drawingNumber}`);
        return;
      }
      setAddRowForm({
        drawingNumber,
        title,
        discipline,
        buildingArea: "",
        tlNo: "",
      });
      setAddRowOpen(true);
      setMsg(`Master register → add GFC row for ${drawingNumber} (syncs back to master register).`);
      return;
    }

    startUploadFlow();
  }, [id, canUpload, searchParams, setSearchParams, drawings, drawingsLoaded]);

  useEffect(() => {
    const projectId = id;
    if (!projectId) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!isDrawingUnlockMessage(e.data, projectId)) return;
      applyDrawingUnlock(e.data.unlockToken);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== drawingUnlockStorageKey(projectId) || !e.newValue) return;
      applyDrawingUnlock(e.newValue);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };
  }, [id]);

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
  const revModalOpen = !!uploadForId && !!uploadTarget;

  async function exportGfcExcel() {
    if (!id) return;
    setMsg("");
    try {
      await downloadAuthFile(`/api/drawings/project/${id}/gfc-log/export.xlsx`, token, "Approval-GFC-Drawing-Log.xlsx");
      setMsg("Approval & GFC log Excel downloaded.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function syncRegistersToDrive() {
    if (!id) return;
    setDumpBusy(true);
    setMsg("Syncing the database into the SharePoint sheets…");
    try {
      await api<{ ok: boolean; week?: string }>(`/api/drawings/project/${id}/publish-registers`, {
        method: "POST",
        token,
        timeoutMs: 180_000,
      });
      setMsg("SharePoint synced — GFC log, drawing register, dashboard, drawing issues, and this week’s RFI register.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SharePoint publish failed");
    } finally {
      setDumpBusy(false);
    }
  }

  function extraFileList(rev: any): { fileUrl: string; fileName: string }[] {
    if (!rev?.extraFilesJson) return [];
    try {
      const parsed = JSON.parse(rev.extraFilesJson);
      return Array.isArray(parsed) ? parsed.filter((f) => f?.fileUrl) : [];
    } catch {
      return [];
    }
  }

  function revisionHasFiles(rev: any) {
    const status = revisionUploadStatus(rev);
    return status.pdf || status.dwg || extraFileList(rev).some((f) => !/\/pending\//i.test(f.fileUrl || ""));
  }

  function openLatestViewer(d: any) {
    const latest = gfcCurrentRevision(d);
    if (!latest || !revisionHasFiles(latest)) return;
    setViewerRevId(latest.id);
    setViewer(previewFromRev(d, latest));
  }

  async function openRevisionSharePoint(revId: string, fileUrl?: string) {
    try {
      const q = fileUrl ? `?fileUrl=${encodeURIComponent(fileUrl)}` : "";
      const r = await api<{ sharePointUrl?: string | null }>(`/api/drawings/revision/${revId}/sharepoint${q}`, { token });
      if (r.sharePointUrl) window.open(r.sharePointUrl, "_blank", "noopener,noreferrer");
      else setMsg("PDF stays in this viewer. The SharePoint link appears once the file is in the project library.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open SharePoint");
    }
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
    if (!registerPdf && !registerDwg && !extraPdfs.length) {
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
      for (const extra of extraPdfs) fd.append("extraPdf", extra);
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
      setExtraPdfs([]);
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
    setExtraPdfs([]);
    setRevDwg(null);
    setRevIssue(emptyDrawingIssueDraft());
    setRevUnlockToken(null);
    setReplaceRevisionId(null);
    setRevUploadMode("new");
    setUploadStep("files");
    setRevReplaceRole("pdf");
    setFormError("");
  }

  async function uploadRevision(e: FormEvent) {
    e.preventDefault();
    if (!uploadForId) return;
    if (uploadStep === "confirm") {
      const needsCheck = revUploadMode !== "replace" && !revUnlockToken;
      if (!needsCheck) {
        setUploadStep("files");
        setMsg(`${uploadTarget?.drawingNumber || "Drawing"} · ${revForm.revisionNumber} confirmed. Add signatures and the PDF or DWG.`);
        return;
      }
      const match = (uploadTarget?.revisions || []).find(
        (r: any) => normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(revForm.revisionNumber)
      );
      launchDrawingCheck(
        "revision",
        {
          id: uploadForId,
          revisions: match ? [{ id: match.id, published: match.published }] : uploadTarget?.revisions,
        },
        revForm.revisionNumber,
      );
      setMsg(
        `${uploadTarget?.drawingNumber || "Drawing"} · ${revForm.revisionNumber} confirmed. Fill the checklist. Save a draft if it is not complete — it is logged in the checklist fill log. After submit and sign, upload the files here.`
      );
      return;
    }
    if (revUploadMode === "replace") {
      const replaceFile = revReplaceRole === "dwg" ? revDwg : revPdf;
      const hasIssue = issueDraftHasData(revIssue);
      if (!replaceFile && !hasIssue) {
        setFormError(`Choose a ${revReplaceRole.toUpperCase()} file or receive/issue details.`);
        return;
      }
    } else if (revUploadMode === "update") {
      if (!revPdf && !revDwg && !extraPdfs.length && !issueDraftHasData(revIssue)) {
        setFormError("Choose PDF/DWG or optional receive/issue details.");
        return;
      }
    } else if (revUploadMode === "new" && !revUnlockToken) {
      setFormError("Complete the Drawing Check for this revision, including the signature, before uploading files.");
      return;
    } else if (!revPdf && !revDwg && !extraPdfs.length) {
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
      } else if (revUploadMode === "update" && replaceRevisionId && !revPdf && !revDwg && !extraPdfs.length && issueDraftHasData(revIssue)) {
        const fd = new FormData();
        fd.append("note", revForm.revisionLabel || "Receive & issue update");
        appendIssueToFormData(fd, revIssue);
        await api(`/api/drawings/revision/${replaceRevisionId}/file`, { method: "PATCH", token, body: fd });
        setExpandedId(uploadForId);
        setMsg(`${revForm.revisionNumber} receive/issue saved.`);
      } else {
        if (revUploadMode === "new" && !revUnlockToken) {
          setFormError("Complete the Drawing Check for this revision, including the signature, before uploading files.");
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
        for (const extra of extraPdfs) fd.append("extraPdf", extra);
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
    const latest = gfcCurrentRevision(d);
    setUploadForId(d.id);
    setRevUnlockToken(null);
    setRevPdf(null);
    setExtraPdfs([]);
    setRevDwg(null);
    setFormError("");
    setPrecheckOpen(false);
    // Blank planned date → the server keeps the planned date PMC set on the master register.
    setPlannedDate("");
    setActualDate(new Date().toISOString().slice(0, 10));
    setExpandedId(d.id);
    const next = gfcNextRevisionNumber(d.revisions || []);
    setRevUploadMode("new");
    setUploadStep("confirm");
    setReplaceRevisionId(null);
    setRevIssue(latest ? issueFromRevision(latest) : emptyDrawingIssueDraft());
    setRevForm({
      revisionNumber: next,
      revisionLabel: `${next} — ${new Date().toLocaleDateString()}`,
      publish: true,
    });
    setMsg("Check the revision details, then confirm. The checklist opens next. A saved draft can be continued from the same button.");
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
    setUploadStep("files");
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
    setUploadStep("files");
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
        eyebrow="Drawings module · Approval & GFC"
        title="Approval & GFC drawing log"
        subtitle={
          clientOnly
            ? "View published sheets and revision dates (Approval & GFC Drawing Log.xlsx layout)."
            : "Upload PDF/DWG, revisions, and site receive/issue signatures — same columns as Approval & GFC Drawing Log.xlsx."
        }
        actions={
          canUpload ? (
            <>
              <Link
                to={`/projects/${id}/drawings/register/master`}
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
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-line bg-paper shadow-lg p-2 space-y-1">
            <ReportExportButtons projectId={id} kind="drawings" label="Register" menu />
            <Button
              type="button"
              variant="ghost"
              className="w-full !justify-start !text-sm !py-2"
              onClick={(e) => {
                void exportGfcExcel();
                (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
              }}
            >
              Download GFC Excel
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full !justify-start !text-sm !py-2"
              onClick={(e) => {
                (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                return downloadAuthFile(`/api/drawings/project/${id}/gfc-log/export.pdf`, token, "Approval-GFC-Drawing-Log.pdf").catch(
                  (err) => setMsg(err instanceof Error ? err.message : "Could not download the PDF"),
                );
              }}
            >
              Download GFC PDF
            </Button>
            {canUpload && (
              <>
                {user?.role === "admin" || user?.role === "office" ? (
                <label className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-sand/60">
                  {dumpBusy ? "Working…" : "Import GFC Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    disabled={dumpBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                      if (!f || !id) return;
                      setDumpBusy(true);
                      setMsg("Importing Approval & GFC log…");
                      const fd = new FormData();
                      fd.append("file", f);
                      void api<{ drawings: number; revisions: number }>(`/api/drawings/project/${id}/gfc-log/import`, {
                        method: "POST",
                        token,
                        body: fd,
                        timeoutMs: 180_000,
                      })
                        .then(async (out) => {
                          setMsg(`Imported ${out.drawings} drawings, ${out.revisions} new revision dates.`);
                          await load();
                        })
                        .catch((err) => setMsg(err instanceof Error ? err.message : "GFC import failed"))
                        .finally(() => setDumpBusy(false));
                    }}
                  />
                </label>
                ) : null}
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
                  {dumpBusy ? "Syncing…" : "Sync to SharePoint"}
                </Button>
              </>
            )}
          </div>
        </details>
      </div>

      <StatusNote msg={msg} />

      {canUpload && precheckOpen && !unlockToken && precheckMode === "register" && (
        <Card className="border-warn/40 bg-[color-mix(in_srgb,var(--color-warn)_12%,var(--color-paper))]">
          <div className="font-semibold text-ink">Waiting for Drawing Check Master</div>
          <p className="text-sm text-steel-muted mt-1">
            Finish the checklist in the popup window, or open it again if you closed it.
          </p>
          <Button type="button" className="mt-3" onClick={() => startUploadFlow()}>
            Re-open checklist window
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

      {canUpload && (
        <UploadModal
          open={showRegister && !!unlockToken}
          title="Upload drawing"
          context={`Project · Approval & GFC log · checklist complete · ${form.discipline}`}
          file={registerPdf || registerDwg}
          onFile={() => undefined}
          canSubmit={!!registerPdf || !!registerDwg || extraPdfs.length > 0}
          filePicker={
            <DrawingUploadFilePicker
              pdfFile={registerPdf}
              dwgFile={registerDwg}
              extraPdfFiles={extraPdfs}
              onPdfFile={setRegisterPdf}
              onDwgFile={setRegisterDwg}
              onExtraPdfFiles={setExtraPdfs}
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
              kind: "select",
              name: "revisionNumber",
              label: "Revision — several drawings can use the same one",
              value: form.revisionNumber,
              onChange: (v) => setForm({ ...form, revisionNumber: v }),
              options: [...GFC_REVISION_CHOICES],
            },
            {
              kind: "text",
              name: "plannedDate",
              label: "Planned submission date (optional — master register date is used if blank)",
              value: plannedDate,
              onChange: setPlannedDate,
              inputType: "date",
            },
            {
              kind: "text",
              name: "actualDate",
              label: "Revision / receipt date",
              value: actualDate,
              onChange: setActualDate,
              inputType: "date",
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
                        {latest ? (
                          <RevisionShareLinks
                            rev={latest}
                            label={latest.revisionNumber || d.currentRev}
                            onOpen={(fileUrl) => void openRevisionSharePoint(latest.id, fileUrl)}
                          />
                        ) : (
                          <span className="text-xs text-steel-muted">—</span>
                        )}
                        {drawingCheckFilled(d) && (
                          <div className="text-[10px] text-steel-muted mt-0.5">Checklist logged</div>
                        )}
                      </td>
                      {revSlots.map((slot) => {
                        const r = gfcRevisionForSlot(d.revisions || [], slot);
                        const plannedDay = r?.plannedDate
                          ? new Date(r.plannedDate).toISOString().slice(0, 10)
                          : "";
                        const actualLabel = r?.actualDate
                          ? new Date(r.actualDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                          : "—";
                        return (
                          <td
                            key={slot}
                            className="px-1 py-1 text-[10px] text-center font-mono text-steel-muted whitespace-nowrap align-top"
                            title={r?.revisionLabel || ""}
                          >
                            {r?.id ? (
                              <div className="space-y-0.5">
                                {canUpload ? (
                                  <input
                                    type="date"
                                    title="Planned — also editable on the master register"
                                    className="w-full max-w-[6.5rem] text-[10px] border border-line rounded px-0.5 py-0.5 bg-white"
                                    value={plannedDay}
                                    onChange={(e) => void patchRevisionPlanned(r.id, e.target.value)}
                                  />
                                ) : (
                                  <div>{plannedDay || "Plan —"}</div>
                                )}
                                <div className="text-[9px] text-steel-muted">Actual {actualLabel}</div>
                                <RevisionShareLinks
                                  rev={r}
                                  compact
                                  onOpen={(fileUrl) => void openRevisionSharePoint(r.id, fileUrl)}
                                />
                              </div>
                            ) : (
                              "—"
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
                          {canUpload && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="!px-2 !py-1 !text-xs"
                              onClick={() =>
                                setEditRow({
                                  id: d.id,
                                  drawingNumber: d.drawingNumber || "",
                                  title: d.title || "",
                                  discipline: d.discipline || "Architecture",
                                  buildingArea: d.buildingArea || "",
                                  tlNo: d.tlNo || "",
                                })
                              }
                            >
                              Edit
                            </Button>
                          )}
                          {canUpload && (
                            <Button
                              type="button"
                              variant="danger"
                              className="!px-2 !py-1 !text-xs"
                              disabled={clearBusy}
                              onClick={() => {
                                if (!window.confirm(`Delete drawing ${d.drawingNumber}? Revisions on this row are removed. SharePoint files stay.`)) {
                                  return;
                                }
                                void (async () => {
                                  try {
                                    await api(`/api/drawings/drawing/${d.id}`, { method: "DELETE", token });
                                    setMsg(`Deleted ${d.drawingNumber}`);
                                    await load();
                                  } catch (err) {
                                    setMsg(err instanceof Error ? err.message : "Could not delete drawing");
                                  }
                                })();
                              }}
                            >
                              Delete
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
                                  <RevisionShareLinks
                                    rev={r}
                                    onOpen={(fileUrl) => void openRevisionSharePoint(r.id, fileUrl)}
                                  />
                                  {extraFileList(r).map((f) => (
                                    <div key={f.fileUrl} className="text-[11px] font-mono flex flex-wrap gap-2 mt-0.5">
                                      <span>PDF · {f.fileName}</span>
                                      <button type="button" className="text-brand font-semibold" onClick={() => {
                                        setViewerRevId(r.id);
                                        setViewer(previewFromRev(d, { ...r, pdfFileUrl: f.fileUrl, pdfFileName: f.fileName }));
                                      }}>
                                        View
                                      </button>
                                      <button type="button" className="text-brand font-semibold" onClick={() => void openRevisionSharePoint(r.id, f.fileUrl)}>
                                        SharePoint
                                      </button>
                                    </div>
                                  ))}
                                  {!r.pdfFileName && !r.dwgFileName && r.fileName && (
                                    <div className="text-[11px] font-mono mt-0.5">{r.fileName}</div>
                                  )}
                                  <RevisionIssueLogSummary rev={r} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                                  {revisionUploadStatus(r).pdf && <Badge tone="ok">PDF</Badge>}
                                  {revisionUploadStatus(r).dwg && <Badge tone="ok">DWG</Badge>}
                                  {!revisionUploadStatus(r).pdf && !revisionUploadStatus(r).dwg && (
                                    <Badge tone="neutral">No file</Badge>
                                  )}
                                  {revisionHasFiles(r) && revisionUploadStatus(r).pdf && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() => {
                                        setViewerRevId(r.id);
                                        setViewer(previewFromRev(d, r));
                                      }}
                                    >
                                      Preview PDF
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

      {canUpload && uploadForId && uploadTarget && (
        <UploadModal
          open={revModalOpen}
          title={
            uploadStep === "confirm"
              ? `Confirm ${revForm.revisionNumber || "revision"}`
              : revUploadMode === "replace"
              ? `Replace ${revReplaceRole.toUpperCase()}`
              : revUploadMode === "update"
                ? "Update same revision"
                : "Upload revision"
          }
          context={
            revUploadMode === "replace"
              ? `${uploadTarget.drawingNumber} · ${revForm.revisionNumber} · ${revReplaceRole.toUpperCase()} only`
              : revUploadMode === "update"
                ? `${uploadTarget.drawingNumber} · ${revForm.revisionNumber} · same revision, signatures and files only`
                : `${uploadTarget.drawingNumber} · new ${revForm.revisionNumber} · checklist, then sign, then upload`
          }
          file={revPdf || revDwg}
          onFile={() => undefined}
          canSubmit={
            uploadStep === "confirm"
              ? !!revForm.revisionNumber
              : revUploadMode === "replace"
              ? !!(revReplaceRole === "dwg" ? revDwg : revPdf) || extraPdfs.length > 0 || issueDraftHasData(revIssue)
              : revUploadMode === "update"
                ? !!revPdf || !!revDwg || extraPdfs.length > 0 || issueDraftHasData(revIssue)
                : (!!revPdf || !!revDwg || extraPdfs.length > 0) && !!revUnlockToken
          }
          filePicker={
            uploadStep === "confirm" ? (
              <div className="rounded-xl border border-line bg-sand/40 p-3 text-sm space-y-1">
                <p className="font-medium text-ink">Confirm this revision, then the checklist opens</p>
                <p><span className="text-steel-muted">Drawing no.</span> {uploadTarget.drawingNumber || "—"}</p>
                <p><span className="text-steel-muted">Title</span> {uploadTarget.title || "—"}</p>
                <p><span className="text-steel-muted">Drawing type</span> {uploadTarget.discipline || "—"}</p>
                <p><span className="text-steel-muted">Building</span> {uploadTarget.buildingArea || uploadTarget.building || "—"}</p>
                <div className="grid sm:grid-cols-3 gap-2 pt-2">
                  <Select
                    label="Revision"
                    hint={`Suggested: ${gfcNextRevisionNumber(uploadTarget.revisions || [])}`}
                    value={revForm.revisionNumber}
                    onChange={(e) =>
                      setRevForm({
                        ...revForm,
                        revisionNumber: e.target.value,
                        revisionLabel: `${e.target.value} — ${new Date(actualDate || Date.now()).toLocaleDateString()}`,
                      })
                    }
                  >
                    {[...new Set([revForm.revisionNumber, ...GFC_REVISION_CHOICES].filter(Boolean))].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Revision date"
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                  />
                  <Input
                    label="Planned date"
                    hint="Blank = master register date"
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                  />
                </div>
                <p className="text-xs text-steel-muted pt-1">
                  Confirm opens the checklist on this page. Save a draft if it is not finished — confirm again to continue that draft, then sign and upload the PDF and DWG.
                </p>
              </div>
            ) : revUploadMode === "replace" && revReplaceRole === "dwg" ? (
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
              <DrawingUploadFilePicker
                pdfFile={revPdf}
                dwgFile={revDwg}
                extraPdfFiles={extraPdfs}
                onPdfFile={setRevPdf}
                onDwgFile={setRevDwg}
                onExtraPdfFiles={setExtraPdfs}
              />
            )
          }
          primaryLabel={
            uploadStep === "confirm"
              ? "Confirm and open checklist"
              : revUploadMode === "replace" || revUploadMode === "update"
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
                      kind: "select" as const,
                      name: "revisionNumber",
                      label: "Revision or new revision",
                      value: (() => {
                        const next = gfcNextRevisionNumber(uploadTarget?.revisions || []);
                        const existing = (uploadTarget?.revisions || []).some(
                          (r: any) => normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(revForm.revisionNumber),
                        );
                        return existing ? `${revForm.revisionNumber} (this revision)` : `${next} (new column)`;
                      })(),
                      options: [
                        ...(uploadTarget?.revisions || [])
                          .map((r: any) => String(r.revisionNumber || "").trim())
                          .filter(Boolean)
                          .map((n: string) => `${n} (this revision)`),
                        `${gfcNextRevisionNumber(uploadTarget?.revisions || [])} (new column)`,
                      ],
                      onChange: (v: string) => {
                        const number = v.replace(/\s*\(.*\)$/, "").trim();
                        const existing = (uploadTarget?.revisions || []).find(
                          (r: any) => normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(number),
                        );
                        if (existing && !v.includes("new column")) {
                          setRevUploadMode("update");
                          setReplaceRevisionId(existing.id);
                          setRevForm({
                            ...revForm,
                            revisionNumber: existing.revisionNumber,
                            revisionLabel: existing.revisionLabel || existing.revisionNumber,
                          });
                        } else {
                          setRevUploadMode("new");
                          setUploadStep(revUnlockToken ? "files" : "confirm");
                          setReplaceRevisionId(null);
                          setRevForm({
                            ...revForm,
                            revisionNumber: number,
                            revisionLabel: `${number} — ${new Date().toLocaleDateString()}`,
                          });
                        }
                      },
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
            ...(uploadStep === "confirm"
              ? []
              : [
            {
              kind: "custom" as const,
              node: (
                <div className="space-y-3">
                  {revUploadMode === "new" && !revUnlockToken && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                      <p className="text-sm text-ink">
                        This revision still needs the Drawing Check. Save a draft if it is not complete. After submit, add the signature here and upload the files.
                      </p>
                      <Button type="button" className="mt-2 !bg-amber-500 !font-medium" onClick={() => launchDrawingCheck("revision", uploadTarget, revForm.revisionNumber)}>
                        Open Drawing Check
                      </Button>
                    </div>
                  )}
                  {revUploadMode === "new" && revUnlockToken && (
                    <p className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                      Checklist complete for {revForm.revisionNumber}. Add stakeholder signatures, then upload the PDF and DWG.
                    </p>
                  )}
                  <DrawingIssueFields
                    projectId={id!}
                    token={token}
                    value={revIssue}
                    onChange={setRevIssue}
                    existingClientSignUrl={replaceRev?.clientSignUrl}
                    existingPmcSignUrl={replaceRev?.pmcSignUrl}
                    existingSiteEngineerSignUrl={replaceRev?.siteEngineerSignUrl}
                  />
                </div>
              ),
            },
              ]),
          ]}
        />
      )}

      {editRow && (
        <div className="fixed inset-0 z-[80] bg-ink/45 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
          <form
            className="w-full max-w-lg rounded-xl border border-line bg-paper shadow-2xl p-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setEditBusy(true);
              setMsg("");
              try {
                await api(`/api/drawings/drawing/${editRow.id}`, {
                  method: "PATCH",
                  token,
                  body: JSON.stringify({
                    title: editRow.title.trim(),
                    discipline: editRow.discipline,
                    buildingArea: editRow.buildingArea,
                    tlNo: editRow.tlNo,
                  }),
                });
                setMsg(`Updated ${editRow.drawingNumber}`);
                setEditRow(null);
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Could not edit drawing");
              } finally {
                setEditBusy(false);
              }
            }}
          >
            <div>
              <h2 className="font-display text-xl text-ink">Edit {editRow.drawingNumber}</h2>
              <p className="text-sm text-steel-muted">Drawing number stays as logged. Title, type, building, and TL update the GFC row and the master register.</p>
            </div>
            <label className="block text-xs text-steel-muted">
              Title
              <Input className="mt-1" value={editRow.title} onChange={(e) => setEditRow({ ...editRow, title: e.target.value })} required />
            </label>
            <label className="block text-xs text-steel-muted">
              Drawing type
              <Select className="mt-1" value={editRow.discipline} onChange={(e) => setEditRow({ ...editRow, discipline: e.target.value })}>
                {MASTER_REGISTER_DISCIPLINES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </label>
            <label className="block text-xs text-steel-muted">
              Building / area
              <Input className="mt-1" value={editRow.buildingArea} onChange={(e) => setEditRow({ ...editRow, buildingArea: e.target.value })} />
            </label>
            <label className="block text-xs text-steel-muted">
              TL No
              <Input className="mt-1" value={editRow.tlNo} onChange={(e) => setEditRow({ ...editRow, tlNo: e.target.value })} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy}>
                {editBusy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {viewer && (
        <DrawingFileViewer
          revision={viewer}
          variant="modal"
          onClose={() => {
            setViewer(null);
            setViewerRevId(null);
          }}
          onOpenSharePoint={
            viewerRevId ? (fileUrl) => void openRevisionSharePoint(viewerRevId, fileUrl) : undefined
          }
        />
      )}
    </div>
  );
}

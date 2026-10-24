import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "../components/ui";
import { StandaloneFormHeader } from "../components/StandaloneFormHeader";
import {
  ChecklistFillForm,
  emptyChecklistLine,
  emptyChecklistMeta,
  type ChecklistDrawingOption,
  type ChecklistFillItem,
  type ChecklistFillLine,
  type ChecklistFillMeta,
} from "../components/ChecklistFillForm";
import {
  closeEmbedOrWindow,
  closeInPageOverlay,
  onOverlaySaveAndClose,
  reportOverlayGuard,
} from "../lib/inPageOverlay";
import { drawingUnlockStorageKey, notifyDrawingUnlock } from "../lib/drawingCheckWindow";
import { useStandaloneFormPage } from "../lib/useStandaloneFormPage";

type GateDraft = {
  id: string;
  remarks?: string | null;
  responsesJson?: string;
  drawingId?: string | null;
  revisionId?: string | null;
};

type GateTemplate = {
  id: string;
  templateId: string;
  name: string;
  discipline: string;
  items: ChecklistFillItem[];
  requirePhotosMin?: number;
  assignmentId?: string | null;
  nextReportNo?: string;
  myDraft?: GateDraft | null;
};

const SUBMIT_ROLES = ["admin", "office", "employee", "site_employee"];
const SIGNER_LABEL = "Site Project Team";

/**
 * Drawing Check Master - used as the GFC upload gate overlay (embed=1).
 * The template is routed by discipline; one SPDC project team signature unlocks the upload.
 * Standalone tool route redirects to the checklist fill log for assigned fills.
 */
export default function DrawingPreCheckPage() {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const lockedDrawingId = searchParams.get("drawing") || "";
  const lockedRevisionId = searchParams.get("revision") || "";
  const lockedRevNumber = searchParams.get("rev") || "";
  const discipline = (searchParams.get("discipline") || "").trim();
  const { token, user } = useAuth();
  useStandaloneFormPage();

  const [template, setTemplate] = useState<GateTemplate | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [responses, setResponses] = useState<Record<string, ChecklistFillLine>>({});
  const [fillMeta, setFillMeta] = useState<ChecklistFillMeta>(emptyChecklistMeta);
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [drawings, setDrawings] = useState<ChecklistDrawingOption[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState<{ unlockToken: string; name: string; reportNo?: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [staffNames, setStaffNames] = useState<string[]>([]);

  const role = user?.role || "";
  const canFill = [...SUBMIT_ROLES, "vendor"].includes(role);
  const canSubmit = SUBMIT_ROLES.includes(role);
  const signerName = user?.fullName || user?.email || "";

  useEffect(() => {
    if (!token) return;
    api<{ fullName?: string | null; role?: string | null }[]>("/api/users?kind=staff", { token })
      .then((rows) => {
        const names = (rows || [])
          .filter((u) => !["client", "vendor"].includes(String(u.role || "")))
          .map((u) => String(u.fullName || "").trim())
          .filter(Boolean);
        if (signerName && !names.includes(signerName)) names.unshift(signerName);
        setStaffNames([...new Set(names)]);
      })
      .catch(() => setStaffNames(signerName ? [signerName] : []));
  }, [token, signerName]);

  useEffect(() => {
    if (!projectId || !embed) return;
    if (!discipline) {
      setError("Pick a discipline before opening the Drawing Check. Close this window and choose one.");
      return;
    }
    Promise.all([
      api<GateTemplate>(
        `/api/checklist/project/${projectId}/drawing-check-template?discipline=${encodeURIComponent(discipline)}${lockedDrawingId ? `&drawing=${encodeURIComponent(lockedDrawingId)}` : ""}`,
        { token },
      ),
      api<ChecklistDrawingOption[]>(`/api/drawings/project/${projectId}`, { token }).catch(() => []),
    ])
      .then(([t, dwg]) => {
        setTemplate(t);
        setAssignmentId(t.assignmentId || null);
        setDrawings((dwg || []).filter((d) => d.isPublished || d.id === lockedDrawingId));
        const init: Record<string, ChecklistFillLine> = {};
        (t.items || []).forEach((i) => {
          init[i.id] = emptyChecklistLine();
        });
        let boundRef = "";
        if (lockedDrawingId) {
          setDrawingId(lockedDrawingId);
          const dwgMatch = (dwg || []).find((d) => d.id === lockedDrawingId);
          const revId =
            lockedRevisionId || dwgMatch?.revisions?.find((r) => r.published)?.id || dwgMatch?.revisions?.[0]?.id || "";
          setRevisionId(revId);
          const revNo = lockedRevNumber || dwgMatch?.revisions?.find((r) => r.id === revId)?.revisionNumber || "";
          if (dwgMatch?.drawingNumber) boundRef = revNo ? `${dwgMatch.drawingNumber} ${revNo}` : dwgMatch.drawingNumber;
        }
        const meta: ChecklistFillMeta = { ...emptyChecklistMeta(), reportNo: t.nextReportNo || "", refDrawing: boundRef };
        const draft = t.myDraft;
        if (draft) {
          setDraftId(draft.id);
          setRemarks(draft.remarks || "");
          if (!lockedDrawingId && draft.drawingId) setDrawingId(draft.drawingId);
          if (!lockedRevisionId && !lockedDrawingId && draft.revisionId) setRevisionId(draft.revisionId);
          let saved: Record<string, { answer?: string; remarks?: string; evidenceLinks?: string[] } & Partial<ChecklistFillMeta>> = {};
          try {
            saved = JSON.parse(draft.responsesJson || "{}");
          } catch {
            saved = {};
          }
          const metaRaw = saved._meta as Partial<ChecklistFillMeta> | undefined;
          if (metaRaw && typeof metaRaw === "object") {
            meta.location = metaRaw.location || "";
            if (!boundRef) meta.refDrawing = metaRaw.refDrawing || "";
          }
          Object.keys(init).forEach((itemId) => {
            const row = saved[itemId] || {};
            init[itemId] = {
              ...emptyChecklistLine(),
              answer: row.answer || "",
              remarks: row.remarks || "",
              evidenceLinks: Array.isArray(row.evidenceLinks) ? row.evidenceLinks : [],
            };
          });
        }
        setFillMeta(meta);
        setResponses(init);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load Drawing Check Master"));
  }, [projectId, token, embed, discipline, lockedDrawingId, lockedRevisionId, lockedRevNumber]);

  useEffect(() => {
    reportOverlayGuard({ dirty: dirty && !done, hasDraft: !!draftId, canSaveDraft: canFill && !!template });
  }, [dirty, done, draftId, canFill, template]);

  function patchLine(itemId: string, patch: Partial<ChecklistFillLine>) {
    setDirty(true);
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyChecklistLine()), ...patch },
    }));
  }

  const items = template?.items || [];
  const sections = useMemo(() => Array.from(new Set(items.map((i) => i.section || "General"))), [items]);
  const answered = Object.values(responses).filter((r) => r.answer).length;
  const photoTotal = useMemo(() => {
    const linePhotos = Object.values(responses).reduce((s, r) => s + (r.photos?.length || 0), 0);
    const links = Object.values(responses).reduce((s, r) => s + (r.evidenceLinks?.filter(Boolean).length || 0), 0);
    return photos.length + linePhotos + links;
  }, [photos, responses]);

  function selectedRevisionNumber() {
    if (lockedRevNumber) return lockedRevNumber;
    const d = drawings.find((x) => x.id === drawingId);
    return d?.revisions?.find((r) => r.id === revisionId)?.revisionNumber || "";
  }

  function buildFormData() {
    const payload: Record<string, { answer: string; remarks: string; evidenceLinks?: string[] } | ChecklistFillMeta> = {};
    const itemComments: Record<string, string> = {};
    Object.entries(responses).forEach(([lineId, r]) => {
      payload[lineId] = {
        answer: r.answer,
        remarks: r.remarks,
        evidenceLinks: r.evidenceLinks?.filter(Boolean) || [],
      };
      if (r.remarks?.trim()) itemComments[lineId] = r.remarks.trim();
    });
    payload._meta = { ...fillMeta, quantity: "" };
    const fd = new FormData();
    fd.append("responsesJson", JSON.stringify(payload));
    fd.append("itemCommentsJson", JSON.stringify(itemComments));
    fd.append("remarks", remarks || "Pre-upload drawing check");
    fd.append("discipline", discipline);
    if (template?.id) fd.append("templateId", template.id);
    if (drawingId) fd.append("drawingId", drawingId);
    if (revisionId) fd.append("revisionId", revisionId);
    const revNo = selectedRevisionNumber();
    if (revNo) fd.append("revisionNumber", revNo);
    photos.forEach((f) => fd.append("photos", f));
    if (signatureFile) fd.append("signature", signatureFile, signatureFile.name);
    Object.entries(responses).forEach(([lineId, r]) => {
      r.photos.forEach((f) => fd.append(`item_${lineId}_photo`, f));
      r.docs.forEach((f) => fd.append(`item_${lineId}_doc`, f));
    });
    return fd;
  }

  /** The assignment is created on first draft save, not when the gate opens. */
  async function ensureAssignment(): Promise<string | null> {
    if (assignmentId) return assignmentId;
    if (!projectId || !template) return null;
    const out = await api<{ assignmentId: string }>(`/api/checklist/project/${projectId}/drawing-check-template/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ discipline, templateId: template.id, drawingId: lockedDrawingId || drawingId }),
    });
    setAssignmentId(out.assignmentId);
    return out.assignmentId;
  }

  async function saveDraft(): Promise<boolean> {
    setSavingDraft(true);
    setError("");
    setNotice("");
    try {
      const aid = await ensureAssignment();
      if (!aid) {
        setError("The checklist is not ready yet. Try again in a moment.");
        return false;
      }
      const saved = await api<{ id: string }>(`/api/checklist/assignments/${aid}/draft`, {
        method: "POST",
        token,
        body: buildFormData(),
      });
      setDraftId(saved.id);
      setDirty(false);
      setNotice(`Draft saved: ${answered}/${items.length} answered. It is in the checklist fill log. Close this window and continue later.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft save failed");
      return false;
    } finally {
      setSavingDraft(false);
    }
  }

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  useEffect(
    () =>
      onOverlaySaveAndClose(() => {
        void saveDraftRef.current().then((ok) => {
          if (!ok) return;
          reportOverlayGuard({ dirty: false, hasDraft: true, canSaveDraft: true });
          closeInPageOverlay();
        });
      }),
    [],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!template || !projectId) return;
    if (!signatureFile) {
      setError("Sign the Drawing Check before submitting. Save a draft if the checklist is not complete.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api<{ unlockToken: string; reportNo?: string; template: { name: string } }>(
        `/api/checklist/project/${projectId}/drawing-precheck`,
        { method: "POST", token, body: buildFormData() },
      );
      setDirty(false);
      try {
        localStorage.setItem(drawingUnlockStorageKey(projectId), res.unlockToken);
      } catch {
        /* ignore */
      }
      setDone({ unlockToken: res.unlockToken, name: res.template?.name || template.name, reportNo: res.reportNo });
      notifyDrawingUnlock(projectId, res.unlockToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist failed");
    } finally {
      setBusy(false);
    }
  }

  if (!embed && projectId) {
    return <Navigate to={`/projects/${projectId}/drawings/checklist-logs`} replace />;
  }

  const eyebrow = discipline ? `Drawings · pre-upload gate · ${discipline}` : "Drawings · pre-upload gate";

  if (done) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader hideSession={embed} variant="navy" eyebrow={eyebrow} title="Drawing Check Master" />
        <main className="standalone-form-page__main standalone-form-page__main--narrow">
          <Card className="!p-8 text-center space-y-4">
            <Badge tone="ok">Unlocked</Badge>
            <h1 className="font-display text-2xl text-ink">Checklist complete</h1>
            <p className="text-steel-muted text-sm max-w-md mx-auto">
              “{done.name}”{done.reportNo ? ` (${done.reportNo})` : ""} is signed and stored. Return to the upload dialog and add the PDF and DWG.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button type="button" onClick={() => closeEmbedOrWindow()}>
                Close
              </Button>
              <Link to={`/projects/${projectId}/drawings`}>
                <Button type="button" variant="secondary">
                  Back to Drawings
                </Button>
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!template && !error) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader hideSession={embed} variant="navy" eyebrow={eyebrow} title="Drawing Check Master" />
        <main className="standalone-form-page__main">
          <p className="text-sm text-steel-muted">Loading checklist…</p>
        </main>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader
          hideSession={embed}
          variant="navy"
          eyebrow={eyebrow}
          title="Drawing Check Master"
          actions={
            <Button type="button" variant="ghost" className="!text-xs !text-white hover:!bg-white/10" onClick={() => closeEmbedOrWindow()}>
              Close
            </Button>
          }
        />
        <main className="standalone-form-page__main">
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        </main>
      </div>
    );
  }

  return (
    <ChecklistFillForm
      family="DrawingCheck"
      hideSession={embed}
      headerVariant="drawing"
      discipline={template?.discipline || discipline}
      eyebrow={eyebrow}
      title={template?.name || "Drawing Check Master"}
      subtitle=""
      category="Drawing Check Master"
      items={items}
      sections={sections}
      responses={responses}
      onPatchLine={patchLine}
      fillMeta={fillMeta}
      onFillMeta={(m) => {
        setDirty(true);
        setFillMeta(m);
      }}
      remarks={remarks}
      onRemarks={(v) => {
        setDirty(true);
        setRemarks(v);
      }}
      drawings={drawings}
      drawingId={drawingId}
      revisionId={revisionId}
      onDrawingId={setDrawingId}
      onRevisionId={setRevisionId}
      requireDrawing={false}
      showDrawingPicker={false}
      showEvidence={false}
      lockedDrawingLabel={
        drawingId
          ? `${drawings.find((d) => d.id === drawingId)?.drawingNumber || "Drawing"}${
              selectedRevisionNumber() ? ` Rev ${selectedRevisionNumber()}` : ""
            }`
          : undefined
      }
      overallPhotos={photos}
      onOverallPhotos={setPhotos}
      onSignature={(f) => {
        if (f) setDirty(true);
        setSignatureFile(f);
      }}
      requireSignature
      signerLabel={SIGNER_LABEL}
      staffNames={staffNames}
      signerName={signerName || undefined}
      submitBlockedReason={canSubmit ? undefined : "Only SPDC project team members can sign the Drawing Check. Save a draft instead."}
      minPhotos={0}
      photoTotal={photoTotal}
      answered={answered}
      canFill={canFill}
      draftId={draftId}
      savingDraft={savingDraft}
      submitting={busy}
      msg={error || notice}
      onSaveDraft={() => void saveDraft()}
      onClose={() => closeEmbedOrWindow()}
      onSubmit={submit}
      submitLabel="Sign & submit"
    />
  );
}

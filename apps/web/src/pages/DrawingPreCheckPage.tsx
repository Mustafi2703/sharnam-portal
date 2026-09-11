import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import { DRAWING_UNLOCK_MESSAGE, drawingUnlockStorageKey } from "../lib/drawingCheckWindow";
import { useStandaloneFormPage } from "../lib/useStandaloneFormPage";

/**
 * Drawing Check Master popup — same fill chrome as QI / Safety / site / activity
 * (Yes/No/N.A., comments, optional photos & files). Submit unlocks GFC upload.
 */
export default function DrawingPreCheckPage() {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const revisionMode = searchParams.get("mode") === "revision";
  const { token, user } = useAuth();
  useStandaloneFormPage();

  const [template, setTemplate] = useState<{
    name: string;
    items: ChecklistFillItem[];
    requirePhotosMin?: number;
    assignmentId?: string;
    myDraft?: { id: string; remarks?: string | null; responsesJson?: string; drawingId?: string | null; revisionId?: string | null } | null;
  } | null>(null);
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
  const [done, setDone] = useState<{ unlockToken: string; name: string } | null>(null);

  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api<{
        name: string;
        items: ChecklistFillItem[];
        requirePhotosMin?: number;
        assignmentId?: string;
        myDraft?: { id: string; remarks?: string | null; responsesJson?: string; drawingId?: string | null; revisionId?: string | null } | null;
      }>(`/api/checklist/project/${projectId}/drawing-check-template`, { token }),
      api<ChecklistDrawingOption[]>(`/api/drawings/project/${projectId}`, { token }).catch(() => []),
    ])
      .then(([t, dwg]) => {
        setTemplate(t);
        setAssignmentId(t.assignmentId || null);
        setDrawings((dwg || []).filter((d) => d.isPublished));
        const init: Record<string, ChecklistFillLine> = {};
        (t.items || []).forEach((i) => {
          init[i.id] = emptyChecklistLine();
        });
        const draft = t.myDraft;
        if (draft) {
          setDraftId(draft.id);
          setRemarks(draft.remarks || "");
          if (draft.drawingId) setDrawingId(draft.drawingId);
          if (draft.revisionId) setRevisionId(draft.revisionId);
          let saved: Record<string, { answer?: string; remarks?: string; evidenceLinks?: string[] } & Partial<ChecklistFillMeta>> = {};
          try {
            saved = JSON.parse(draft.responsesJson || "{}");
          } catch {
            saved = {};
          }
          const metaRaw = saved._meta as Partial<ChecklistFillMeta> | undefined;
          if (metaRaw && typeof metaRaw === "object") {
            setFillMeta({
              reportNo: metaRaw.reportNo || "",
              location: metaRaw.location || "",
              refDrawing: metaRaw.refDrawing || "",
              quantity: metaRaw.quantity || "",
            });
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
        setResponses(init);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load Drawing Check Master"));
  }, [projectId, token]);

  function patchLine(itemId: string, patch: Partial<ChecklistFillLine>) {
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
    payload._meta = { ...fillMeta };
    const fd = new FormData();
    fd.append("responsesJson", JSON.stringify(payload));
    fd.append("itemCommentsJson", JSON.stringify(itemComments));
    fd.append("remarks", remarks || "Pre-upload drawing check");
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

  async function saveDraft() {
    if (!assignmentId) {
      setError("Checklist assignment is not ready yet — try again in a moment.");
      return;
    }
    setSavingDraft(true);
    setError("");
    setNotice("");
    try {
      const saved = await api<{ id: string }>(`/api/checklist/assignments/${assignmentId}/draft`, {
        method: "POST",
        token,
        body: buildFormData(),
      });
      setDraftId(saved.id);
      setNotice(`Draft saved — ${answered}/${items.length} answered. You can close this window and continue later.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft save failed");
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!template || !projectId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const fd = buildFormData();

      const res = await api<{ unlockToken: string; template: { name: string } }>(
        `/api/checklist/project/${projectId}/drawing-precheck`,
        { method: "POST", token, body: fd }
      );
      try {
        localStorage.setItem(drawingUnlockStorageKey(projectId), res.unlockToken);
      } catch {
        /* ignore */
      }
      try {
        window.opener?.postMessage(
          { type: DRAWING_UNLOCK_MESSAGE, projectId, unlockToken: res.unlockToken },
          window.location.origin
        );
      } catch {
        /* ignore */
      }
      setDone({ unlockToken: res.unlockToken, name: res.template?.name || template.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader
          variant="navy"
          eyebrow="Drawings · pre-upload gate"
          title="Drawing Check Master"
        />
        <main className="standalone-form-page__main standalone-form-page__main--narrow">
          <Card className="!p-8 text-center space-y-4">
            <Badge tone="ok">Unlocked</Badge>
            <h1 className="font-display text-2xl text-ink">Checklist complete</h1>
            <p className="text-steel-muted text-sm max-w-md mx-auto">
              “{done.name}” is done. Return to the Drawings tab — the upload dialog should open. You can close this window.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button type="button" onClick={() => window.close()}>
                Close window
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
        <StandaloneFormHeader variant="navy" eyebrow="Drawings · pre-upload gate" title="Drawing Check Master" />
        <main className="standalone-form-page__main">
          <p className="text-sm text-steel-muted">Loading checklist…</p>
        </main>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader variant="navy" eyebrow="Drawings · pre-upload gate" title="Drawing Check Master" />
        <main className="standalone-form-page__main">
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        </main>
      </div>
    );
  }

  return (
    <ChecklistFillForm
      family="DrawingCheck"
      eyebrow="Drawings · pre-upload gate"
      title={template?.name || "Drawing Check Master"}
      subtitle={revisionMode ? "Fill before revision upload unlocks" : "Fill before GFC upload unlocks"}
      category="Drawing Check Master"
      items={items}
      sections={sections}
      responses={responses}
      onPatchLine={patchLine}
      fillMeta={fillMeta}
      onFillMeta={setFillMeta}
      remarks={remarks}
      onRemarks={setRemarks}
      drawings={drawings}
      drawingId={drawingId}
      revisionId={revisionId}
      onDrawingId={setDrawingId}
      onRevisionId={setRevisionId}
      requireDrawing={false}
      overallPhotos={photos}
      onOverallPhotos={setPhotos}
      onSignature={setSignatureFile}
      signerName={user?.fullName || user?.email || undefined}
      minPhotos={template?.requirePhotosMin || 0}
      photoTotal={photoTotal}
      answered={answered}
      canFill={canFill}
      draftId={draftId}
      savingDraft={savingDraft}
      submitting={busy}
      msg={error || notice}
      onSaveDraft={assignmentId ? () => void saveDraft() : undefined}
      onSubmit={submit}
      submitLabel="Submit & unlock upload"
    />
  );
}

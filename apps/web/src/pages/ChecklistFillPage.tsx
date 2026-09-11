import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "../components/ui";
import { StandaloneFormHeader } from "../components/StandaloneFormHeader";
import {
  ChecklistFillForm,
  checklistFamilyLabel,
  emptyChecklistLine,
  emptyChecklistMeta,
  type ChecklistDrawingOption,
  type ChecklistFillItem,
  type ChecklistFillLine,
  type ChecklistFillMeta,
} from "../components/ChecklistFillForm";
import { downloadBrandedChecklistPrint, downloadBrandedChecklistXlsx } from "../lib/brandedChecklistPrint";
import { useStandaloneFormPage } from "../lib/useStandaloneFormPage";

/** Popup fill for Quality, Safety, site, activity, and drawing-check assignments. */
export default function ChecklistFillPage() {
  const { id: projectId, assignmentId } = useParams();
  const [search] = useSearchParams();
  const family = search.get("family") || "SiteExecution";
  const { token, user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, ChecklistFillLine>>({});
  const [fillMeta, setFillMeta] = useState<ChecklistFillMeta>(emptyChecklistMeta);
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [drawings, setDrawings] = useState<ChecklistDrawingOption[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [a, dwg] = await Promise.all([
      api<any>(`/api/checklist/assignments/${assignmentId}`, { token }),
      api<ChecklistDrawingOption[]>(`/api/drawings/project/${projectId}`, { token }).catch(() => []),
    ]);
    setAssignment(a);
    const published = (dwg || []).filter((d) => d.isPublished);
    setDrawings(published);
    const init: Record<string, ChecklistFillLine> = {};
    a.template.items.forEach((i: ChecklistFillItem) => {
      init[i.id] = emptyChecklistLine();
    });

    const draft = a.myDraft;
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
      } else {
        setFillMeta(emptyChecklistMeta());
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
    } else {
      setDraftId(null);
      setFillMeta(emptyChecklistMeta());
    }
    setResponses(init);
  };

  useEffect(() => {
    void load();
  }, [assignmentId, projectId, token]);

  useStandaloneFormPage();

  const items: ChecklistFillItem[] = assignment?.template?.items || [];
  const sections = useMemo(() => Array.from(new Set(items.map((i) => i.section || "General"))), [items]);
  const answered = Object.values(responses).filter((r) => r.answer).length;
  const linkEvidence = Object.values(responses).reduce((s, r) => s + (r.evidenceLinks?.filter(Boolean).length || 0), 0);

  function buildPayload() {
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
    return { payload, itemComments };
  }

  function selectedRevisionNumber() {
    const d = drawings.find((x) => x.id === drawingId);
    return d?.revisions?.find((r) => r.id === revisionId)?.revisionNumber || "";
  }

  function buildFormData(status: "Draft" | "Submitted") {
    const { payload, itemComments } = buildPayload();
    const fd = new FormData();
    fd.append("responsesJson", JSON.stringify(payload));
    fd.append("itemCommentsJson", JSON.stringify(itemComments));
    fd.append("remarks", remarks);
    if (drawingId) fd.append("drawingId", drawingId);
    if (revisionId) fd.append("revisionId", revisionId);
    const revNo = selectedRevisionNumber();
    if (revNo) fd.append("revisionNumber", revNo);
    if (status === "Submitted") fd.append("status", "Submitted");
    if (photos.length) photos.forEach((f) => fd.append("photos", f));
    if (signatureFile) fd.append("signature", signatureFile, signatureFile.name);
    Object.entries(responses).forEach(([lineId, r]) => {
      r.photos.forEach((f) => fd.append(`item_${lineId}_photo`, f));
      r.docs.forEach((f) => fd.append(`item_${lineId}_doc`, f));
    });
    return fd;
  }

  async function saveDraft() {
    setSavingDraft(true);
    setMsg("");
    try {
      const fd = buildFormData("Draft");
      const saved = await api<any>(`/api/checklist/assignments/${assignmentId}/draft`, {
        method: "POST",
        token,
        body: fd,
      });
      setDraftId(saved.id);
      const spNote =
        saved.sharePointExports?.length > 0 ? " Branded XLSX + HTML synced to SharePoint (Drafts folder)." : "";
      setMsg(
        `Draft saved — ${saved.progress?.progressLabel || answered + "/" + items.length} answered · ${saved.progress?.evidenceCount || linkEvidence} evidence item(s).${spNote}`,
      );
      if (saved.id) {
        try {
          await downloadBrandedChecklistXlsx(saved.id, token);
        } catch {
          /* optional local copy */
        }
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Draft save failed");
    } finally {
      setSavingDraft(false);
    }
  }

  function patchLine(itemId: string, patch: Partial<ChecklistFillLine>) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyChecklistLine()), ...patch },
    }));
  }

  const minPhotos = assignment?.template?.requirePhotosMin || 0;
  const photoTotal = useMemo(() => {
    const overall = photos.length;
    const linePhotos = Object.values(responses).reduce((s, r) => s + (r.photos?.length || 0), 0);
    const links = Object.values(responses).reduce((s, r) => s + (r.evidenceLinks?.filter(Boolean).length || 0), 0);
    return overall + linePhotos + links;
  }, [photos, responses]);

  const requireDrawing = family !== "DrawingCheck" && drawings.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (requireDrawing && !drawingId) {
      setMsg("Select a published drawing and revision before submit.");
      return;
    }
    if (minPhotos > 0 && photoTotal < minPhotos) {
      setMsg(`This checklist requires at least ${minPhotos} photos (you have ${photoTotal}).`);
      return;
    }
    setSubmitting(true);
    try {
      const fd = buildFormData("Submitted");
      const saved = await api<any>(`/api/checklist/assignments/${assignmentId}/submit`, {
        method: "POST",
        token,
        body: fd,
      });
      const spNote = saved.sharePointExports?.length > 0 ? " Branded forms saved to SharePoint." : "";
      setMsg(`Submitted — ${answered}/${items.length} answered.${spNote}`);
      const submissionId = saved?.id;
      if (submissionId) {
        try {
          await downloadBrandedChecklistXlsx(submissionId, token);
          await downloadBrandedChecklistPrint(submissionId, token);
        } catch {
          /* user can download from fill log */
        }
      }
      setPhotos([]);
      setDraftId(null);
      setDone(true);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const familyLabel = checklistFamilyLabel(family);

  if (done) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader variant="navy" eyebrow={familyLabel} title="Checklist submitted" />
        <main className="standalone-form-page__main standalone-form-page__main--narrow">
          <Card className="!p-8 text-center space-y-4">
            <Badge tone="ok">Submitted</Badge>
            <h1 className="font-display text-2xl text-ink">Form complete</h1>
            <p className="text-steel-muted text-sm max-w-md mx-auto">
              {assignment?.template?.name || familyLabel} is saved. You can close this window and return to the register.
            </p>
            {msg ? <p className="text-sm text-brand-dark">{msg}</p> : null}
            <Button type="button" onClick={() => window.close()}>
              Close window
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader variant="navy" eyebrow={familyLabel} title="Checklist fill" />
        <main className="standalone-form-page__main">
          <p className="text-sm text-steel-muted">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <ChecklistFillForm
      family={family}
      eyebrow={assignment.project?.code || "Project"}
      title={assignment.template.name}
      subtitle={assignment.template.instructions || familyLabel}
      category={assignment.template.category}
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
      requireDrawing={requireDrawing}
      overallPhotos={photos}
      onOverallPhotos={setPhotos}
      onSignature={setSignatureFile}
      signerName={user?.fullName || user?.email || undefined}
      minPhotos={minPhotos}
      photoTotal={photoTotal}
      answered={answered}
      canFill={canFill}
      draftId={draftId}
      savingDraft={savingDraft}
      submitting={submitting}
      msg={msg}
      onSaveDraft={() => void saveDraft()}
      onSubmit={submit}
    />
  );
}

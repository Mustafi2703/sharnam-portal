import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, TextArea } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { SignaturePad } from "../components/SignaturePad";
import { StandaloneFormHeader } from "../components/StandaloneFormHeader";
import { downloadBrandedChecklistPrint, downloadBrandedChecklistXlsx } from "../lib/brandedChecklistPrint";
import { useStandaloneFormPage } from "../lib/useStandaloneFormPage";

type Item = { id: string; itemCode?: string; description: string; section?: string; instruction?: string; requirePhoto?: boolean };
type LineResponse = { answer: string; remarks: string; photos: File[]; docs: File[]; evidenceLinks: string[] };
type FillMeta = { reportNo: string; location: string; refDrawing: string; quantity: string };

const emptyMeta = (): FillMeta => ({ reportNo: "", location: "", refDrawing: "", quantity: "" });

/** Spacious Procore-style fill form: pick drawing → pick revision → fill lines with evidence */
export default function ChecklistFillPage() {
  const { id: projectId, assignmentId } = useParams();
  const [search] = useSearchParams();
  const family = search.get("family") || "SiteExecution";
  const { token, user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, LineResponse>>({});
  const [fillMeta, setFillMeta] = useState<FillMeta>(emptyMeta);
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const emptyLine = (): LineResponse => ({ answer: "", remarks: "", photos: [], docs: [], evidenceLinks: [] });

  const load = async () => {
    const a = await api<any>(`/api/checklist/assignments/${assignmentId}`, { token });
    setAssignment(a);
    const init: Record<string, LineResponse> = {};
    a.template.items.forEach((i: Item) => {
      init[i.id] = emptyLine();
    });

    const draft = a.myDraft;
    if (draft) {
      setDraftId(draft.id);
      setRemarks(draft.remarks || "");
      let saved: Record<string, { answer?: string; remarks?: string; evidenceLinks?: string[] } & Partial<FillMeta>> = {};
      try {
        saved = JSON.parse(draft.responsesJson || "{}");
      } catch {
        saved = {};
      }
      const metaRaw = saved._meta as Partial<FillMeta> | undefined;
      if (metaRaw && typeof metaRaw === "object") {
        setFillMeta({
          reportNo: metaRaw.reportNo || "",
          location: metaRaw.location || "",
          refDrawing: metaRaw.refDrawing || "",
          quantity: metaRaw.quantity || "",
        });
      } else {
        setFillMeta(emptyMeta());
      }
      Object.keys(init).forEach((itemId) => {
        const row = saved[itemId] || {};
        init[itemId] = {
          ...emptyLine(),
          answer: row.answer || "",
          remarks: row.remarks || "",
          evidenceLinks: Array.isArray(row.evidenceLinks) ? row.evidenceLinks : [],
        };
      });
    } else {
      setDraftId(null);
      setFillMeta(emptyMeta());
    }
    setResponses(init);
  };

  useEffect(() => {
    void load();
  }, [assignmentId, projectId, token]);

  useStandaloneFormPage();

  const items: Item[] = assignment?.template?.items || [];
  const sections = useMemo(() => Array.from(new Set(items.map((i) => i.section || "General"))), [items]);
  const answered = Object.values(responses).filter((r) => r.answer).length;
  const linkEvidence = Object.values(responses).reduce((s, r) => s + (r.evidenceLinks?.filter(Boolean).length || 0), 0);
  const answerPct = items.length ? Math.round((answered / items.length) * 100) : 0;

  function buildPayload() {
    const payload: Record<string, { answer: string; remarks: string; evidenceLinks?: string[] } | FillMeta> = {};
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

  function buildFormData(status: "Draft" | "Submitted") {
    const { payload, itemComments } = buildPayload();
    const fd = new FormData();
    fd.append("responsesJson", JSON.stringify(payload));
    fd.append("itemCommentsJson", JSON.stringify(itemComments));
    fd.append("remarks", remarks);
    if (status === "Submitted") fd.append("status", "Submitted");
    if (photos.length) {
      photos.forEach((f) => fd.append("photos", f));
    }
    if (signatureFile) {
      fd.append("signature", signatureFile, signatureFile.name);
    }
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
        saved.sharePointExports?.length > 0
          ? " Branded XLSX + HTML synced to SharePoint (Drafts folder)."
          : "";
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

  function patchLine(itemId: string, patch: Partial<LineResponse>) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyLine()), ...patch },
    }));
  }

  const minPhotos = assignment?.template?.requirePhotosMin || 0;
  const photoTotal = useMemo(() => {
    const overall = photos.length;
    const linePhotos = Object.values(responses).reduce((s, r) => s + (r.photos?.length || 0), 0);
    const links = Object.values(responses).reduce((s, r) => s + (r.evidenceLinks?.filter(Boolean).length || 0), 0);
    return overall + linePhotos + links;
  }, [photos, responses]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (minPhotos > 0 && photoTotal < minPhotos) {
      setMsg(`This checklist requires at least ${minPhotos} photos (you have ${photoTotal}).`);
      return;
    }
    try {
      const fd = buildFormData("Submitted");
      const saved = await api<any>(`/api/checklist/assignments/${assignmentId}/submit`, {
        method: "POST",
        token,
        body: fd,
      });
      const lineFiles = Object.values(responses).reduce((s, r) => s + r.photos.length + r.docs.length, 0);
      const overall = photos.length;
      const spNote =
        saved.sharePointExports?.length > 0
          ? " Branded forms saved to SharePoint."
          : "";
      setMsg(
        overall + lineFiles + linkEvidence
          ? `Submitted — ${answered}/${items.length} answered.${spNote}`
          : `Submitted — sheet report generated.${spNote}`,
      );
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
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function downloadAuditCsv() {
    const res = await fetch(
      `/api/checklist/project/${projectId}/export.csv?type=${encodeURIComponent(family)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist-audit-${family}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }


  const familyLabel =
    family === "QualityInspection"
      ? "Quality inspection checklist"
      : family === "Safety"
        ? "Safety checklist"
        : family === "ActivityInspection"
          ? "Activity inspection"
          : family === "DrawingCheck"
            ? "Drawing check"
            : "Site execution checklist";

  return (
    <div className="standalone-form-page">
      <StandaloneFormHeader
        eyebrow={assignment?.project?.code || "Project"}
        title={familyLabel}
        subtitle={assignment?.template?.name}
        metaRight={
          <>
            <Badge tone="brand">{familyLabel}</Badge>
            {draftId && <Badge tone="warn">Draft</Badge>}
          </>
        }
        actions={
          <>
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => void saveDraft()} disabled={savingDraft || !canFill}>
              {savingDraft ? "Saving…" : "Save draft"}
            </Button>
            <Button type="button" variant="ghost" className="!text-xs" onClick={() => window.close()}>
              Close
            </Button>
          </>
        }
      />

      <main className="standalone-form-page__main space-y-8 portal-fill-layout">
        {!assignment ? (
          <p className="text-sm text-steel-muted">Loading…</p>
        ) : (
          <>
            <PageHeader
              eyebrow={assignment.template.category}
              title={assignment.template.name}
              subtitle={
                assignment.template.instructions ||
                `Fill Yes/No/N.A. with comments and photos.${
                  minPhotos ? ` At least ${minPhotos} photos required (${photoTotal} attached).` : ""
                }`
              }
              actions={
                <div className="text-right space-y-1">
                  <div className="text-2xl font-display text-brand">
                    {answered}/{items.length}
                  </div>
                  <div className="text-[11px] text-steel-muted font-mono uppercase">{answerPct}% answered</div>
                  {draftId && <Badge tone="warn">Draft saved</Badge>}
                  <div className="w-32 h-1.5 bg-line rounded-full overflow-hidden ml-auto">
                    <div className="h-full bg-brand transition-all" style={{ width: `${answerPct}%` }} />
                  </div>
                </div>
              }
            />

            {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

            <Card className="!p-5">
              <h3 className="font-semibold text-sm mb-3">Sheet header (SPDC)</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Report no.</span>
                  <Input
                    className="mt-1"
                    placeholder="CL/CIV/104"
                    value={fillMeta.reportNo}
                    onChange={(e) => setFillMeta((m) => ({ ...m, reportNo: e.target.value }))}
                    disabled={!canFill}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Location</span>
                  <Input
                    className="mt-1"
                    placeholder="Grid C4 / Level +0.00"
                    value={fillMeta.location}
                    onChange={(e) => setFillMeta((m) => ({ ...m, location: e.target.value }))}
                    disabled={!canFill}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Ref. drawing</span>
                  <Input
                    className="mt-1"
                    placeholder="SPDC-STR-104 Rev. 2"
                    value={fillMeta.refDrawing}
                    onChange={(e) => setFillMeta((m) => ({ ...m, refDrawing: e.target.value }))}
                    disabled={!canFill}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Quantity</span>
                  <Input
                    className="mt-1"
                    placeholder="3.2 cum"
                    value={fillMeta.quantity}
                    onChange={(e) => setFillMeta((m) => ({ ...m, quantity: e.target.value }))}
                    disabled={!canFill}
                  />
                </label>
              </div>
            </Card>

            <div className="grid lg:grid-cols-[1fr] gap-8 items-start max-w-4xl mx-auto w-full">
              <form onSubmit={submit} className="surface brand-frame p-6 sm:p-8 space-y-6">
                <div className="pb-4 border-b border-line flex flex-wrap gap-3 justify-between">
                  <div>
                    <div className="text-xs font-mono uppercase text-steel-muted">Checklist fill</div>
                    <div className="font-semibold mt-1">Answer each line · take photos or add SharePoint links</div>
                  </div>
                  <Input
                    className="max-w-xs"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Overall remarks"
                    disabled={!canFill}
                  />
                </div>

                <div className="scroll-panel-lg space-y-8 pr-1">
                  {sections.map((section) => (
                    <section key={section} className="space-y-4">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mark">{section}</h3>
                      {items
                        .filter((i) => (i.section || "General") === section)
                        .map((item) => {
                          const line = responses[item.id] || emptyLine();
                          return (
                            <div key={item.id} className="border border-line bg-paper p-5 space-y-3 text-ink">
                              <div className="text-[15px] leading-relaxed font-semibold text-ink">
                                {item.itemCode && <span className="font-mono text-brand mr-2">{item.itemCode}</span>}
                                {item.description}
                              </div>
                              {item.instruction?.trim() && (
                                <p className="text-sm text-steel-muted bg-sand/50 border border-line rounded-lg px-3 py-2 leading-relaxed">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-brand block mb-1">
                                    Instruction / QI note
                                  </span>
                                  {item.instruction}
                                </p>
                              )}
                              {item.requirePhoto && (
                                <p className="text-[11px] font-semibold text-amber-800">Photo required for this line</p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {["Yes", "No", "N.A."].map((ans) => {
                                  const on = line.answer === ans;
                                  return (
                                    <button
                                      key={ans}
                                      type="button"
                                      onClick={() => patchLine(item.id, { answer: ans })}
                                      className={`rounded-sm px-4 py-2 text-sm font-semibold border ${
                                        on
                                          ? ans === "Yes"
                                            ? "bg-brand text-white border-brand"
                                            : ans === "No"
                                              ? "bg-danger text-white border-danger"
                                              : "bg-warn text-white border-warn"
                                          : "bg-sand border-line text-ink hover:border-brand"
                                      }`}
                                    >
                                      {ans}
                                    </button>
                                  );
                                })}
                              </div>
                              <TextArea
                                rows={2}
                                placeholder="Comment for this checklist item"
                                value={line.remarks}
                                onChange={(e) => patchLine(item.id, { remarks: e.target.value })}
                              />
                              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                                <label className="text-xs text-steel-muted block sm:col-span-2">
                                  SharePoint / OneDrive evidence link
                                  <Input
                                    className="mt-1 !text-xs"
                                    placeholder="https://…sharepoint.com/… or OneDrive link"
                                    value={line.evidenceLinks[0] || ""}
                                    onChange={(e) =>
                                      patchLine(item.id, {
                                        evidenceLinks: e.target.value.trim() ? [e.target.value.trim()] : [],
                                      })
                                    }
                                  />
                                  <span className="block mt-1 text-[10px] text-steel-muted">
                                    Link only — file stays in SharePoint; portal stores the URL.
                                  </span>
                                </label>
                                <div className="space-y-2">
                                  <p className="text-xs text-steel-muted">Photos (camera → SharePoint)</p>
                                  <div className="flex flex-wrap gap-2">
                                    <FilePickButton
                                      accept="image/*"
                                      capture="environment"
                                      multiple
                                      variant="primary"
                                      onPick={(files) =>
                                        patchLine(item.id, {
                                          photos: [...line.photos, ...files],
                                        })
                                      }
                                    >
                                      Take photo
                                    </FilePickButton>
                                  </div>
                                  {line.photos.length > 0 && (
                                    <span className="block text-[11px] text-ink">
                                      {line.photos.map((f) => f.name).join(", ")}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs text-steel-muted">Documents</p>
                                  <FilePickButton
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.txt,application/pdf"
                                    multiple
                                    onPick={(files) =>
                                      patchLine(item.id, {
                                        docs: [...line.docs, ...files],
                                      })
                                    }
                                  >
                                    Choose file
                                  </FilePickButton>
                                  {line.docs.length > 0 && (
                                    <span className="block text-[11px] text-ink">
                                      {line.docs.map((f) => f.name).join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </section>
                  ))}
                </div>

                <div className="pt-4 border-t border-line space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-steel-muted">
                        Overall photos
                        {minPhotos > 0 && (
                          <span className="ml-2 text-xs font-semibold text-brand">
                            {photoTotal}/{minPhotos} photos (min)
                          </span>
                        )}
                      </p>
                      <FilePickButton
                        accept="image/*"
                        capture="environment"
                        multiple
                        variant="primary"
                        onPick={(files) => setPhotos((prev) => [...prev, ...files])}
                      >
                        Take photo
                      </FilePickButton>
                      {photos.length > 0 && (
                        <p className="text-xs text-ink">{photos.map((f) => f.name).join(", ")}</p>
                      )}
                    </div>
                    <SignaturePad
                      onCapture={setSignatureFile}
                      personName={user?.fullName || user?.email || undefined}
                      label="Signed by (inspector / site engineer)"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {canFill && (
                      <>
                        <Button type="button" variant="secondary" disabled={savingDraft} onClick={() => void saveDraft()}>
                          {savingDraft ? "Saving…" : "Save draft"}
                        </Button>
                        <Button type="submit" disabled={minPhotos > 0 && photoTotal < minPhotos}>
                          Submit checklist form
                        </Button>
                      </>
                    )}
                    {msg && <span className="text-sm text-steel-muted">{msg}</span>}
                  </div>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

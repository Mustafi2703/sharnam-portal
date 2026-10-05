import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../../components/ui";
import { canManageHrms } from "../../lib/portalAccounts";
import HrmsDocxPreview from "../../components/HrmsDocxPreview";
import HrmsPageHero from "./HrmsPageHero";
import {
  KIND_OPTIONS,
  LETTER_STAGES,
  type LetterStage,
  ONBOARDING_LETTER_PACK,
  type DocKind,
  type DocRow,
  type OfferRow,
  type StaffRow,
  annexureXlsxUrl,
  applySubjectKey,
  buildSubjectOptions,
  createBodyFromForm,
  docMatchesSubject,
  editableDocxUrl,
  letterSharePointLink,
  emptyLetterForm,
  subjectKeyFromForm,
  applyPriorLetters,
  hydrateLetterFormFromDoc,
  letterFormFingerprint,
  letterFormUsesAssetExtras,
  letterFormUsesCtc,
  missingLetterFields,
  letterFormUsesPromotionExtras,
  letterFormUsesSeparationReason,
  letterFormUsesWarningExtras,
  LETTER_VARIABLES,
} from "./hrmsLetterDesk";
import { StatusNote } from "../../components/StatusNote";
import { IconCheck } from "../../components/icons";
import { formatUiText } from "../../lib/formatUiText";

export default function HrmsDocumentsPage() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const canManage = canManageHrms(user);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const initialKind = searchParams.get("kind");
  const [kindFilter, setKindFilter] = useState<"all" | DocKind>(
    initialKind && KIND_OPTIONS.some((k) => k.key === initialKind) ? (initialKind as DocKind) : "all",
  );
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [previewDocxBlob, setPreviewDocxBlob] = useState<Blob | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [filedSharePoint, setFiledSharePoint] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [form, setForm] = useState(emptyLetterForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registerScope, setRegisterScope] = useState<"all" | "person">("all");
  const formPanelRef = useRef<HTMLDivElement | null>(null);

  const subjectKey = subjectKeyFromForm(form);
  const subjectOptions = useMemo(() => buildSubjectOptions(staff, offers), [staff, offers]);

  const load = useCallback(async () => {
    try {
      const [list, people, offersList] = await Promise.all([
        api<DocRow[]>("/api/hrm/hrms-documents", { token }),
        api<StaffRow[]>("/api/hrm/employees", { token }).catch(() => []),
        api<OfferRow[]>("/api/hrm/offers", { token }).catch(() => []),
      ]);
      setRows(list);
      setStaff(people);
      setOffers(offersList);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const offerId = searchParams.get("offerId");
    const userId = searchParams.get("employeeUserId");
    const kindQ = searchParams.get("kind");
    if (kindQ && KIND_OPTIONS.some((k) => k.key === kindQ)) {
      setForm((f) => ({ ...f, kind: kindQ as DocKind }));
    }
    if (offerId && offers.some((o) => o.id === offerId)) {
      setForm((f) => applySubjectKey(`offer:${offerId}`, staff, offers, f));
    } else if (userId && staff.some((s) => s.id === userId)) {
      setForm((f) => applySubjectKey(`staff:${userId}`, staff, offers, f));
    }
  }, [searchParams, staff, offers]);

  useEffect(() => {
    if (!subjectKey) return;
    window.setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [subjectKey]);

  const subjectRows = useMemo(
    () => (subjectKey && form.employeeName ? rows.filter((r) => docMatchesSubject(r, form)) : []),
    [rows, subjectKey, form],
  );

  const visible = useMemo(() => (kindFilter === "all" ? rows : rows.filter((r) => r.kind === kindFilter)), [rows, kindFilter]);

  const registerVisible = useMemo(() => {
    if (registerScope === "person" && subjectKey && form.employeeName) return visible.filter((r) => docMatchesSubject(r, form));
    return visible;
  }, [visible, registerScope, subjectKey, form]);

  function clearPreview() {
    setPreviewDocxBlob(null);
    setPreviewFingerprint("");
  }

  function setSubjectKey(key: string) {
    clearPreview();
    setForm((f) => applyPriorLetters(applySubjectKey(key, staff, offers, f), rows));
  }

  const [activeStage, setActiveStage] = useState<LetterStage>("Pre-joining");
  useEffect(() => {
    const st = KIND_OPTIONS.find((k) => k.key === form.kind)?.stage;
    if (st) setActiveStage(st);
  }, [form.kind]);

  function selectKind(kind: DocKind) {
    const existing = subjectRows.find((r) => r.kind === kind && r.status !== "Cancelled");
    clearPreview();
    setForm((f) => {
      const next = { ...f, kind };
      if (existing) return hydrateLetterFormFromDoc(existing, next);
      return applyPriorLetters(next, rows);
    });
    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const currentFingerprint = useMemo(() => letterFormFingerprint(form), [form]);

  async function fetchPreviewDocx(url: string, body?: object): Promise<Blob> {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Preview failed");
    }
    return res.blob();
  }

  async function upsertLetterRow(kind: DocKind, rowSource?: DocRow[]): Promise<string> {
    const pool = rowSource ?? rows;
    const payload = createBodyFromForm({ ...form, kind });
    if (editingId) {
      await api(`/api/hrm/hrms-documents/${editingId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          kind,
          employeeName: payload.employeeName,
          candidateEmail: payload.candidateEmail,
          designation: payload.designation,
          department: payload.department,
          effectiveDate: payload.effectiveDate,
          data: payload.data,
        }),
      });
      return editingId;
    }
    const existing = pool
      .filter((r) => docMatchesSubject(r, form))
      .find((r) => r.kind === kind && r.status !== "Cancelled");
    if (existing) {
      await api(`/api/hrm/hrms-documents/${existing.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          employeeName: payload.employeeName,
          candidateEmail: payload.candidateEmail,
          designation: payload.designation,
          department: payload.department,
          effectiveDate: payload.effectiveDate,
          data: payload.data,
        }),
      });
      return existing.id;
    }
    const created = await api<DocRow>("/api/hrm/hrms-documents", {
      method: "POST",
      token,
      body: JSON.stringify({ ...payload, kind }),
    });
    return created.id;
  }

  async function sharePointFor(id: string) {
    const r = await api<{ sharePointUrl: string }>(`/api/hrm/hrms-documents/${id}/sharepoint?file=docx`, { token });
    return r.sharePointUrl;
  }

  async function previewFullScreen() {
    const missing = missingLetterFields(form);
    if (missing.length) {
      setMsg(`Fill these before the full screen preview: ${missing.join(", ")}.`);
      return;
    }
    setMsg("");
    setPreviewBusy(true);
    try {
      const body = { ...createBodyFromForm(form), kind: form.kind };
      const blob = await fetchPreviewDocx(`${apiBase()}/api/hrm/hrms-documents/preview.docx`, body);
      setPreviewDocxBlob(blob);
      setPreviewTitle(`${KIND_OPTIONS.find((k) => k.key === form.kind)?.label || form.kind} · ${form.employeeName}`);
      setPreviewFingerprint(letterFormFingerprint(form));
      setPreviewExpanded(true);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function generateKind(kind: DocKind) {
    const missing = missingLetterFields(form);
    if (missing.length) {
      setMsg(`Fill these before filing the letter: ${missing.join(", ")}.`);
      return;
    }
    setMsg("");
    setGenerateBusy(true);
    try {
      const id = await upsertLetterRow(kind);
      const updated = await api<DocRow>(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
      let sp = letterSharePointLink(updated);
      if (!sp) {
        try {
          sp = await sharePointFor(id);
        } catch {
          sp = null;
        }
      }
      setFiledSharePoint(sp || "");
      setMsg(sp ? `${kind} is filed on SharePoint. Open it from the full screen preview or the register.` : `${kind} was generated. The SharePoint link is not ready yet — use Open in SharePoint on the register.`);
      await load();
      await openPreview(id, `${KIND_OPTIONS.find((k) => k.key === kind)?.label || kind} · ${form.employeeName}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    await generateKind(form.kind);
  }

  const activeKindMeta = KIND_OPTIONS.find((k) => k.key === form.kind) || KIND_OPTIONS[0];

  useEffect(() => {
    if (previewFingerprint && previewFingerprint !== currentFingerprint) {
      clearPreview();
    }
  }, [currentFingerprint, previewFingerprint]);

  async function openOnSharePoint(row: DocRow, file: "primary" | "html" | "docx" | "signed" | "annexure" = "primary") {
    setMsg("");
    try {
      const r = await api<{ sharePointUrl: string }>(`/api/hrm/hrms-documents/${row.id}/sharepoint?file=${file}`, { token });
      window.open(r.sharePointUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SharePoint link is not ready");
    }
  }

  async function openPreview(id: string, title: string) {
    setMsg("");
    try {
      const blob = await fetchPreviewDocx(`${apiBase()}/api/hrm/hrms-documents/${id}/preview.docx`);
      setPreviewDocxBlob(blob);
      setPreviewTitle(title);
      setPreviewExpanded(true);
      try {
        setFiledSharePoint(await sharePointFor(id));
      } catch {
        setFiledSharePoint("");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Preview failed");
    }
  }

  function editLetter(row: DocRow) {
    setForm((f) => hydrateLetterFormFromDoc(row, f));
    setEditingId(row.id);
    clearPreview();
    setMsg(`Editing ${row.refNo} · ${row.kind}. Change the fields, preview, then Generate to update this letter.`);
    window.setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  async function deleteLetter(row: DocRow) {
    if (!window.confirm(`Delete ${row.kind} ${row.refNo} for ${row.employeeName}?`)) return;
    try {
      await api(`/api/hrm/hrms-documents/${row.id}`, { method: "DELETE", token });
      if (editingId === row.id) setEditingId(null);
      setMsg(`Removed ${row.refNo}.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete letter");
    }
  }

  async function clearRegister() {
    if (!window.confirm("Delete every letter in the register? Staff logins stay. This cannot be undone.")) return;
    try {
      const res = await api<{ deleted: number }>("/api/hrm/hrms-documents", {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirm: "CLEAR" }),
      });
      setEditingId(null);
      clearPreview();
      setMsg(`Letters register cleared — ${res.deleted} letter(s) removed.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not clear the letters register");
    }
  }

  async function regenerate(id: string) {
    setMsg("");
    try {
      await api(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
      setMsg("Regenerated with the latest logo & formatting.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Regenerate failed");
    }
  }

  function pickUpload(id: string) {
    setUploadForId(id);
    if (uploadRef.current) {
      uploadRef.current.value = "";
      uploadRef.current.click();
    }
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadForId) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/hrm/hrms-documents/${uploadForId}/upload`, { method: "POST", token, body: fd });
      setMsg(`Signed copy attached (${file.name}).`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadForId(null);
    }
  }

  return (
    <div className="space-y-4">
      <HrmsPageHero
        eyebrow="Documents · Letters"
        title="HR letter desk"
        subtitle="Fill the letter, open the full screen preview, then Generate & file. Open in SharePoint uses the filed Word file."
        workflow={
          <>
            <span>
              <strong className="text-ink font-semibold">1.</strong> Select person once
            </span>
            <span>
              <strong className="text-ink font-semibold">2.</strong> Edit fields
            </span>
            <span>
              <strong className="text-ink font-semibold">3.</strong> Generate & file
            </span>
            <span>
              <strong className="text-ink font-semibold">4.</strong> Upload signed copy
            </span>
          </>
        }
      />

      {form.offerId ? (
        <p className="text-xs text-steel-muted px-1">
          Pre-join checklist:{" "}
          <Link to={`/hrm/onboarding/${form.offerId}`} className="text-brand font-semibold underline">
            Open onboarding for this offer
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs">
          <label className="text-steel-muted uppercase font-mono">Register filter</label>
          <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | DocKind)}>
            <option value="all">All kinds</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <StatusNote msg={msg} compact />
      </div>

      {canManage && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40">
            <div className="font-semibold text-sm">Letter composer</div>
            <p className="text-[11px] text-steel-muted mt-0.5">
              One employee · all template variables · Generate & file to SharePoint.
            </p>
            {editingId ? (
              <p className="text-xs text-brand mt-2">
                Editing a letter already on the register. Generate updates that row.
                <button type="button" className="ml-2 underline" onClick={() => setEditingId(null)}>
                  Cancel edit
                </button>
              </p>
            ) : null}
          </div>
          <div className="p-4 space-y-4">
            <label className="space-y-1 block max-w-xl">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Person (select once)</span>
              <Select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)}>
                <option value="">— Choose accepted offer or staff —</option>
                {subjectOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>

            {!subjectKey && !editingId ? (
              <p className="text-sm text-steel-muted">Select a person to fill letter variables and generate documents.</p>
            ) : (
              <div ref={formPanelRef} className="space-y-4 min-h-0 scroll-mt-24">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="tablist" aria-label="Letter stage">
                    {LETTER_STAGES.map((st, i) => {
                      const kinds = KIND_OPTIONS.filter((k) => k.stage === st.key);
                      const filed = kinds.filter((k) => subjectRows.some((r) => r.kind === k.key && r.status !== "Cancelled")).length;
                      const on = activeStage === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          onClick={() => setActiveStage(st.key)}
                          className={`text-left rounded-xl border-2 px-3 py-2.5 transition cursor-pointer ${on ? "shadow-sm" : "border-line bg-paper hover:bg-sand/40"}`}
                          style={on ? { borderColor: st.accent, background: `${st.accent}12` } : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: st.accent }}>
                              {i + 1}
                            </span>
                            <span className="font-semibold text-sm text-ink">{st.label}</span>
                          </div>
                          <div className="text-[11px] text-steel-muted mt-1">{st.hint}</div>
                          <div className="text-[11px] font-semibold mt-1" style={{ color: st.accent }}>
                            {filed} of {kinds.length} filed
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {KIND_OPTIONS.filter((k) => k.stage === activeStage).map((k) => {
                      const existing = subjectRows.find((r) => r.kind === k.key && r.status !== "Cancelled");
                      const active = form.kind === k.key;
                      const accent = LETTER_STAGES.find((st) => st.key === k.stage)?.accent || "#0F766E";
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() => selectKind(k.key)}
                          className={`text-left rounded-lg border px-3 py-2.5 transition cursor-pointer ${active ? "bg-white shadow-sm" : "border-line bg-paper hover:bg-sand/40"}`}
                          style={active ? { borderColor: accent, boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                        >
                          <div className="font-semibold text-sm text-ink">{k.label}</div>
                          <div className="text-[11px] text-steel-muted mt-0.5 line-clamp-2">{k.hint}</div>
                          {existing ? (
                            <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <IconCheck size={12} /> Filed · <span className="font-mono">{existing.refNo}</span>
                            </span>
                          ) : (
                            <span className="inline-block mt-1.5 rounded-full border border-line px-2 py-0.5 text-[10px] text-steel-muted">{formatUiText("Not generated yet")}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm">{activeKindMeta.label}</h3>
                      <p className="text-[11px] text-steel-muted">{activeKindMeta.hint}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-1 !text-xs"
                        disabled={previewBusy || generateBusy}
                        onClick={() => void previewFullScreen()}
                      >
                        {previewBusy ? "Opening preview…" : "Full screen preview"}
                      </Button>
                      <Button
                        type="button"
                        className="!py-1 !text-xs"
                        disabled={generateBusy || previewBusy}
                        onClick={() => void generateKind(form.kind)}
                      >
                        {generateBusy ? "Generating…" : "Generate & file"}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-mono uppercase text-steel-muted mb-2">Onboarding pack</h4>
                    <div className="flex flex-wrap gap-2">
                      {ONBOARDING_LETTER_PACK.map((kind) => {
                        const existing = subjectRows.find((r) => r.kind === kind);
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => selectKind(kind)}
                            className="text-[11px] px-2 py-1 rounded border border-line hover:bg-sand/50"
                          >
                            {KIND_OPTIONS.find((k) => k.key === kind)?.label}
                            {existing ? ` · ${existing.refNo}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={create} className="rounded-lg border border-line p-3 bg-sand/20 space-y-3">
                    <p className="text-[10px] font-mono uppercase text-steel-muted">Template variables for {form.employeeName}</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Employee name</span>
                        <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} required />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Emp code</span>
                        <Input value={form.empCode} onChange={(e) => setForm({ ...form, empCode: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Designation</span>
                        <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Department</span>
                        <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Email</span>
                        <Input value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Mobile</span>
                        <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">PAN</span>
                        <Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Gender</span>
                        <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                          <option value="">Mr. / Ms.</option>
                          <option value="Male">Male · Mr. / he</option>
                          <option value="Female">Female · Ms. / she</option>
                        </Select>
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Project / client site</span>
                        <Input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Effective / joining date</span>
                        <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                      </label>
                      <label className="space-y-1 sm:col-span-3">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Address (as per records)</span>
                        <TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                      </label>
                      {letterFormUsesCtc(form.kind) && (
                        <>
                          {letterFormUsesPromotionExtras(form.kind) && (
                            <>
                              <label className="space-y-1">
                                <span className="text-[11px] text-steel-muted uppercase font-mono">Previous designation</span>
                                <Input
                                  value={form.previousDesignation}
                                  onChange={(e) => setForm({ ...form, previousDesignation: e.target.value })}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] text-steel-muted uppercase font-mono">Previous CTC (INR p.a.)</span>
                                <Input value={form.previousCtc} onChange={(e) => setForm({ ...form, previousCtc: e.target.value })} />
                              </label>
                            </>
                          )}
                          <label className="space-y-1">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">
                              {form.kind === "Promotion" ? "Revised CTC (INR p.a.)" : "Fixed CTC (INR p.a.)"}
                            </span>
                            <Input value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-2">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Reporting manager</span>
                            <Input value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-3">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Base location</span>
                            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                          </label>
                        </>
                      )}
                      {letterFormUsesAssetExtras(form.kind) && (
                        <>
                          <label className="space-y-1 sm:col-span-2">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Assets returned</span>
                            <Input value={form.assets} onChange={(e) => setForm({ ...form, assets: e.target.value })} />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Serials / tags</span>
                            <Input value={form.serials} onChange={(e) => setForm({ ...form, serials: e.target.value })} />
                          </label>
                        </>
                      )}
                      {letterFormUsesSeparationReason(form.kind) && !letterFormUsesWarningExtras(form.kind) && (
                        <label className="space-y-1 sm:col-span-3">
                          <span className="text-[11px] text-steel-muted uppercase font-mono">Reason / remarks</span>
                          <TextArea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                        </label>
                      )}
                      <div className="sm:col-span-3 border-t border-line pt-3 space-y-2">
                        <p className="text-[11px] font-semibold text-ink">Variable sheet · {KIND_OPTIONS.find((k) => k.key === form.kind)?.label}</p>
                        <p className="text-[11px] text-steel-muted">
                          These fields print into the Word letter. Offer, appointment and promotion salary lines (basic, HRA, gross, net, annual CTC) fill from the CTC amount above.
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(LETTER_VARIABLES[form.kind] || []).map((field) => {
                            const value = form.sheet[field.key] ?? field.default ?? "";
                            const onChange = (next: string) => setForm({ ...form, sheet: { ...form.sheet, [field.key]: next } });
                            return (
                              <label key={field.key} className={`space-y-1 ${field.wide ? "sm:col-span-3" : ""}`}>
                                <span className="text-[11px] text-steel-muted uppercase font-mono">{field.label}</span>
                                {field.type === "textarea" ? (
                                  <TextArea rows={2} value={value} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />
                                ) : (
                                  <Input type={field.type === "date" ? "date" : "text"} value={value} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      {letterFormUsesWarningExtras(form.kind) && (
                        <>
                          <label className="space-y-1 sm:col-span-3">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Issue in brief</span>
                            <TextArea rows={2} value={form.issueInBrief} onChange={(e) => setForm({ ...form, issueInBrief: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-3">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Impact</span>
                            <TextArea rows={2} value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-3">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Corrective action required</span>
                            <TextArea rows={2} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" variant="secondary" disabled={previewBusy || generateBusy} onClick={() => void previewFullScreen()}>
                        {previewBusy ? "Opening preview…" : "Full screen preview"}
                      </Button>
                      <Button type="submit" disabled={generateBusy || previewBusy}>
                        {generateBusy ? "Generating…" : "Generate & file"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">Letters register · {registerVisible.length}</div>
            <div className="text-[11px] text-steel-muted">Every letter can be edited or deleted. SharePoint, print HTML, and the Word file stay on the row.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => setRegisterScope(registerScope === "all" ? "person" : "all")}>
              {registerScope === "all" ? "This person only" : "All letters"}
            </Button>
            {canManage && rows.length > 0 ? (
              <Button type="button" variant="secondary" className="!text-xs !border-danger !text-danger" onClick={() => void clearRegister()}>
                Clear letters register
              </Button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
        <div className="max-h-[min(480px,52vh)] overflow-y-auto overscroll-contain border-t border-line">
          <table className="min-w-[1020px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white sticky top-0 z-10 shadow-[0_1px_0_var(--color-line,#e5e7eb)]">
              <tr>
                <th className="p-2">Ref</th>
                <th>Kind</th>
                <th>Employee</th>
                <th>Designation / dept</th>
                <th>Effective</th>
                <th>Status</th>
                <th>SharePoint / DMS</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registerVisible.map((r) => (
                <tr key={r.id} className={`border-t border-line align-top ${editingId === r.id ? "bg-brand/5" : ""}`}>
                  <td className="p-2 font-mono text-[11px]">{r.refNo}</td>
                  <td>{r.kind}</td>
                  <td>{r.employeeName}</td>
                  <td>{[r.designation, r.department].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <Badge tone={r.status === "Signed" ? "ok" : r.status === "Cancelled" ? "danger" : "brand"}>{r.status}</Badge>
                  </td>
                  <td className="max-w-[200px]">
                    <button
                      type="button"
                      className="text-brand underline block text-[11px] text-left"
                      onClick={() => void openOnSharePoint(r, "primary")}
                    >
                      Open in SharePoint
                    </button>
                  </td>
                  <td className="space-y-1">
                    {r.generatedPdfUrl && (
                      <button type="button" className="text-brand underline block text-[11px] text-left" onClick={() => void openOnSharePoint(r, "html")}>
                        Print-ready letter on SharePoint
                      </button>
                    )}
                    {editableDocxUrl(r) && (
                      <button type="button" className="text-brand underline block text-[11px] text-left" onClick={() => void openOnSharePoint(r, "docx")}>
                        Editable letter on SharePoint
                      </button>
                    )}
                    {annexureXlsxUrl(r) && (
                      <button type="button" className="text-brand underline block text-[11px] text-left" onClick={() => void openOnSharePoint(r, "annexure")}>
                        Annexure I · CTC on SharePoint
                      </button>
                    )}
                    {r.uploadedFileUrl && (
                      <button type="button" className="text-brand underline block text-[11px] text-left" onClick={() => void openOnSharePoint(r, "signed")}>
                        Signed copy on SharePoint
                      </button>
                    )}
                    {!r.generatedPdfUrl && !editableDocxUrl(r) && !r.uploadedFileUrl && !annexureXlsxUrl(r) && (
                      <span className="text-steel-muted">—</span>
                    )}
                  </td>
                  <td className="space-y-1">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => editLetter(r)}
                          className="text-[11px] px-2 py-0.5 rounded border border-brand/40 text-brand hover:bg-brand/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteLetter(r)}
                          className="text-[11px] px-2 py-0.5 rounded border border-danger/40 text-danger hover:bg-danger/5"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => void openPreview(r.id, `${r.kind} · ${r.employeeName}`)}
                          className="text-[11px] px-2 py-0.5 rounded border border-line text-ink hover:bg-sand"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void regenerate(r.id)}
                          className="text-[11px] px-2 py-0.5 rounded border border-brand/40 text-brand hover:bg-brand/5"
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={() => pickUpload(r.id)}
                          className="text-[11px] px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 ml-1"
                        >
                          + Signed copy
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!registerVisible.length && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-steel-muted">
                    {subjectKey ? "No letters for this person yet — use the pack above." : "No letters yet — select a person above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {previewDocxBlob && previewExpanded
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true">
              <div className="bg-paper rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col min-h-0 overflow-hidden ring-1 ring-black/10">
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 shrink-0 text-white"
                  style={{ background: `linear-gradient(90deg, #1E3A5F, ${LETTER_STAGES.find((st) => st.key === activeKindMeta.stage)?.accent || "#0F766E"})` }}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.14em] opacity-80">
                      SPDC HR letter · {LETTER_STAGES.find((st) => st.key === activeKindMeta.stage)?.label}
                    </div>
                    <div className="font-semibold text-base truncate">{previewTitle || "Letter preview"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filedSharePoint ? (
                      <a href={filedSharePoint} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-brand">
                        Open in SharePoint
                      </a>
                    ) : null}
                    <Button type="button" className="!py-1 !text-xs" disabled={generateBusy} onClick={() => void generateKind(form.kind)}>
                      {generateBusy ? "Filing…" : "Generate & file"}
                    </Button>
                    <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setPreviewExpanded(false)}>
                      Close
                    </Button>
                  </div>
                </div>
                <HrmsDocxPreview blob={previewDocxBlob} layout="modal" />
              </div>
            </div>,
            document.body,
          )
        : null}

      <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={onUploadFile} />
    </div>
  );
}

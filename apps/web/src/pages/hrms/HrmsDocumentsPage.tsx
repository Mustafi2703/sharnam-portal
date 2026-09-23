import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiBase, mediaUrl } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../../components/ui";
import { canManageHrms } from "../../lib/portalAccounts";
import HrmsPageHero from "./HrmsPageHero";
import {
  ONBOARDING_LETTER_PACK,
  KIND_OPTIONS,
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
  emptyLetterForm,
  subjectKeyFromForm,
  hydrateLetterFormFromDoc,
  letterFormFingerprint,
  letterFormUsesAssetExtras,
  letterFormUsesCtc,
  letterFormUsesPromotionExtras,
  letterFormUsesSeparationReason,
  letterFormUsesWarningExtras,
} from "./hrmsLetterDesk";

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
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [packBusy, setPackBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [form, setForm] = useState(emptyLetterForm());
  const formPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);

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
    if (subjectKey && form.employeeName) return visible.filter((r) => docMatchesSubject(r, form));
    return visible;
  }, [visible, subjectKey, form]);

  function setSubjectKey(key: string) {
    setPreviewHtml("");
    setPreviewFingerprint("");
    setForm((f) => applySubjectKey(key, staff, offers, f));
  }

  function selectKind(kind: DocKind) {
    const existing = subjectRows.find((r) => r.kind === kind && r.status !== "Cancelled");
    setPreviewHtml("");
    setPreviewFingerprint("");
    setForm((f) => {
      const next = { ...f, kind };
      return existing ? hydrateLetterFormFromDoc(existing, next) : next;
    });
    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const currentFingerprint = useMemo(() => letterFormFingerprint(form), [form]);
  const previewIsCurrent = previewFingerprint === currentFingerprint && !!previewHtml;

  async function upsertLetterRow(kind: DocKind, rowSource?: DocRow[]): Promise<string> {
    const pool = rowSource ?? rows;
    const payload = createBodyFromForm({ ...form, kind });
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

  async function previewKind(kind: DocKind) {
    if (!form.employeeName.trim()) {
      setMsg("Select a person first.");
      return;
    }
    setMsg("");
    setPreviewBusy(true);
    try {
      const body = { ...createBodyFromForm({ ...form, kind }), kind };
      const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Preview failed");
      }
      const html = await res.text();
      setPreviewHtml(html);
      setPreviewTitle(`${KIND_OPTIONS.find((k) => k.key === kind)?.label || kind} · ${form.employeeName}`);
      setPreviewFingerprint(letterFormFingerprint({ ...form, kind }));
      setPreviewExpanded(false);
      window.setTimeout(() => previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function generateKind(kind: DocKind, opts?: { skipPreviewCheck?: boolean }) {
    if (!form.employeeName.trim()) {
      setMsg("Select a person first.");
      return;
    }
    if (!opts?.skipPreviewCheck && !previewIsCurrent) {
      setMsg("Preview the letter with current fields first, then Generate.");
      await previewKind(kind);
      return;
    }
    setMsg("");
    setGenerateBusy(true);
    try {
      const id = await upsertLetterRow(kind);
      await api(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
      setMsg(`${kind} generated — download .docx from the register below.`);
      await load();
      await openPreview(id, `${kind} · ${form.employeeName}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function generateOnboardingPack() {
    if (!form.employeeName.trim()) {
      setMsg("Select a person first.");
      return;
    }
    setPackBusy(true);
    setMsg("");
    const made: string[] = [];
    try {
      const fresh = await api<DocRow[]>("/api/hrm/hrms-documents", { token });
      for (const kind of ONBOARDING_LETTER_PACK) {
        const mine = fresh.filter((r) => docMatchesSubject(r, form));
        const existing = mine.find((r) => r.kind === kind && r.status !== "Cancelled");
        if (existing?.status === "Generated" || existing?.status === "Signed") continue;
        const id = await upsertLetterRow(kind, fresh);
        await api(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
        const ref = fresh.find((r) => r.id === id)?.refNo || existing?.refNo || kind;
        made.push(`${kind} · ${ref}`);
      }
      if (!made.length) {
        setMsg("Onboarding pack already on file for this person — open previews below or pick another letter type.");
      } else {
        setMsg(`Generated ${made.length} letter(s): ${made.join("; ")}`);
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Pack generate failed");
    } finally {
      setPackBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    await generateKind(form.kind);
  }

  const activeKindMeta = KIND_OPTIONS.find((k) => k.key === form.kind) || KIND_OPTIONS[0];

  useEffect(() => {
    if (previewFingerprint && previewFingerprint !== currentFingerprint) {
      setPreviewHtml("");
      setPreviewFingerprint("");
    }
  }, [currentFingerprint, previewFingerprint]);

  async function openPreview(id: string, title: string) {
    setMsg("");
    try {
      const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/${id}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Preview failed");
      const html = await res.text();
      setPreviewHtml(html);
      setPreviewTitle(title);
      setPreviewExpanded(true);
      setPreviewFingerprint(currentFingerprint);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Preview failed");
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
        subtitle="Pick one person. Preview is HTML on SPDC letterhead; Generate fills the official Word template ({{tokens}} from 00_SPDC_HR_Letters_Usage_Guide) → .docx + print HTML + employee vault / DMS."
        workflow={
          <>
            <span>
              <strong className="text-ink font-semibold">1.</strong> Select person once
            </span>
            <span>
              <strong className="text-ink font-semibold">2.</strong> Edit fields
            </span>
            <span>
              <strong className="text-ink font-semibold">3.</strong> Preview HTML
            </span>
            <span>
              <strong className="text-ink font-semibold">4.</strong> Generate .docx
            </span>
            <span>
              <strong className="text-ink font-semibold">5.</strong> Upload signed copy
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
        {msg ? <div className="text-xs text-brand font-medium">{msg}</div> : null}
      </div>

      {canManage && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40">
            <div className="font-semibold text-sm">Letter composer</div>
            <p className="text-[11px] text-steel-muted mt-0.5">
              One employee · all template variables · Preview (HTML) then Generate (official .docx from SPDC templates).
            </p>
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

            {!subjectKey ? (
              <p className="text-sm text-steel-muted">Select a person to fill letter variables and generate documents.</p>
            ) : (
              <div ref={formPanelRef} className="grid lg:grid-cols-[minmax(200px,240px)_1fr] gap-4 min-h-0 scroll-mt-24">
                <div className="rounded-lg border border-line bg-white flex flex-col min-h-0 max-h-[min(520px,55vh)]">
                  <div className="px-3 py-2 border-b border-line text-[10px] font-mono uppercase text-steel-muted shrink-0">
                    Letter types
                  </div>
                  <ul className="overflow-y-auto overscroll-contain divide-y divide-line flex-1">
                    {KIND_OPTIONS.map((k) => {
                      const existing = subjectRows.find((r) => r.kind === k.key && r.status !== "Cancelled");
                      const active = form.kind === k.key;
                      return (
                        <li key={k.key}>
                          <button
                            type="button"
                            onClick={() => selectKind(k.key)}
                            className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                              active ? "bg-brand-soft border-l-2 border-l-brand" : "hover:bg-sand/40"
                            }`}
                          >
                            <div className="font-semibold text-ink">{k.label}</div>
                            <div className="text-[10px] text-steel-muted mt-0.5 line-clamp-2">{k.hint}</div>
                            {existing ? (
                              <span className="inline-block mt-1 text-[10px] font-mono text-brand">{existing.refNo}</span>
                            ) : (
                              <span className="inline-block mt-1 text-[10px] text-steel-muted">Not on file</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="space-y-4 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm">{activeKindMeta.label}</h3>
                      <p className="text-[11px] text-steel-muted">{activeKindMeta.hint}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <Badge tone={previewIsCurrent ? "ok" : "warn"}>
                        {previewIsCurrent ? "Preview up to date" : "Preview required before generate"}
                      </Badge>
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-1 !text-xs"
                        disabled={previewBusy}
                        onClick={() => void previewKind(form.kind)}
                      >
                        {previewBusy ? "Loading preview…" : "Preview HTML"}
                      </Button>
                      <Button
                        type="button"
                        className="!py-1 !text-xs"
                        disabled={generateBusy || previewBusy}
                        onClick={() => void generateKind(form.kind)}
                      >
                        {generateBusy ? "Generating…" : "Generate .docx"}
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
                      <Button type="button" disabled={packBusy} className="!py-1 !text-xs" onClick={() => void generateOnboardingPack()}>
                        {packBusy ? "Generating…" : "Generate missing pack"}
                      </Button>
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
                        <Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
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
                      <Button type="button" variant="secondary" disabled={previewBusy} onClick={() => void previewKind(form.kind)}>
                        {previewBusy ? "Loading preview…" : "Preview HTML"}
                      </Button>
                      <Button type="submit" disabled={generateBusy || previewBusy}>
                        {generateBusy ? "Generating…" : "Generate & file"}
                      </Button>
                    </div>
                  </form>

                  <div
                    ref={previewPanelRef}
                    className="rounded-lg border border-line bg-white overflow-hidden min-h-[280px] flex flex-col"
                  >
                    <div className="px-3 py-2 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase text-steel-muted">Letter preview (HTML)</span>
                      {previewHtml ? (
                        <Button type="button" variant="secondary" className="!py-0.5 !text-[11px]" onClick={() => setPreviewHtml("")}>
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    {previewHtml ? (
                      <>
                        <iframe title="Letter preview inline" srcDoc={previewHtml} className="w-full flex-1 min-h-[320px] border-0 bg-white" />
                        <div className="px-3 py-2 border-t border-line flex flex-wrap gap-2">
                          <Button type="button" className="!text-xs" disabled={generateBusy} onClick={() => void generateKind(form.kind)}>
                            Generate .docx after preview
                          </Button>
                          <Button type="button" variant="secondary" className="!text-xs" onClick={() => setPreviewExpanded(true)}>
                            Full screen
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="p-4 text-sm text-steel-muted">
                        Select a letter type, edit the fields above, then click <strong className="text-ink">Preview HTML</strong>. The
                        preview loads here before you generate the official Word file.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              Letters register · {registerVisible.length}
              {subjectKey ? " (this person)" : ""}
            </div>
            <div className="text-[11px] text-steel-muted">Print HTML to PDF · edit .docx in Word · Annexure I when CTC is set.</div>
          </div>
        </div>
        <div className="overflow-x-auto">
        <div className="max-h-[min(480px,52vh)] overflow-y-auto overscroll-contain border-t border-line">
          <table className="min-w-[900px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white sticky top-0 z-10 shadow-[0_1px_0_var(--color-line,#e5e7eb)]">
              <tr>
                <th className="p-2">Ref</th>
                <th>Kind</th>
                <th>Employee</th>
                <th>Designation / dept</th>
                <th>Effective</th>
                <th>Status</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registerVisible.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="p-2 font-mono text-[11px]">{r.refNo}</td>
                  <td>{r.kind}</td>
                  <td>{r.employeeName}</td>
                  <td>{[r.designation, r.department].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <Badge tone={r.status === "Signed" ? "ok" : r.status === "Cancelled" ? "danger" : "brand"}>{r.status}</Badge>
                  </td>
                  <td className="space-y-1">
                    {r.generatedPdfUrl && (
                      <a href={mediaUrl(r.generatedPdfUrl)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Print-ready letter (HTML → PDF)
                      </a>
                    )}
                    {editableDocxUrl(r) && (
                      <a href={mediaUrl(editableDocxUrl(r)!)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Editable letter (.docx)
                      </a>
                    )}
                    {annexureXlsxUrl(r) && (
                      <a href={mediaUrl(annexureXlsxUrl(r)!)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Annexure I · CTC (.xlsx)
                      </a>
                    )}
                    {r.uploadedFileUrl && (
                      <a href={mediaUrl(r.uploadedFileUrl)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Signed copy
                      </a>
                    )}
                    {!r.generatedPdfUrl && !r.uploadedFileUrl && <span className="text-steel-muted">—</span>}
                  </td>
                  <td className="space-y-1">
                    {canManage && (
                      <>
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
                  <td colSpan={8} className="py-4 text-center text-steel-muted">
                    {subjectKey ? "No letters for this person yet — use the pack above." : "No letters yet — select a person above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {previewHtml && previewExpanded
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
              <div className="bg-paper rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line shrink-0">
                  <div className="font-semibold text-sm">{previewTitle || "Letter preview"}</div>
                  <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setPreviewExpanded(false)}>
                    Close
                  </Button>
                </div>
                <iframe title="Letter preview" srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white rounded-b-xl" />
              </div>
            </div>,
            document.body,
          )
        : null}

      <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={onUploadFile} />
    </div>
  );
}

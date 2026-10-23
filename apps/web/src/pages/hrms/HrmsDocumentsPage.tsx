import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../../api";
import { useAuth } from "../../auth";
import { OFFER_REQUIRED_DOCUMENTS } from "@sharnam/shared";
import { Badge, Button, Card, Input, Select, TextArea } from "../../components/ui";
import { canManageHrms } from "../../lib/portalAccounts";
import { rolesForDepartment, useHrmOrg } from "../../lib/hrmOrg";
import HrmsDocxPreview from "../../components/HrmsDocxPreview";
import HrmsPageHero from "./HrmsPageHero";
import LetterTableEditor from "./LetterTableEditor";
import {
  KIND_OPTIONS,
  LETTER_STAGES,
  type LetterFormState,
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
  isLeavingLetter,
  letterContentProblems,
  prepareExistingStaffPack,
  subjectKeyFromForm,
  applyPriorLetters,
  hydrateLetterFormFromDoc,
  letterFormFingerprint,
  letterKindLabel,
  letterFormUsesAssetExtras,
  letterFormUsesCtc,
  missingLetterFields,
  letterTables,
  letterTableRows,
  setLetterTableRows,
  letterFormUsesPromotionExtras,
  letterFormUsesSeparationReason,
  letterFormUsesWarningExtras,
  LETTER_VARIABLES,
  normalizeSeverity,
  withLetterAutofill,
} from "./hrmsLetterDesk";
import { StatusNote } from "../../components/StatusNote";
import { IconCheck } from "../../components/icons";
import { formatUiText } from "../../lib/formatUiText";

export default function HrmsDocumentsPage() {
  const { token, user } = useAuth();
  const org = useHrmOrg(token);
  const roleTitles = org.designations.filter((d) => d.isActive).map((d) => d.title);
  const [searchParams] = useSearchParams();
  const canManage = canManageHrms(user);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [previewDocxBlob, setPreviewDocxBlob] = useState<Blob | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [filedSharePoint, setFiledSharePoint] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewFromComposer, setPreviewFromComposer] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyLetterForm());

  useEffect(() => {
    if (!org.loaded) return;
    const role = org.designations.find((d) => d.isActive && d.title === form.designation);
    if (role && form.department !== role.department) setForm((f) => ({ ...f, department: role.department }));
  }, [org.loaded, org.designations, form.designation, form.department]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registerScope, setRegisterScope] = useState<"all" | "person">("all");
  const [kycFiled, setKycFiled] = useState<Set<string>>(new Set());
  const [kycBusy, setKycBusy] = useState("");
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
    if (!form.employeeUserId) {
      setKycFiled(new Set());
      return;
    }
    let cancelled = false;
    api<{ category: string }[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(form.employeeUserId)}`, { token })
      .then((list) => {
        if (!cancelled) setKycFiled(new Set(list.map((row) => row.category)));
      })
      .catch(() => {
        if (!cancelled) setKycFiled(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [form.employeeUserId, token]);

  useEffect(() => {
    const offerId = searchParams.get("offerId");
    const userId = searchParams.get("employeeUserId");
    const kindQ = searchParams.get("kind");
    if (kindQ && KIND_OPTIONS.some((k) => k.key === kindQ)) {
      setForm((f) => ({ ...f, kind: kindQ as DocKind }));
    }
    if (offerId && offers.some((o) => o.id === offerId)) {
      setForm((f) => withLetterAutofill(applySubjectKey(`offer:${offerId}`, staff, offers, f), staff, offers, rows));
    } else if (userId && staff.some((s) => s.id === userId)) {
      setForm((f) => withLetterAutofill(applySubjectKey(`staff:${userId}`, staff, offers, f), staff, offers, rows));
    }
  }, [searchParams, staff, offers, rows]);

  useEffect(() => {
    if (!subjectKey) return;
    window.setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [subjectKey]);

  const subjectRows = useMemo(
    () => (subjectKey && form.employeeName ? rows.filter((r) => docMatchesSubject(r, form)) : []),
    [rows, subjectKey, form],
  );

  const registerVisible = useMemo(() => {
    if (registerScope === "person" && subjectKey && form.employeeName) return rows.filter((r) => docMatchesSubject(r, form));
    return rows;
  }, [rows, registerScope, subjectKey, form]);

  function clearPreview() {
    setPreviewDocxBlob(null);
    setPreviewFingerprint("");
  }

  function setSubjectKey(key: string) {
    clearPreview();
    setEditingId(null);
    setForm((f) => withLetterAutofill(applyPriorLetters(applySubjectKey(key, staff, offers, f), rows), staff, offers, rows));
  }

  const [activeStage, setActiveStage] = useState<LetterStage>("Pre-joining");
  useEffect(() => {
    const st = KIND_OPTIONS.find((k) => k.key === form.kind)?.stage;
    if (st) setActiveStage(st);
  }, [form.kind]);

  function selectKind(kind: DocKind) {
    const existing = subjectRows.find((r) => r.kind === kind && r.status !== "Cancelled");
    clearPreview();
    // Editing one letter must not turn it into another kind on Generate.
    if (editingId && rows.find((r) => r.id === editingId)?.kind !== kind) setEditingId(null);
    setForm((f) => {
      const next = { ...f, kind };
      const built = existing ? hydrateLetterFormFromDoc(existing, next) : applyPriorLetters(next, rows);
      return withLetterAutofill(
        { ...built, gender: f.gender || built.gender, signatoryName: f.signatoryName || built.signatoryName },
        staff,
        offers,
        rows,
      );
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

  async function upsertLetterRow(kind: DocKind, rowSource?: DocRow[], snapshot?: LetterFormState): Promise<string> {
    const source = snapshot ?? form;
    const pool = rowSource ?? rows;
    const payload = createBodyFromForm({ ...source, kind });
    if (editingId && !snapshot) {
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
          issueDate: payload.issueDate,
          data: payload.data,
        }),
      });
      return editingId;
    }
    const existing = pool
      .filter((r) => docMatchesSubject(r, source))
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
          issueDate: payload.issueDate,
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
    const problems = letterContentProblems(form);
    if (missing.length || problems.length) {
      const message = [...missing.map((m) => `Fill ${m}`), ...problems].join(" ");
      setPreviewError(message);
      setMsg(message);
      return;
    }
    setPreviewError("");
    setMsg("");
    setPreviewBusy(true);
    try {
      const body = { ...createBodyFromForm(form), kind: form.kind };
      const blob = await fetchPreviewDocx(`${apiBase()}/api/hrm/hrms-documents/preview.docx`, body);
      setPreviewDocxBlob(blob);
      setPreviewTitle(`${letterKindLabel(form.kind)} · ${form.employeeName}`);
      setPreviewFingerprint(letterFormFingerprint(form));
      setPreviewFromComposer(true);
      setPreviewExpanded(true);
      setPreviewError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview failed";
      setPreviewError(message);
      setMsg(message);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function generateKind(kind: DocKind) {
    const missing = missingLetterFields(form);
    const problems = letterContentProblems(form);
    if (missing.length || problems.length) {
      setMsg([...missing.map((m) => `Fill ${m}`), ...problems].join(" "));
      return;
    }
    setMsg("");
    setGenerateBusy(true);
    try {
      const id = await upsertLetterRow(kind);
      const updated = await api<DocRow & { missingDocuments?: string[] }>(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
      let sp = letterSharePointLink(updated);
      if (!sp) {
        try {
          sp = await sharePointFor(id);
        } catch {
          sp = null;
        }
      }
      setFiledSharePoint(sp || "");
      const label = letterKindLabel(kind);
      const scans = updated.missingDocuments?.length ? ` Still to upload: ${updated.missingDocuments.join(", ")}.` : "";
      setMsg(sp ? `${label} is filed on SharePoint. Open it from the full screen preview or the register.${scans}` : `${label} was generated. The SharePoint link is not ready yet — use Open in SharePoint on the register.${scans}`);
      setEditingId(null);
      await load();
      await openPreview(id, `${label} · ${form.employeeName}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function uploadKyc(category: string, file: File) {
    if (!form.employeeUserId) return;
    setKycBusy(category);
    try {
      const fd = new FormData();
      fd.append("userId", form.employeeUserId);
      fd.append("category", category);
      fd.append("files", file);
      await api("/api/hrm/employee-files", { method: "POST", token, body: fd });
      setKycFiled((prev) => new Set([...prev, category]));
      setMsg(`${category} is on the employee file.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setKycBusy("");
    }
  }

  async function fileOnboardingSet() {
    if (!form.employeeUserId) {
      setMsg("Pick the existing employee, then file the joining letters.");
      return;
    }
    const prepared = prepareExistingStaffPack(form);
    setForm(prepared);
    setGenerateBusy(true);
    setMsg("");
    const notes: string[] = [];
    let pool = [...rows];
    let appointmentRef = prepared.sheet.appointmentRefNo || "";
    try {
      for (const kind of ONBOARDING_LETTER_PACK) {
        let probe: LetterFormState = { ...prepared, kind };
        if (kind === "NdaJoining" && appointmentRef) {
          probe = {
            ...probe,
            sheet: {
              ...probe.sheet,
              appointmentRefNo: probe.sheet.appointmentRefNo || appointmentRef,
              appointmentDate: probe.sheet.appointmentDate || probe.effectiveDate,
            },
          };
        }
        if (kind === "Confirmation" && probe.sheet.probationEndDate) {
          probe = { ...probe, issueDate: probe.sheet.probationEndDate };
        }
        const missing = missingLetterFields(probe);
        const problems = letterContentProblems(probe);
        if (missing.length || problems.length) {
          notes.push(`${letterKindLabel(kind)} still needs ${[...missing, ...problems].join("; ")}.`);
          continue;
        }
        const id = await upsertLetterRow(kind, pool, probe);
        const updated = await api<DocRow & { missingDocuments?: string[] }>(`/api/hrm/hrms-documents/${id}/generate`, {
          method: "POST",
          token,
        });
        if (!pool.some((row) => row.id === id)) pool = [...pool, { ...updated, id, kind }];
        if (kind === "Appointment" && updated.refNo) appointmentRef = updated.refNo;
        const scans = updated.missingDocuments?.length ? ` Upload still open: ${updated.missingDocuments.join(", ")}.` : "";
        notes.push(`${letterKindLabel(kind)} is filed.${scans}`);
      }
      setMsg(notes.join(" "));
      setEditingId(null);
      await load();
    } catch (err) {
      setMsg([err instanceof Error ? err.message : "Generate failed", ...notes].filter(Boolean).join(" "));
    } finally {
      setGenerateBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const filed = filedAppointmentLetter();
    if (filed) {
      openFiledPdf(filed);
      return;
    }
    await generateKind(form.kind);
  }

  function filedAppointmentLetter() {
    if (form.kind !== "Appointment") return null;
    return (
      subjectRows.find((r) => r.kind === "Appointment" && r.status !== "Cancelled" && Boolean(r.generatedPdfUrl || r.sharePointUrl)) || null
    );
  }

  function openFiledPdf(row: DocRow) {
    const url = row.generatedPdfUrl || row.sharePointUrl || "";
    if (!url) return;
    const abs = /^https?:\/\//i.test(url) ? url : `${apiBase()}${url.startsWith("/") ? url : `/${url}`}`;
    window.open(abs, "_blank", "noopener,noreferrer");
  }

  const activeKindMeta = KIND_OPTIONS.find((k) => k.key === form.kind) || KIND_OPTIONS[0];
  const filedAppointment = filedAppointmentLetter();
  const fieldLabel = "text-[11px] text-steel-muted font-semibold";

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
      setPreviewFromComposer(false);
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
    setForm((f) => withLetterAutofill(hydrateLetterFormFromDoc(row, f), staff, offers, rows));
    setEditingId(row.id);
    clearPreview();
    setMsg(`Editing ${row.refNo} · ${letterKindLabel(row.kind)}. Change the fields, preview, then Generate to update this letter.`);
    window.setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  async function deleteLetter(row: DocRow) {
    if (!window.confirm(`Delete ${letterKindLabel(row.kind)} ${row.refNo} for ${row.employeeName}?`)) return;
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
    if (rowBusyId) return;
    setMsg("Regenerating…");
    setRowBusyId(id);
    try {
      await api(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
      setMsg("Regenerated with the latest logo & formatting.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRowBusyId(null);
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
    setRowBusyId(uploadForId);
    setMsg(`Uploading ${file.name}…`);
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
      setRowBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <HrmsPageHero eyebrow="Documents · Letters" title="HR letter desk" subtitle="" />

      {form.offerId ? (
        <p className="text-xs text-steel-muted px-1">
          Pre-join checklist:{" "}
          <Link to={`/hrm/onboarding/${form.offerId}`} className="text-brand font-semibold underline">
            Open onboarding for this offer
          </Link>
        </p>
      ) : null}

      <div className="flex justify-end px-1">
        <StatusNote msg={msg} compact />
      </div>

      {canManage && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40">
            <div className="font-semibold text-sm">{formatUiText("Letter Composer")}</div>
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
              <span className={fieldLabel}>{formatUiText("Person (Select Once)")}</span>
              <Select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)}>
                <option value="">— Choose accepted offer or staff —</option>
                {subjectOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>

            {form.employeeUserId ? (
              <div className="rounded border border-line p-3 space-y-2">
                <p className="text-xs text-steel-muted">
                  Upload PAN, Aadhaar, and the other scans here. Existing staff can file letters before every scan is in.
                </p>
                <div className="flex flex-wrap gap-2">
                  {OFFER_REQUIRED_DOCUMENTS.map((name) => (
                    <label key={name} className="text-[11px] px-2 py-1 rounded border border-line cursor-pointer">
                      {kycBusy === name ? "Uploading…" : kycFiled.has(name) ? "On file · " : "Upload · "}
                      {name}
                      <input
                        type="file"
                        className="hidden"
                        disabled={kycBusy !== ""}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadKyc(name, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

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
                          <div className="font-semibold text-sm text-ink">{formatUiText(k.label)}</div>
                          {k.hint ? <div className="text-[11px] text-steel-muted mt-0.5 line-clamp-2">{k.hint}</div> : null}
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
                      <h3 className="font-semibold text-sm">{formatUiText(activeKindMeta.label)}</h3>
                      {activeKindMeta.hint ? <p className="text-[11px] text-steel-muted">{activeKindMeta.hint}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <div className="flex flex-col items-stretch">
                        {previewError ? <p className="text-danger text-xs mb-1">{previewError}</p> : null}
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !text-xs"
                          disabled={previewBusy || generateBusy}
                          onClick={() => void previewFullScreen()}
                        >
                          {previewBusy ? "Opening preview…" : "Full screen preview"}
                        </Button>
                      </div>
                      {filedAppointment ? (
                        <Button type="button" className="!py-1 !text-xs" onClick={() => openFiledPdf(filedAppointment)}>
                          View PDF
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="!py-1 !text-xs"
                          disabled={generateBusy || previewBusy}
                          onClick={() => void generateKind(form.kind)}
                        >
                          {generateBusy ? "Generating…" : "Generate & file"}
                        </Button>
                      )}
                      {form.employeeUserId ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-1 !text-xs"
                          disabled={generateBusy || previewBusy}
                          onClick={() => void fileOnboardingSet()}
                        >
                          File joining letters
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <form onSubmit={create} className="rounded-lg border border-line p-3 bg-sand/20 space-y-3">
                    <p className="text-[11px] font-semibold text-steel-muted">{formatUiText("Template Variables For")} {form.employeeName}</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <label className="space-y-1 sm:col-span-2">
                        <span className={fieldLabel}>{formatUiText("Employee Name")}</span>
                        <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} required />
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Emp Code")}</span>
                        <Input value={form.empCode} onChange={(e) => setForm({ ...form, empCode: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Department")}</span>
                        <span className="block text-[10px] font-normal text-steel-muted">{formatUiText("From the department master")}</span>
                        <Select
                          value={org.departments.some((d) => d.name === form.department) ? form.department : ""}
                          onChange={(e) => {
                            const department = e.target.value;
                            const stillValid = rolesForDepartment(org.designations, department).some((r) => r.title === form.designation);
                            setForm({ ...form, department, designation: stillValid ? form.designation : "" });
                          }}
                        >
                          <option value="">Department…</option>
                          {org.departments.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Designation")}</span>
                        <span className="block text-[10px] font-normal text-steel-muted">{formatUiText("From the role master")}</span>
                        <Select
                          value={roleTitles.includes(form.designation) ? form.designation : ""}
                          onChange={(e) => {
                            const designation = e.target.value;
                            const department = org.designations.find((d) => d.title === designation)?.department || form.department;
                            setForm({ ...form, designation, department });
                          }}
                        >
                          <option value="">Role…</option>
                          {rolesForDepartment(org.designations, form.department).map((r) => (
                            <option key={r.id} value={r.title}>
                              {r.title}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Email")}</span>
                        <Input value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Mobile Number")}</span>
                        <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                      </label>
                      {form.kind === "Appointment" ? null : (
                        <label className="space-y-1">
                          <span className={fieldLabel}>{formatUiText("PAN")}</span>
                          <Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
                        </label>
                      )}
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Company Signatory")}</span>
                        <Input value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>{formatUiText("Gender")}</span>
                        <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                          <option value="">Mr. / Ms.</option>
                          <option value="Male">Male · Mr. / he</option>
                          <option value="Female">Female · Ms. / she</option>
                        </Select>
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className={fieldLabel}>{formatUiText("Project / Client Site")}</span>
                        <Input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className={fieldLabel}>
                          {formatUiText(isLeavingLetter(form.kind) ? "Last Working Date" : form.kind === "Promotion" || form.kind === "Warning" ? "Effective Date" : "Joining Date")}
                        </span>
                        <Input
                          type="date"
                          value={form.effectiveDate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (isLeavingLetter(form.kind)) {
                              setForm({ ...form, effectiveDate: value, sheet: { ...form.sheet, lastWorkingDate: value } });
                            } else setForm({ ...form, effectiveDate: value });
                          }}
                        />
                      </label>
                      <label className="space-y-1 sm:col-span-3">
                        <span className={fieldLabel}>{formatUiText("Address (As Per Records)")}</span>
                        <TextArea rows={2} value={form.address} readOnly className="bg-sand/60" />
                      </label>
                      {letterFormUsesCtc(form.kind) && form.kind !== "Promotion" && (
                        <>
                          <label className="space-y-1">
                            <span className={fieldLabel}>{formatUiText("Fixed CTC (INR P.A.)")}</span>
                            <Input value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-2">
                            <span className={fieldLabel}>{formatUiText("Reporting Manager")}</span>
                            <Input value={form.reportingManager} readOnly className="bg-sand/60" />
                          </label>
                        </>
                      )}
                      {letterFormUsesCtc(form.kind) && (
                        <label className="space-y-1 sm:col-span-3">
                          <span className={fieldLabel}>{formatUiText("Base Location")}</span>
                          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                        </label>
                      )}
                      {letterFormUsesSeparationReason(form.kind) && !letterFormUsesWarningExtras(form.kind) && (
                        <label className="space-y-1 sm:col-span-3">
                          <span className={fieldLabel}>{formatUiText("Reason / Remarks")}</span>
                          <TextArea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                        </label>
                      )}
                      <div className="sm:col-span-3 border-t border-line pt-3 space-y-2">
                        <p className="text-[11px] font-semibold text-ink">{formatUiText("Variable Sheet")}</p>
                        {letterFormUsesPromotionExtras(form.kind) && (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Previous Designation")}</span>
                              <Input value={form.previousDesignation} readOnly className="bg-sand/60" />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Previous Department")}</span>
                              <Input value={form.sheet.previousDepartment || ""} readOnly className="bg-sand/60" />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Previous CTC (INR P.A.)")}</span>
                              <Input value={form.previousCtc} readOnly className="bg-sand/60" />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Revised CTC (INR P.A.)")}</span>
                              <Input value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Previous Reporting Manager")}</span>
                              <Input value={form.reportingManager} readOnly className="bg-sand/60" />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("New Reporting Manager")}</span>
                              <Input
                                value={form.sheet.newReportingManager || ""}
                                onChange={(e) => setForm({ ...form, sheet: { ...form.sheet, newReportingManager: e.target.value } })}
                              />
                            </label>
                          </div>
                        )}
                        {letterFormUsesAssetExtras(form.kind) && (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <label className="space-y-1 sm:col-span-2">
                              <span className={fieldLabel}>{formatUiText("Assets Returned")}</span>
                              <Input value={form.assets} onChange={(e) => setForm({ ...form, assets: e.target.value })} />
                            </label>
                            <label className="space-y-1">
                              <span className={fieldLabel}>{formatUiText("Serials / Tags")}</span>
                              <Input value={form.serials} onChange={(e) => setForm({ ...form, serials: e.target.value })} />
                            </label>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(LETTER_VARIABLES[form.kind] || []).filter((field) => !field.hidden).map((field) => {
                            const raw = form.sheet[field.key] ?? field.default ?? "";
                            const value = field.key === "severity" ? normalizeSeverity(raw) : raw;
                            const onChange = (next: string) => setForm({ ...form, sheet: { ...form.sheet, [field.key]: next } });
                            return (
                              <label key={field.key} className={`space-y-1 ${field.wide ? "sm:col-span-3" : ""}`}>
                                <span className={fieldLabel}>{formatUiText(field.label)}</span>
                                {field.type === "select" ? (
                                  <Select value={value} onChange={(e) => onChange(e.target.value)}>
                                    <option value="">Select…</option>
                                    {(field.options || []).map((opt) => (
                                      <option key={opt} value={field.key === "severity" ? normalizeSeverity(opt) : opt}>
                                        {formatUiText(field.key === "severity" ? normalizeSeverity(opt) : opt)}
                                      </option>
                                    ))}
                                  </Select>
                                ) : field.type === "role" ? (
                                  <Select value={roleTitles.includes(value) ? value : ""} onChange={(e) => onChange(e.target.value)}>
                                    <option value="">Role…</option>
                                    {roleTitles.map((title) => (
                                      <option key={title} value={title}>
                                        {title}
                                      </option>
                                    ))}
                                  </Select>
                                ) : field.type === "textarea" ? (
                                  <TextArea rows={2} value={value} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />
                                ) : (
                                  <Input type={field.type === "date" ? "date" : "text"} value={value} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {letterTables(form.kind).map((spec) => (
                          <LetterTableEditor
                            key={spec.key}
                            spec={spec}
                            rows={letterTableRows(form, spec)}
                            roles={spec.key === "designationRows" ? roleTitles : undefined}
                            onChange={(rows) => setForm(setLetterTableRows(form, spec, rows))}
                          />
                        ))}
                      </div>
                      {letterFormUsesWarningExtras(form.kind) && (
                        <>
                          <label className="space-y-1 sm:col-span-3">
                            <span className={fieldLabel}>{formatUiText("Issue In Brief")}</span>
                            <TextArea rows={2} value={form.issueInBrief} onChange={(e) => setForm({ ...form, issueInBrief: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-3">
                            <span className={fieldLabel}>{formatUiText("Impact")}</span>
                            <TextArea rows={2} value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} />
                          </label>
                          <label className="space-y-1 sm:col-span-3">
                            <span className={fieldLabel}>{formatUiText("Corrective Action Required")}</span>
                            <TextArea rows={2} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 items-end">
                      <div className="flex flex-col items-stretch">
                        {previewError ? <p className="text-danger text-xs mb-1">{previewError}</p> : null}
                        <Button type="button" variant="secondary" disabled={previewBusy || generateBusy} onClick={() => void previewFullScreen()}>
                          {previewBusy ? "Opening preview…" : "Full screen preview"}
                        </Button>
                      </div>
                      {filedAppointment ? (
                        <Button type="button" onClick={() => openFiledPdf(filedAppointment)}>
                          View PDF
                        </Button>
                      ) : (
                        <Button type="submit" disabled={generateBusy || previewBusy}>
                          {generateBusy ? "Generating…" : "Generate & file"}
                        </Button>
                      )}
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
            <div className="font-semibold text-sm">{formatUiText("Letters Register")} · {registerVisible.length}</div>
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
                  <td>{letterKindLabel(r.kind)}</td>
                  <td>{r.employeeName}</td>
                  <td>{[r.designation, r.department].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "—"}</td>
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
                          onClick={() => void openPreview(r.id, `${letterKindLabel(r.kind)} · ${r.employeeName}`)}
                          className="text-[11px] px-2 py-0.5 rounded border border-line text-ink hover:bg-sand"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          disabled={!!rowBusyId}
                          onClick={() => void regenerate(r.id)}
                          className="text-[11px] px-2 py-0.5 rounded border border-brand/40 text-brand hover:bg-brand/5 disabled:opacity-50"
                        >
                          {rowBusyId === r.id && !uploadForId ? "Regenerating…" : "Regenerate"}
                        </button>
                        <button
                          type="button"
                          disabled={!!rowBusyId}
                          onClick={() => pickUpload(r.id)}
                          className="text-[11px] px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 ml-1 disabled:opacity-50"
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
                    {subjectKey ? "No letters for this person yet." : "No letters yet. Select a person above."}
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
                    {previewFromComposer && filedAppointment ? (
                      <Button type="button" className="!py-1 !text-xs" onClick={() => openFiledPdf(filedAppointment)}>
                        View PDF
                      </Button>
                    ) : null}
                    {previewFromComposer && !filedAppointment ? (
                      <Button type="button" className="!py-1 !text-xs" disabled={generateBusy} onClick={() => void generateKind(form.kind)}>
                        {generateBusy ? "Filing…" : "Generate & file"}
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setPreviewExpanded(false)}>
                      Close
                    </Button>
                  </div>
                </div>
                {msg ? (
                  <div className="px-5 py-2 border-b border-line bg-sand/40">
                    <StatusNote msg={msg} compact />
                  </div>
                ) : null}
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

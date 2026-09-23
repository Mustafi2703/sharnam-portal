import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [form, setForm] = useState(emptyLetterForm());
  const [showDetails, setShowDetails] = useState(false);

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
    if (offerId && offers.some((o) => o.id === offerId)) {
      setForm((f) => applySubjectKey(`offer:${offerId}`, staff, offers, f));
    } else if (userId && staff.some((s) => s.id === userId)) {
      setForm((f) => applySubjectKey(`staff:${userId}`, staff, offers, f));
    }
  }, [searchParams, staff, offers]);

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
    setForm((f) => applySubjectKey(key, staff, offers, f));
  }

  async function previewKind(kind: DocKind) {
    if (!form.employeeName.trim()) {
      setMsg("Select a person first.");
      return;
    }
    setMsg("");
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
      setPreviewHtml(await res.text());
      setPreviewTitle(`${KIND_OPTIONS.find((k) => k.key === kind)?.label || kind} · ${form.employeeName}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function generateKind(kind: DocKind) {
    if (!form.employeeName.trim()) {
      setMsg("Select a person first.");
      return;
    }
    setMsg("");
    try {
      const body = { ...createBodyFromForm({ ...form, kind }), kind };
      const created = await api<DocRow>("/api/hrm/hrms-documents", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      await api(`/api/hrm/hrms-documents/${created.id}/generate`, { method: "POST", token });
      setMsg(`${created.kind} · ${created.refNo} generated and filed.`);
      await load();
      await openPreview(created.id, `${created.kind} · ${created.refNo}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Generate failed");
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
      for (const kind of ONBOARDING_LETTER_PACK) {
        const existing = subjectRows.find((r) => r.kind === kind && r.status !== "Cancelled");
        if (existing) continue;
        const body = { ...createBodyFromForm({ ...form, kind }), kind };
        const created = await api<DocRow>("/api/hrm/hrms-documents", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        await api(`/api/hrm/hrms-documents/${created.id}/generate`, { method: "POST", token });
        made.push(`${kind} · ${created.refNo}`);
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

  async function openPreview(id: string, title: string) {
    setMsg("");
    try {
      const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/${id}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Preview failed");
      setPreviewHtml(await res.text());
      setPreviewTitle(title);
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
              <strong className="text-ink font-semibold">2.</strong> Preview
            </span>
            <span>
              <strong className="text-ink font-semibold">3.</strong> Generate pack / letter
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
        {msg ? <div className="text-xs text-brand font-medium">{msg}</div> : null}
      </div>

      {canManage && (
        <Card className="!p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 flex-1 min-w-[240px]">
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
            {subjectKey ? (
              <div className="text-xs text-steel-muted pb-1">
                <strong className="text-ink">{form.employeeName}</strong>
                {form.designation ? ` · ${form.designation}` : ""}
                {form.ctcAnnual ? ` · CTC ₹${Number(form.ctcAnnual).toLocaleString("en-IN")}` : ""}
                {form.effectiveDate ? ` · ${form.effectiveDate}` : ""}
              </div>
            ) : null}
          </div>

          {subjectKey ? (
            <>
              <div>
                <h3 className="font-semibold text-sm mb-2">Onboarding letter pack</h3>
                <p className="text-[11px] text-steel-muted mb-3">
                  Offer, appointment, NDA at joining, and confirmation — preview any row, then generate missing letters in one go.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {ONBOARDING_LETTER_PACK.map((kind) => {
                    const existing = subjectRows.find((r) => r.kind === kind);
                    const meta = KIND_OPTIONS.find((k) => k.key === kind)!;
                    return (
                      <div key={kind} className="rounded-lg border border-line p-3 bg-sand/30 space-y-2">
                        <div className="font-medium text-xs">{meta.label}</div>
                        <Badge tone={existing ? "ok" : "brand"}>{existing ? existing.refNo : "Not generated"}</Badge>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-[11px] px-2 py-0.5 rounded border border-line hover:bg-paper"
                            onClick={() => void previewKind(kind)}
                          >
                            Preview
                          </button>
                          {!existing ? (
                            <button
                              type="button"
                              className="text-[11px] px-2 py-0.5 rounded border border-brand/40 text-brand hover:bg-brand/5"
                              onClick={() => void generateKind(kind)}
                            >
                              Generate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-[11px] px-2 py-0.5 rounded border border-line hover:bg-paper"
                              onClick={() => void openPreview(existing.id, `${kind} · ${existing.refNo}`)}
                            >
                              Open
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" disabled={packBusy} onClick={() => void generateOnboardingPack()}>
                    {packBusy ? "Generating…" : "Generate missing onboarding letters"}
                  </Button>
                </div>
              </div>

              <details open={showDetails} onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Other letter types &amp; edit fields</summary>
                <form onSubmit={create} className="grid md:grid-cols-3 gap-3 text-sm mt-3 pt-3 border-t border-line">
                  <label className="space-y-1">
                    <span className="text-[11px] text-steel-muted uppercase font-mono">Kind</span>
                    <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DocKind })}>
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] text-steel-muted uppercase font-mono">Effective / joining date</span>
                    <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                  </label>
                  {(form.kind === "Appointment" || form.kind === "Offer" || form.kind === "Promotion") && (
                    <>
                      {form.kind === "Promotion" && (
                        <>
                          <label className="space-y-1">
                            <span className="text-[11px] text-steel-muted uppercase font-mono">Previous designation</span>
                            <Input value={form.previousDesignation} onChange={(e) => setForm({ ...form, previousDesignation: e.target.value })} />
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
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Reporting manager</span>
                        <Input value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Base location</span>
                        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                      </label>
                    </>
                  )}
                  {form.kind === "AssetReturn" && (
                    <>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Assets returned</span>
                        <Input placeholder="Laptop, mobile, ID card…" value={form.assets} onChange={(e) => setForm({ ...form, assets: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-steel-muted uppercase font-mono">Serials / asset tags</span>
                        <Input value={form.serials} onChange={(e) => setForm({ ...form, serials: e.target.value })} />
                      </label>
                    </>
                  )}
                  {(form.kind === "Warning" || form.kind === "Exit") && (
                    <label className="space-y-1 md:col-span-3">
                      <span className="text-[11px] text-steel-muted uppercase font-mono">
                        {form.kind === "Warning" ? "Concern / remarks" : "Reason for exit"}
                      </span>
                      <TextArea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                    </label>
                  )}
                  <label className="space-y-1">
                    <span className="text-[11px] text-steel-muted uppercase font-mono">Emp code</span>
                    <Input value={form.empCode} onChange={(e) => setForm({ ...form, empCode: e.target.value })} />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] text-steel-muted uppercase font-mono">Address</span>
                    <TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </label>
                  <div className="md:col-span-3 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => void previewKind(form.kind)}>
                      Preview this kind
                    </Button>
                    <Button type="submit">Generate &amp; file</Button>
                  </div>
                </form>
              </details>
            </>
          ) : (
            <p className="text-sm text-steel-muted">Select an accepted offer or onboarded staff member to preview and generate letters.</p>
          )}
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
          <table className="min-w-[900px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
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
      </Card>

      {previewHtml ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line shrink-0">
              <div className="font-semibold text-sm">{previewTitle || "Letter preview"}</div>
              <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setPreviewHtml("")}>
                Close
              </Button>
            </div>
            <iframe title="Letter preview" srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white rounded-b-xl" />
          </div>
        </div>
      ) : null}

      <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={onUploadFile} />
    </div>
  );
}

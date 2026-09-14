import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiBase, mediaUrl } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../../components/ui";
import { canManageHrms } from "../../lib/portalAccounts";

/**
 * HRMS letter desk — Appointment / Promotion / Relieving / Exit / Offer / Confirmation.
 * Two ways to add a document:
 *   1. Fill the form and click "Generate" — the system builds a Sharnam-branded HTML letter
 *      (print → Save as PDF) plus an editable .xlsx annexure. Both land under
 *      06_HR_AND_ADMIN/06.01_Letters and are surfaced with SharePoint links.
 *   2. Upload the signed / scanned copy back after issuance.
 * Formats (real letterheads) go in apps/api/formats/hrms/<Kind>.html and the system
 * will use them instead of the built-in template.
 */

type DocKind =
  | "Appointment"
  | "Offer"
  | "Relieving"
  | "Exit"
  | "AssetReturn"
  | "Confirmation"
  | "Promotion"
  | "Warning"
  | "Experience";

type DocRow = {
  id: string;
  kind: DocKind;
  refNo: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  effectiveDate: string | null;
  issueDate: string;
  status: string;
  dataJson: string;
  generatedDocxUrl: string | null;
  generatedPdfUrl: string | null;
  uploadedFileUrl: string | null;
  sharePointUrl: string | null;
  createdBy?: { fullName?: string; email?: string } | null;
};

const KIND_OPTIONS: { key: DocKind; label: string; hint: string }[] = [
  { key: "Appointment", label: "Appointment letter", hint: "17-clause SPDC letter of appointment + Annexures I–III" },
  { key: "Offer", label: "Offer letter", hint: "Pre-appointment offer with fixed CTC and joining date" },
  { key: "Relieving", label: "Relieving letter", hint: "Issued on last working day after clearance" },
  { key: "Exit", label: "Exit letter", hint: "Formal separation intimation & exit checklist trigger" },
  { key: "AssetReturn", label: "Asset submission letter", hint: "IT + admin asset return acknowledgement" },
  { key: "Confirmation", label: "Confirmation letter", hint: "Post-probation confirmation of services" },
  { key: "Promotion", label: "Letter of promotion", hint: "SPDC branded promotion with name, previous/new role, and revised CTC" },
  { key: "Warning", label: "Warning / concern letter", hint: "Notice of concern with corrective actions" },
  { key: "Experience", label: "Experience certificate", hint: "Tenure and role certificate on request" },
];

export default function HrmsDocumentsPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | DocKind>("all");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);

  const [staff, setStaff] = useState<Array<{ id: string; fullName: string; email: string; profile?: any }>>([]);
  const [offers, setOffers] = useState<Array<{ id: string; designation: string; department?: string; ctcAnnual?: number; joiningDate?: string; location?: string; reportingManager?: string; candidate?: { fullName: string; email?: string } }>>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [form, setForm] = useState({
    kind: "Appointment" as DocKind,
    employeeUserId: "",
    employeeName: "",
    designation: "",
    department: "",
    candidateEmail: "",
    effectiveDate: "",
    ctcAnnual: "",
    reportingManager: "",
    location: "SPDC Corporate Office, Vadodara",
    previousDesignation: "",
    previousCtc: "",
    reason: "",
    assets: "",
    serials: "",
  });

  const load = useCallback(async () => {
    try {
      const [list, people, offersList] = await Promise.all([
        api<DocRow[]>("/api/hrm/hrms-documents", { token }),
        api<Array<{ id: string; fullName: string; email: string; profile?: any }>>("/api/hrm/employees", { token }).catch(() => []),
        api<Array<{ id: string; designation: string; department?: string; ctcAnnual?: number; joiningDate?: string; location?: string; reportingManager?: string; candidate?: { fullName: string; email?: string } }>>("/api/hrm/offers", { token }).catch(() => []),
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

  const visible = useMemo(() => (kindFilter === "all" ? rows : rows.filter((r) => r.kind === kindFilter)), [rows, kindFilter]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const body = {
        kind: form.kind,
        employeeUserId: form.employeeUserId || null,
        employeeName: form.employeeName,
        designation: form.designation,
        department: form.department,
        candidateEmail: form.candidateEmail,
        effectiveDate: form.effectiveDate || null,
        data: {
          candidateName: form.employeeName,
          joinDate: form.effectiveDate,
          fixedCtcAnnual: form.ctcAnnual,
          ctcAnnual: form.ctcAnnual,
          location: form.location,
          reportingManager: form.reportingManager,
          previousDesignation: form.previousDesignation,
          previousCtc: form.previousCtc,
          newDesignation: form.designation,
          newCtc: form.ctcAnnual,
          reason: form.reason,
          assets: form.assets,
          serials: form.serials,
        },
      };
      const created = await api<DocRow>("/api/hrm/hrms-documents", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      await api(`/api/hrm/hrms-documents/${created.id}/generate`, { method: "POST", token });
      setMsg(`${created.kind} · ${created.refNo} generated and filed under 06.02 Employee Files / ${form.employeeName}.`);
      setForm({ ...form, employeeUserId: "", employeeName: "", candidateEmail: "", effectiveDate: "", reason: "", assets: "", serials: "" });
      await load();
      await openPreview(created.id, `${created.kind} · ${created.refNo}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
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
      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-sm">HRMS letters &amp; document management</h2>
            <p className="text-[11px] text-steel-muted">
              Pick the employee (or type a name). Name, joining date, CTC and reporting manager fill the
              SPDC appointment letter. The letter plus CTC Annexure I are filed under Drive
              06.02 Employee Files / candidate name / Letters (copy also in 06.01 Letters).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-steel-muted uppercase font-mono">Filter</label>
            <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
              <option value="all">All kinds</option>
              {KIND_OPTIONS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {msg && <div className="text-xs text-brand font-medium">{msg}</div>}
      </Card>

      {canManage && (
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Issue a new letter</h3>
          <form onSubmit={create} className="grid md:grid-cols-3 gap-3 text-sm">
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
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">From accepted offer</span>
              <Select
                value=""
                onChange={(e) => {
                  const o = offers.find((x) => x.id === e.target.value);
                  if (!o) return;
                  setForm({
                    ...form,
                    kind: form.kind === "Offer" ? "Offer" : "Appointment",
                    employeeName: o.candidate?.fullName || form.employeeName,
                    candidateEmail: o.candidate?.email || form.candidateEmail,
                    designation: o.designation || form.designation,
                    department: o.department || form.department,
                    ctcAnnual: o.ctcAnnual ? String(o.ctcAnnual) : form.ctcAnnual,
                    effectiveDate: o.joiningDate ? String(o.joiningDate).slice(0, 10) : form.effectiveDate,
                    location: o.location || form.location,
                    reportingManager: o.reportingManager || form.reportingManager,
                  });
                }}
              >
                <option value="">Pick candidate offer to fill name, CTC, joining…</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.candidate?.fullName || o.id} · {o.designation}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Staff (fills the form)</span>
              <Select
                value={form.employeeUserId}
                onChange={(e) => {
                  const id = e.target.value;
                  const emp = staff.find((s) => s.id === id);
                  setForm({
                    ...form,
                    employeeUserId: id,
                    employeeName: emp?.fullName || form.employeeName,
                    candidateEmail: emp?.email || form.candidateEmail,
                    designation: emp?.profile?.designation || form.designation,
                    previousDesignation: emp?.profile?.designation || form.previousDesignation,
                    department: emp?.profile?.department || form.department,
                    ctcAnnual: emp?.profile?.ctcAnnual ? String(emp.profile.ctcAnnual) : form.ctcAnnual,
                    previousCtc: emp?.profile?.ctcAnnual ? String(emp.profile.ctcAnnual) : form.previousCtc,
                    effectiveDate: emp?.profile?.joinDate ? String(emp.profile.joinDate).slice(0, 10) : form.effectiveDate,
                  });
                }}
              >
                <option value="">Type name below, or pick staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                    {s.profile?.empCode ? ` · ${s.profile.empCode}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Employee / candidate name</span>
              <Input required value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Email (candidate)</span>
              <Input type="email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">
                {form.kind === "Promotion" ? "New designation" : "Designation"}
              </span>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Function / department</span>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">
                {form.kind === "Relieving" || form.kind === "Exit" ? "Last working day" : "Effective / joining date"}
              </span>
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
                <label className="space-y-1">
                  <span className="text-[11px] text-steel-muted uppercase font-mono">Base location</span>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
              </>
            )}
            {form.kind === "AssetReturn" && (
              <>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[11px] text-steel-muted uppercase font-mono">Assets returned</span>
                  <Input placeholder="Laptop, mobile, ID card, SIM…" value={form.assets} onChange={(e) => setForm({ ...form, assets: e.target.value })} />
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
            <div className="md:col-span-3 flex flex-wrap items-center gap-2">
              <Button type="submit">Generate &amp; file</Button>
              <span className="text-[11px] text-steel-muted">
                Ref will be auto-issued as <code>SPDC/HR/&lt;code&gt;/YY-NX/&lt;seq&gt;</code>.
              </span>
            </div>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Letters register · {visible.length}</div>
            <div className="text-[11px] text-steel-muted">Every letter carries the Sharnam logo. Download the .xlsx to edit, or print the HTML to PDF.</div>
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
              {visible.map((r) => (
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
                        Letter (HTML → PDF)
                      </a>
                    )}
                    {r.generatedDocxUrl && (
                      <a href={mediaUrl(r.generatedDocxUrl)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Editable annexure (.xlsx)
                      </a>
                    )}
                    {r.sharePointUrl && r.sharePointUrl !== r.generatedPdfUrl && (
                      <a href={mediaUrl(r.sharePointUrl)} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Drive copy
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
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-steel-muted">
                    No letters yet — issue one above.
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

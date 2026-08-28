import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../../components/ui";

/**
 * HRMS letter desk — Appointment / Relieving / Exit / Asset Return / Offer / Confirmation.
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
  { key: "Warning", label: "Warning / concern letter", hint: "Notice of concern with corrective actions" },
  { key: "Experience", label: "Experience certificate", hint: "Tenure and role certificate on request" },
];

export default function HrmsDocumentsPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [rows, setRows] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | DocKind>("all");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);

  const [form, setForm] = useState({
    kind: "Appointment" as DocKind,
    employeeName: "",
    designation: "",
    department: "",
    candidateEmail: "",
    effectiveDate: "",
    ctcAnnual: "",
    location: "SPDC Corporate Office, Vadodara",
    reason: "",
    assets: "",
    serials: "",
  });

  const load = useCallback(async () => {
    try {
      const list = await api<DocRow[]>("/api/hrm/hrms-documents", { token });
      setRows(list);
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
        employeeName: form.employeeName,
        designation: form.designation,
        department: form.department,
        candidateEmail: form.candidateEmail,
        effectiveDate: form.effectiveDate || null,
        data: {
          ctcAnnual: form.ctcAnnual,
          location: form.location,
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
      setMsg(`${created.kind} · ${created.refNo} generated and filed under 06.01 Letters.`);
      setForm({ ...form, employeeName: "", candidateEmail: "", effectiveDate: "", reason: "", assets: "", serials: "" });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
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
              Fill the form → we generate a Sharnam-branded HTML letter (print → Save as PDF) plus an
              editable .xlsx companion. Every artefact is filed under 06.01 Letters and surfaces on
              SharePoint. Format files live in <code>apps/api/formats/hrms/&lt;Kind&gt;.html</code>; drop
              your real letterhead there any time and the next generation will use it.
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
              <span className="text-[11px] text-steel-muted uppercase font-mono">Employee / candidate</span>
              <Input required value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Email (candidate)</span>
              <Input type="email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-steel-muted uppercase font-mono">Designation</span>
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
            {(form.kind === "Appointment" || form.kind === "Offer") && (
              <>
                <label className="space-y-1">
                  <span className="text-[11px] text-steel-muted uppercase font-mono">Fixed CTC (INR p.a.)</span>
                  <Input value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: e.target.value })} />
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
                      <a href={r.generatedPdfUrl} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Letter (HTML → PDF)
                      </a>
                    )}
                    {r.generatedDocxUrl && (
                      <a href={r.generatedDocxUrl} target="_blank" rel="noreferrer" className="text-brand underline block text-[11px]">
                        Editable annexure (.xlsx)
                      </a>
                    )}
                    {r.uploadedFileUrl && (
                      <a href={r.uploadedFileUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline block text-[11px]">
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

      <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={onUploadFile} />
    </div>
  );
}

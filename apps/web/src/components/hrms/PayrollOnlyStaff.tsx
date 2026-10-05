import { useState } from "react";
import { api } from "../../api";
import { Badge, Button, Card, Input, Select } from "../ui";

const BLANK = {
  fullName: "",
  empCode: "",
  designation: "",
  department: "",
  joinDate: "",
  ctcAnnual: "",
  basicMonthly: "",
  hraMonthly: "",
  panNumber: "",
  uanNumber: "",
  bankName: "",
  bankAccountNo: "",
  bankIfsc: "",
  phone: "",
  email: "",
  gender: "",
};

/**
 * HRMS · Payroll — people paid through payroll who are not onboarded on the portal.
 * They get payslips like everyone else; their login stays disabled.
 */
export function PayrollOnlyStaff({
  staff,
  token,
  canWrite,
  onChanged,
  setMsg,
}: {
  staff: any[];
  token: string;
  canWrite: boolean;
  onChanged: () => Promise<void> | void;
  setMsg: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(p: any) {
    const pr = p.profile || {};
    setEditId(p.id);
    setOpen(true);
    setForm({
      fullName: p.fullName || "",
      empCode: pr.empCode || "",
      designation: pr.designation || "",
      department: pr.department || "",
      joinDate: pr.joinDate ? String(pr.joinDate).slice(0, 10) : "",
      ctcAnnual: pr.ctcAnnual != null ? String(pr.ctcAnnual) : "",
      basicMonthly: pr.basicMonthly != null ? String(pr.basicMonthly) : "",
      hraMonthly: pr.hraMonthly != null ? String(pr.hraMonthly) : "",
      panNumber: pr.panNumber || "",
      uanNumber: pr.uanNumber || "",
      bankName: pr.bankName || "",
      bankAccountNo: pr.bankAccountNo || "",
      bankIfsc: pr.bankIfsc || "",
      phone: p.phone || "",
      email: p.email?.endsWith("@no-login.spdc.in") ? "" : p.email || "",
      gender: pr.gender || "",
    });
  }

  async function save() {
    if (!form.fullName.trim()) return setMsg("Enter the person's name.");
    if (!form.ctcAnnual && !form.basicMonthly) return setMsg("Enter the CTC (or a monthly basic) so the payslip can be worked out.");
    setBusy(true);
    try {
      if (editId) await api(`/api/hrm/payroll-staff/${editId}`, { method: "PUT", token, body: JSON.stringify(form) });
      else await api("/api/hrm/payroll-staff", { method: "POST", token, body: JSON.stringify(form) });
      setMsg(`${form.fullName} ${editId ? "updated" : "added to payroll"}. Generate their payslip below.`);
      setForm(BLANK);
      setEditId(null);
      setOpen(false);
      await onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: any) {
    if (!window.confirm(`Remove ${p.fullName} from payroll-only staff?`)) return;
    try {
      await api(`/api/hrm/payroll-staff/${p.id}`, { method: "DELETE", token });
      setMsg(`${p.fullName} removed.`);
      await onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not remove");
    }
  }

  const F = (k: keyof typeof BLANK, label: string, extra: Record<string, unknown> = {}) => (
    <Input label={label} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
  );

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Staff Not On The Portal</h3>
          <p className="text-[11px] text-steel-muted">
            Add people you pay who don't use the portal (no login). They appear in Generate one / Generate all; every payslip can still be edited after it is generated.
          </p>
        </div>
        {canWrite && !open && (
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => { setForm(BLANK); setEditId(null); setOpen(true); }}>
            + Add person to payroll
          </Button>
        )}
      </div>

      {open && canWrite && (
        <div className="rounded-lg border border-line bg-sand/20 p-3 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {F("fullName", "Full name *")}
            {F("empCode", "Emp code", { placeholder: "Auto if blank" })}
            {F("designation", "Designation")}
            {F("department", "Department")}
            {F("joinDate", "Joining date", { type: "date" })}
            {F("ctcAnnual", "CTC per annum (₹)", { type: "number" })}
            {F("basicMonthly", "Basic per month (₹, optional)", { type: "number", placeholder: "From CTC if blank" })}
            {F("hraMonthly", "HRA per month (₹, optional)", { type: "number", placeholder: "From CTC if blank" })}
            {F("panNumber", "PAN")}
            {F("uanNumber", "UAN / PF no.")}
            {F("bankName", "Bank")}
            {F("bankAccountNo", "Account no.")}
            {F("bankIfsc", "IFSC")}
            {F("phone", "Mobile")}
            {F("email", "Email (optional)")}
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Not specified</option>
              <option>Male</option>
              <option>Female</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editId ? "Save changes" : "Add to payroll"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEditId(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {staff.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="text-left text-steel-muted">
              <tr>
                <th className="p-2">Name</th>
                <th>Emp code</th>
                <th>Designation</th>
                <th className="text-right">CTC p.a.</th>
                <th>Bank</th>
                <th className="pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="p-2">
                    {p.fullName} <Badge tone="neutral">No portal login</Badge>
                  </td>
                  <td>{p.profile?.empCode}</td>
                  <td>{p.profile?.designation || "—"}</td>
                  <td className="text-right">{p.profile?.ctcAnnual ? `₹ ${Number(p.profile.ctcAnnual).toLocaleString("en-IN")}` : "—"}</td>
                  <td>{p.profile?.bankName ? `${p.profile.bankName} · ${String(p.profile.bankAccountNo || "").slice(-4)}` : "—"}</td>
                  <td className="pr-2 text-right whitespace-nowrap">
                    {canWrite && (
                      <>
                        <button type="button" className="text-brand font-semibold mr-3 cursor-pointer" onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button type="button" className="text-danger font-semibold cursor-pointer" onClick={() => void remove(p)}>
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-steel-muted">No payroll-only staff yet.</p>
      )}
    </Card>
  );
}

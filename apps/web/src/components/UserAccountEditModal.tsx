import { useEffect, useState } from "react";
import { api } from "../api";
import {
  portalAccountKind,
  roleFromAccountKind,
  type PortalAccountForm,
  type PortalAccountKind,
} from "../lib/portalAccounts";
import { PortalAccountFields } from "./PortalAccountFields";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Button, Input } from "./ui";

export type UserAccountRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  portal?: string | null;
  phone?: string | null;
  vendorId?: string | null;
  vendor?: { id: string; name: string; trade?: string | null; partyType?: string | null } | null;
  isActive?: boolean;
  profile?: {
    empCode?: string;
    department?: string | null;
    designation?: string | null;
    ctcAnnual?: number | null;
    basicMonthly?: number | null;
    hraMonthly?: number | null;
  } | null;
  memberships?: { id: string; project: { id: string; code: string; name: string }; role?: string }[];
};

type Props = {
  open: boolean;
  user: UserAccountRow | null;
  token: string | null;
  isAdmin: boolean;
  /** HRMS staff desk — keep the staff form even when role is employee. */
  forceKind?: PortalAccountKind;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
};

function formFromUser(user: UserAccountRow): PortalAccountForm {
  return {
    fullName: user.fullName || "",
    email: user.email || "",
    role: user.role || "site_employee",
    phone: user.phone || "",
    empCode: user.profile?.empCode || "",
    department: user.profile?.department || "",
    designation: user.profile?.designation || "",
    password: "",
    isActive: user.isActive !== false,
  };
}

export function UserAccountEditModal({
  open,
  user,
  token,
  isAdmin,
  forceKind,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [form, setForm] = useState<PortalAccountForm>(formFromUser(user || ({} as UserAccountRow)));
  const [payroll, setPayroll] = useState({ ctcAnnual: "", basicMonthly: "", hraMonthly: "" });
  const [kind, setKind] = useState<PortalAccountKind>("staff");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    const nextKind = forceKind || portalAccountKind(user.role, user.profile, user.vendorId);
    setKind(nextKind);
    setForm(formFromUser(user));
    setPayroll({
      ctcAnnual: user.profile?.ctcAnnual ? String(user.profile.ctcAnnual) : "",
      basicMonthly: user.profile?.basicMonthly ? String(user.profile.basicMonthly) : "",
      hraMonthly: user.profile?.hraMonthly ? String(user.profile.hraMonthly) : "",
    });
    setErr("");
  }, [user, forceKind]);

  async function save() {
    if (!user || !token) return;
    setBusy(true);
    setErr("");
    try {
      const role = roleFromAccountKind(kind, form.role);
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        role,
        phone: form.phone,
        designation: form.designation,
      };
      if (kind === "staff") {
        body.empCode = form.empCode;
        body.department = form.department;
        if (payroll.ctcAnnual) body.ctcAnnual = payroll.ctcAnnual;
        if (payroll.basicMonthly) body.basicMonthly = payroll.basicMonthly;
        if (payroll.hraMonthly) body.hraMonthly = payroll.hraMonthly;
      } else if (kind === "stakeholder") {
        body.department = form.department;
      }
      if (form.password.trim()) body.password = form.password;
      body.isActive = form.isActive;
      await api(`/api/hrm/employees/${user.id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user || !token) return;
    if (!window.confirm(`Remove ${user.fullName}? They will lose portal access and project assignments.`)) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/hrm/employees/${user.id}`, { method: "DELETE", token });
      await onDeleted?.();
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMembership(projectId: string) {
    if (!user || !token) return;
    setBusy(true);
    setErr("");
    try {
      await api("/api/hrm/assign", {
        method: "DELETE",
        token,
        body: JSON.stringify({ projectId, userId: user.id }),
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove project");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const titleKind =
    kind === "client"
      ? "Edit client"
      : kind === "vendor"
        ? "Edit vendor / contractor"
        : kind === "stakeholder"
          ? "Edit consultant / stakeholder"
          : "Edit staff";

  return (
    <RegisterEntryModal
      open={open}
      title={`${titleKind} — ${user.fullName}`}
      onClose={onClose}
      onSave={() => void save()}
      saving={busy}
      saveLabel="Save changes"
      size="lg"
    >
      <div className="space-y-4">
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <PortalAccountFields
          form={form}
          onChange={setForm}
          kind={kind}
          onKindChange={setKind}
          allowKindSwitch={!forceKind}
          allowAdminRole={isAdmin}
          showActive
          passwordOptional
          token={token}
          externalOnly={forceKind === "client" || forceKind === "vendor" || forceKind === "stakeholder"}
        />

        {(kind === "staff" || forceKind === "staff") && (
          <div className="border-t border-line pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-steel-muted">Payroll · SPDC CTC split</p>
            <p className="text-[11px] text-steel-muted leading-relaxed">
              Used for payslip generation (see SPDC CTC calculator). Leave blank until offer is accepted or hike is applied.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="CTC annual (₹)"
                value={payroll.ctcAnnual}
                onChange={(e) => setPayroll({ ...payroll, ctcAnnual: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Basic monthly (₹)"
                value={payroll.basicMonthly}
                onChange={(e) => setPayroll({ ...payroll, basicMonthly: e.target.value })}
              />
              <Input
                type="number"
                placeholder="HRA monthly (₹)"
                value={payroll.hraMonthly}
                onChange={(e) => setPayroll({ ...payroll, hraMonthly: e.target.value })}
              />
            </div>
          </div>
        )}

        {user.memberships?.length ? (
          <div className="border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-steel-muted mb-2">Project assignments</p>
            <ul className="space-y-2 text-sm">
              {user.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>
                    {m.project.code} — {m.project.name}
                  </span>
                  <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" disabled={busy} onClick={() => void removeMembership(m.project.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-steel-muted border-t border-line pt-3">
            No project yet — assign from Projects → Directory so this login can open the job.
          </p>
        )}

        <div className="border-t border-line pt-3 space-y-2">
          <p className="text-xs text-amber-800 font-semibold">
            Only office and admin can delete a user. Live SPDC / Twinoxis logins cannot be removed.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" className="!text-danger !border-danger/30" disabled={busy} onClick={() => void remove()}>
              Delete user
            </Button>
          </div>
        </div>
      </div>
    </RegisterEntryModal>
  );
}

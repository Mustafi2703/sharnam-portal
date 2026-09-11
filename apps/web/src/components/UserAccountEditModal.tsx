import { useEffect, useState } from "react";
import { api } from "../api";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Button, Input, Select } from "./ui";

export type UserAccountRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  portal?: string | null;
  phone?: string | null;
  isActive?: boolean;
  profile?: { empCode?: string; department?: string | null; designation?: string | null } | null;
  memberships?: { id: string; project: { id: string; code: string; name: string }; role?: string }[];
};

const LOGIN_ROLES = ["site_employee", "office", "employee", "vendor", "client", "admin"] as const;

type Props = {
  open: boolean;
  user: UserAccountRow | null;
  token: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
};

export function UserAccountEditModal({ open, user, token, isAdmin, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    empCode: "",
    department: "",
    designation: "",
    password: "",
    isActive: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || "",
      email: user.email || "",
      role: user.role || "site_employee",
      phone: user.phone || "",
      empCode: user.profile?.empCode || "",
      department: user.profile?.department || "",
      designation: user.profile?.designation || "",
      password: "",
      isActive: user.isActive !== false,
    });
    setErr("");
  }, [user]);

  async function save() {
    if (!user || !token) return;
    setBusy(true);
    setErr("");
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        phone: form.phone,
        empCode: form.empCode,
        department: form.department,
        designation: form.designation,
      };
      if (form.password.trim()) body.password = form.password;
      if (isAdmin) body.isActive = form.isActive;
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

  return (
    <RegisterEntryModal
      open={open}
      title={`Edit — ${user.fullName}`}
      onClose={onClose}
      onSave={() => void save()}
      saving={busy}
      saveLabel="Save changes"
      size="lg"
    >
      <div className="space-y-4">
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input required value={form.fullName} onChange={(ev) => setForm({ ...form, fullName: ev.target.value })} placeholder="Full name" />
          <Input required type="email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} placeholder="Login email" />
          <Select value={form.role} onChange={(ev) => setForm({ ...form, role: ev.target.value })}>
            {LOGIN_ROLES.map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
          <Input value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} placeholder="Phone" />
          <Input value={form.empCode} onChange={(ev) => setForm({ ...form, empCode: ev.target.value })} placeholder="Emp code" />
          <Input value={form.department} onChange={(ev) => setForm({ ...form, department: ev.target.value })} placeholder="Department" />
          <Input value={form.designation} onChange={(ev) => setForm({ ...form, designation: ev.target.value })} placeholder="Designation" />
          <Input type="password" value={form.password} onChange={(ev) => setForm({ ...form, password: ev.target.value })} placeholder="New password (optional)" />
          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(ev) => setForm({ ...form, isActive: ev.target.checked })} />
              Active login
            </label>
          ) : null}
        </div>

        {user.memberships?.length ? (
          <div className="border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-steel-muted mb-2">Project assignments</p>
            <ul className="space-y-2 text-sm">
              {user.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.project.code} — {m.project.name}</span>
                  <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" disabled={busy} onClick={() => void removeMembership(m.project.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-t border-line pt-3 flex justify-end">
          <Button type="button" variant="secondary" className="!text-danger !border-danger/30" disabled={busy} onClick={() => void remove()}>
            Delete user
          </Button>
        </div>
      </div>
    </RegisterEntryModal>
  );
}

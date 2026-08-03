import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { MODULES, type ModuleKey, type PermissionAction } from "@sharnam/shared";
import { Badge, Button, Card, Input, PageHero, Select } from "../components/ui";
import { WORKSPACES } from "../workspaces";
import {
  downloadCsv,
  USER_CSV_DETAILED_SAMPLE,
  USER_CSV_HEADERS,
} from "../lib/csvTemplates";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve"];
const LOGIN_ROLES = ["office", "site_employee", "employee", "vendor", "client", "admin"] as const;

/** Office / Admin — users with login + role access matrix */
export default function RolesPage() {
  const { token, user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  const [msg, setMsg] = useState("");
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    password: "Demo@1234",
    empCode: "",
    department: "",
    designation: "",
  });
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "office";
  if (!canManage) return <Navigate to="/dashboard" replace />;

  const load = async () => {
    const [r, u] = await Promise.all([
      api<any[]>("/api/roles", { token }),
      api<any[]>("/api/users", { token }),
    ]);
    setRoles(r);
    setUsers(u);
  };

  useEffect(() => {
    void load();
  }, [token]);

  const role = roles.find((r) => r.key === selected);

  async function saveRole() {
    if (!role) return;
    setMsg("");
    try {
      await api(`/api/roles/${role.key}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ permissions: role.permissions }),
      });
      setMsg(`Saved access for ${role.label}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function createLoginUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify(userForm),
      });
      setMsg(`Login created for ${userForm.email} · portal role ${userForm.role}`);
      setUserForm({
        fullName: "",
        email: "",
        role: "site_employee",
        phone: "",
        password: "Demo@1234",
        empCode: "",
        department: "",
        designation: "",
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: any) {
    if (user?.role !== "admin") {
      setMsg("Only admin can activate / deactivate logins");
      return;
    }
    try {
      await api(`/api/users/${u.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      setMsg(`${u.fullName} is now ${u.isActive ? "inactive" : "active"}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHero
        title="Access & users"
        subtitle="Create portal logins, manage who can sign in, and allocate module permissions per role."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/hrm">
              <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary">
                HRMS directory
              </Button>
            </Link>
            <Link to="/master">
              <Button type="button" className="!bg-[var(--color-mark)] !border-[var(--color-mark)]">
                Master toggles →
              </Button>
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm text-ok bg-sand border border-line px-3 py-2 rounded-lg">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h2 className="font-display text-lg text-ink">Add user with login</h2>
          <p className="text-sm text-steel-muted">
            Creates an account that can sign in on the matching portal. Default password can be changed below.
          </p>
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={createLoginUser}>
            <Input
              required
              placeholder="Full name"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
            />
            <Input
              required
              type="email"
              placeholder="Login email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
            <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              {LOGIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input
              type="text"
              placeholder="Password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={userForm.phone}
              onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
            />
            <Input
              placeholder="Emp code"
              value={userForm.empCode}
              onChange={(e) => setUserForm({ ...userForm, empCode: e.target.value })}
            />
            <Input
              placeholder="Department"
              value={userForm.department}
              onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
            />
            <Input
              placeholder="Designation"
              value={userForm.designation}
              onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2" disabled={busy}>
              {busy ? "Creating…" : "Create user & login"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadCsv("users-empty.csv", [...USER_CSV_HEADERS], [])}
            >
              Empty users CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadCsv("users-detailed.csv", [...USER_CSV_HEADERS], USER_CSV_DETAILED_SAMPLE)}
            >
              Detailed sample CSV
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink">Users & logins</h2>
            <Badge tone="neutral">{users.length} accounts</Badge>
          </div>
          <ul className="divide-y divide-line max-h-[420px] overflow-y-auto text-sm">
            {users.map((u) => (
              <li key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{u.fullName}</div>
                  <div className="text-xs text-steel-muted truncate">
                    {u.email} · {u.role} · portal {u.portal || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={u.isActive ? "ok" : "warn"}>{u.isActive ? "Active" : "Off"}</Badge>
                  {user?.role === "admin" && (
                    <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => void toggleActive(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {!users.length && <li className="py-6 text-steel-muted">No users yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelected(r.key)}
            className={`text-left rounded-xl border p-4 transition ${
              selected === r.key ? "border-[var(--color-mark)] bg-sand shadow-sm" : "border-line bg-paper hover:border-[#c45c26]/40"
            }`}
          >
            <div className="font-display text-lg text-ink">{r.label}</div>
            <div className="text-xs font-mono text-steel-muted mt-1">{r.key}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              <Badge tone="brand">{r.portal}</Badge>
              <Badge tone="neutral">{users.filter((u) => u.role === r.key).length} users</Badge>
            </div>
          </button>
        ))}
      </div>

      {role && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-ink">{role.label} permissions</h2>
              <p className="text-sm text-steel-muted mt-1">Toggle view / create / edit / approve per module.</p>
            </div>
            <Button type="button" onClick={() => void saveRole()}>
              Save access
            </Button>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
              Portal modules (reference)
            </h3>
            <div className="flex flex-wrap gap-2">
              {WORKSPACES.map((w) => (
                <span
                  key={w.key}
                  className="rounded-lg border border-line bg-sand px-3 py-1.5 text-xs font-semibold text-ink"
                  style={{ borderLeftWidth: 3, borderLeftColor: w.accent }}
                >
                  {w.title}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-sand text-left text-ink">
                <tr>
                  <th className="p-3">Module</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="p-3 capitalize">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m} className="border-t border-line">
                    <td className="p-3 font-medium text-ink">{m}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-mark)]"
                          checked={!!role.permissions?.[m]?.[a]}
                          onChange={(e) => {
                            const next = {
                              ...role.permissions,
                              [m as ModuleKey]: {
                                ...role.permissions[m],
                                [a]: e.target.checked,
                              },
                            };
                            setRoles(roles.map((row) => (row.key === role.key ? { ...row, permissions: next } : row)));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

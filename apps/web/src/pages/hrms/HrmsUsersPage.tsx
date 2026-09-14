import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { UserAccountEditModal, type UserAccountRow } from "../../components/UserAccountEditModal";
import { UserManageActions } from "../../components/UserManageActions";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { Badge, Button, Card, Input, Select } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ActionReasonDialog, actionReasonFromError, type ActionReason } from "../../components/ActionReasonDialog";
import { downloadCsv, USER_CSV_DETAILED_SAMPLE, USER_CSV_HEADERS } from "../../lib/csvTemplates";

const LOGIN_ROLES = [
  { value: "site_employee", label: "SPDC site — /login/site" },
  { value: "office", label: "SPDC office — /login/office" },
] as const;

const EMPTY_USER_FORM = {
  fullName: "",
  email: "",
  role: "site_employee",
  phone: "",
  empCode: "",
  department: "Site",
  designation: "",
  password: "Demo@1234",
  desk: "hrm",
};

function AddUserModal({
  open,
  token,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onCreated: (email: string) => Promise<void>;
  onError: (reason: ActionReason) => void;
}) {
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [busy, setBusy] = useState(false);

  async function createUser() {
    setBusy(true);
    try {
      await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(form) });
      const email = form.email;
      setForm(EMPTY_USER_FORM);
      await onCreated(email);
    } catch (err) {
      onError(actionReasonFromError("Could not create login", err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <RegisterEntryModal
      open={open}
      title="Add user with login"
      onClose={onClose}
      onSave={() => void createUser()}
      saving={busy}
      saveLabel="Create login"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Input required placeholder="Full name" value={form.fullName} onChange={(ev) => setForm({ ...form, fullName: ev.target.value })} />
        <Input required type="email" placeholder="Login email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
        <Select value={form.role} onChange={(ev) => setForm({ ...form, role: ev.target.value })}>
          {LOGIN_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Input placeholder="Password" value={form.password} onChange={(ev) => setForm({ ...form, password: ev.target.value })} />
        <Input placeholder="Phone" value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} />
        <Input placeholder="Emp code" value={form.empCode} onChange={(ev) => setForm({ ...form, empCode: ev.target.value })} />
        <Input placeholder="Department" value={form.department} onChange={(ev) => setForm({ ...form, department: ev.target.value })} />
        <Input placeholder="Designation" value={form.designation} onChange={(ev) => setForm({ ...form, designation: ev.target.value })} />
      </div>
    </RegisterEntryModal>
  );
}

/** HRMS user management — office admin only. */
export default function HrmsUsersPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "office";
  const [employees, setEmployees] = useState<UserAccountRow[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [actionError, setActionError] = useState<ActionReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);
  const [userQ, setUserQ] = useState("");
  const [assign, setAssign] = useState({ userId: "", projectId: "", role: "site_employee" });
  const deferredUserQ = useDeferredValue(userQ);

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      api<UserAccountRow[]>("/api/hrm/employees", { token }).catch((err) => {
        setMsgTone("err");
        setMsg(err instanceof Error ? err.message : "Could not load staff");
        return [];
      }),
      api<any[]>("/api/projects", { token }).catch(() => []),
    ]);
    setEmployees(e);
    setProjects(p);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const shownEmployees = useMemo(() => {
    const needle = deferredUserQ.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((e) =>
      `${e.fullName} ${e.email} ${e.role} ${e.profile?.department || ""} ${e.profile?.empCode || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [employees, deferredUserQ]);

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: emp.id,
        label: emp.fullName,
        sublabel: `${emp.email || ""} · ${emp.role}`,
        keywords: `${emp.fullName} ${emp.email || ""} ${emp.role} ${emp.phone || ""} ${emp.profile?.empCode || ""}`,
      })),
    [employees]
  );
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: `${p.code} — ${p.name}`,
        sublabel: p.clientName || undefined,
        keywords: `${p.code} ${p.name} ${p.clientName || ""}`,
      })),
    [projects]
  );

  async function assignProject() {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/assign", { method: "POST", token, body: JSON.stringify(assign) });
      setMsgTone("ok");
      setMsg("Employee added to project directory.");
      setAssignOpen(false);
      setAssign({ userId: "", projectId: "", role: "site_employee" });
      await load();
    } catch (err) {
      const reason = actionReasonFromError("Could not assign to project", err);
      setActionError(reason);
      setMsgTone("err");
      setMsg(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel-muted max-w-2xl">
          Staff logins only — office and site. Client, consultant, and vendor accounts stay in CRM directories. Role permissions stay in Office → Access.
          <span className="block mt-1 font-semibold text-warn">
            Only office and admin can add or delete users. Live SPDC / Twinoxis logins stay protected.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button type="button" onClick={() => setModalOpen(true)}>+ Add user</Button>
          ) : (
            <span className="text-xs text-warn self-center">Ask office or admin to add a user.</span>
          )}
          {canEdit ? (
            <Button type="button" variant="secondary" onClick={() => setAssignOpen(true)}>Assign to project</Button>
          ) : null}
          <Link to="/roles" className="text-sm font-semibold text-brand self-center px-2">Role matrix ↗</Link>
        </div>
      </div>

      {msg ? (
        <p
          className={
            msgTone === "err"
              ? "text-sm rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]"
              : "text-sm text-ok bg-brand-soft/40 border border-brand/20 px-3 py-2 rounded-lg"
          }
        >
          {msg}
        </p>
      ) : null}
      <ActionReasonDialog reason={actionError} onClose={() => setActionError(null)} />

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">Users ({shownEmployees.length}{userQ.trim() ? ` / ${employees.length}` : ""})</span>
          <div className="flex flex-wrap gap-2">
            <Input
              className="!w-56"
              placeholder="Search users by name…"
              value={userQ}
              onChange={(ev) => setUserQ(ev.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => downloadCsv("users-empty.csv", [...USER_CSV_HEADERS], [])}>
              Empty CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadCsv("users-detailed.csv", [...USER_CSV_HEADERS], USER_CSV_DETAILED_SAMPLE)}
            >
              Sample CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-sand/30 text-left text-xs uppercase tracking-wide text-steel-muted">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Dept</th>
                <th className="px-4 py-2 font-semibold">Projects</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                {canEdit ? <th className="px-4 py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shownEmployees.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-sand/20">
                  <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                  <td className="px-4 py-2.5 text-steel-muted">{e.email}</td>
                  <td className="px-4 py-2.5 capitalize">{e.role?.replace("_", " ")}</td>
                  <td className="px-4 py-2.5">{e.profile?.department || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(e.memberships || []).slice(0, 3).map((m) => (
                        <Link
                          key={m.id}
                          to={`/projects/${m.project.id}/directory`}
                          className="text-[10px] font-mono text-brand bg-brand-soft px-1.5 py-0.5 rounded"
                        >
                          {m.project.code}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.isActive !== false ? "ok" : "warn"}>{e.isActive !== false ? "Active" : "Inactive"}</Badge>
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5">
                      <UserManageActions
                        user={e}
                        token={token}
                        onEdit={() => setEditUser(e)}
                        onChanged={async () => {
                          setMsgTone("ok");
                          setMsg("User list updated.");
                          await load();
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <UserAccountEditModal
        open={!!editUser}
        user={editUser}
        token={token}
        isAdmin={!!isAdmin}
        forceKind="staff"
        onClose={() => setEditUser(null)}
        onSaved={async () => {
          setMsgTone("ok");
          setMsg("User updated.");
          await load();
        }}
        onDeleted={async () => {
          setMsgTone("ok");
          setMsg("User removed.");
          await load();
        }}
      />

      <AddUserModal
        open={modalOpen}
        token={token}
        onClose={() => setModalOpen(false)}
        onCreated={async (email) => {
          setMsgTone("ok");
          setMsg(`Login created for ${email}`);
          setModalOpen(false);
          await load();
        }}
        onError={(reason) => {
          setActionError(reason);
          setMsgTone("err");
          setMsg(reason.message);
        }}
      />

      <RegisterEntryModal
        open={assignOpen}
        title="Assign employee to project"
        onClose={() => setAssignOpen(false)}
        onSave={() => void assignProject()}
        saving={busy}
        saveLabel="Assign"
        size="lg"
      >
        <div className="space-y-3">
          <SearchableSelect
            required
            options={employeeOptions}
            value={assign.userId}
            onChange={(userId) => setAssign({ ...assign, userId })}
            placeholder="Employee"
            searchPlaceholder="Search employee by name or email…"
          />
          <SearchableSelect
            required
            options={projectOptions}
            value={assign.projectId}
            onChange={(projectId) => setAssign({ ...assign, projectId })}
            placeholder="Project"
            searchPlaceholder="Search project by name or code…"
          />
          <Select value={assign.role} onChange={(ev) => setAssign({ ...assign, role: ev.target.value })}>
            {["site_employee", "office", "project_manager"].map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
        </div>
      </RegisterEntryModal>
    </div>
  );
}

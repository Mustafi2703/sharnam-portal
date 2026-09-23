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
import { isHiddenPortalListUser } from "../../lib/portalUserLists";
import { canManageHrms } from "../../lib/portalAccounts";
import { spdcCompanyRoleOptions, suggestedLoginRoleForCompanyRole } from "@sharnam/shared";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  office: "Office",
  hr: "HR",
  site_employee: "Site employee",
  employee: "Employee",
  client: "Client",
  vendor: "Vendor",
};

const LOGIN_ROLES = [
  { value: "site_employee", label: "SPDC site — /login/site" },
  { value: "office", label: "SPDC office — /login/office" },
  { value: "hr", label: "HR — /login/hr" },
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

function money(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function hasPayrollSetup(row: UserAccountRow) {
  return Boolean(row.profile?.ctcAnnual || row.profile?.basicMonthly);
}

function AddUserModal({
  open,
  token,
  departments,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  token: string | null;
  departments: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: (email: string) => Promise<void>;
  onError: (reason: ActionReason) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_USER_FORM, ctcAnnual: "", basicMonthly: "", hraMonthly: "" });
  const [busy, setBusy] = useState(false);

  async function createUser() {
    setBusy(true);
    try {
      await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(form) });
      const email = form.email;
      setForm({ ...EMPTY_USER_FORM, ctcAnnual: "", basicMonthly: "", hraMonthly: "" });
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
        <Select value={form.department} onChange={(ev) => setForm({ ...form, department: ev.target.value })}>
          <option value="">Department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={form.designation}
          onChange={(ev) => {
            const designation = ev.target.value;
            setForm({
              ...form,
              designation,
              role: suggestedLoginRoleForCompanyRole(designation),
            });
          }}
        >
          <option value="">Company role</option>
          {spdcCompanyRoleOptions(form.designation ? [form.designation] : []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Input type="number" placeholder="CTC annual (₹)" value={form.ctcAnnual} onChange={(ev) => setForm({ ...form, ctcAnnual: ev.target.value })} />
        <Input type="number" placeholder="Basic monthly (₹)" value={form.basicMonthly} onChange={(ev) => setForm({ ...form, basicMonthly: ev.target.value })} />
        <Input type="number" placeholder="HRA monthly (₹)" value={form.hraMonthly} onChange={(ev) => setForm({ ...form, hraMonthly: ev.target.value })} />
      </div>
    </RegisterEntryModal>
  );
}

/** HRMS user management — office admin only. */
export default function HrmsUsersPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEdit = canManageHrms(user);
  const [employees, setEmployees] = useState<UserAccountRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [actionError, setActionError] = useState<ActionReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);
  const [userQ, setUserQ] = useState("");
  const [payrollFilter, setPayrollFilter] = useState<"all" | "ready" | "missing">("all");
  const [assign, setAssign] = useState({ userId: "", projectId: "", role: "site_employee" });
  const deferredUserQ = useDeferredValue(userQ);

  const load = useCallback(async () => {
    const [e, p, d] = await Promise.all([
      api<UserAccountRow[]>("/api/hrm/employees", { token }).catch((err) => {
        setMsgTone("err");
        setMsg(err instanceof Error ? err.message : "Could not load staff");
        return [];
      }),
      api<any[]>("/api/projects", { token }).catch(() => []),
      api<Array<{ id: string; name: string }>>("/api/hrm/departments", { token }).catch(() => []),
    ]);
    setEmployees(e);
    setProjects(p);
    setDepartments(d.map((row) => ({ id: row.id || row.name, name: row.name })));
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const shownEmployees = useMemo(() => {
    const needle = deferredUserQ.trim().toLowerCase();
    return employees.filter((e) => {
      if (isHiddenPortalListUser(e.email)) return false;
      if (payrollFilter === "ready" && !hasPayrollSetup(e)) return false;
      if (payrollFilter === "missing" && hasPayrollSetup(e)) return false;
      if (!needle) return true;
      return `${e.fullName} ${e.email} ${e.role} ${e.profile?.department || ""} ${e.profile?.empCode || ""} ${e.profile?.designation || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [employees, deferredUserQ, payrollFilter]);

  const payrollStats = useMemo(() => {
    const ready = employees.filter(hasPayrollSetup).length;
    return { ready, missing: employees.length - ready, total: employees.length };
  }, [employees]);

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

  async function removeAssignment(userId: string, projectId: string, code: string, name: string) {
    if (!window.confirm(`Remove ${name} from ${code}? They lose that project's desk until you assign them again.`)) return;
    setBusy(true);
    try {
      await api("/api/hrm/assign", { method: "DELETE", token, body: JSON.stringify({ userId, projectId }) });
      setMsgTone("ok");
      setMsg(`${name} removed from ${code}.`);
      await load();
    } catch (err) {
      const reason = actionReasonFromError("Could not remove from project", err);
      setActionError(reason);
      setMsgTone("err");
      setMsg(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearAllAssignments() {
    if (
      !window.confirm(
        "Remove every staff member from every project? Admin logins stay. Use this once to clear the demo seed assignments, then assign people project by project."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await api<{ removed: number }>("/api/hrm/assign/clear-all", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setMsgTone("ok");
      setMsg(`${res.removed} seeded project assignments removed. Assign people with "Assign to project".`);
      await load();
    } catch (err) {
      const reason = actionReasonFromError("Could not clear assignments", err);
      setActionError(reason);
      setMsgTone("err");
      setMsg(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function purgeUatLogins() {
    if (
      !window.confirm(
        "Remove demo seed logins (@sharnam.demo etc.) and Twinoxis test logins (@twinoxis.com)? @spdc.in production staff stay."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await api<{ removed: number; emails: string[] }>("/api/hrm/employees/purge-uat-logins", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setMsgTone("ok");
      setMsg(
        res.removed
          ? `Removed ${res.removed} demo/test login${res.removed === 1 ? "" : "s"}.`
          : "No demo or test logins to remove."
      );
      await load();
    } catch (err) {
      const reason = actionReasonFromError("Could not remove demo/test logins", err);
      setActionError(reason);
      setMsgTone("err");
      setMsg(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function purgeHrmsSeed() {
    if (
      !window.confirm(
        "Remove HRMS demo seed (Riya FLOW recruitment, HB-DEMO docs, @sharnam.demo logins, demo leave rows)? @spdc.in staff stay."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await api<{
        loginsRemoved: number;
        candidates: number;
        offers: number;
        requisitions: number;
        hrmsDocuments: number;
        leaveRequests: number;
      }>("/api/hrm/purge-seed-data", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setMsgTone("ok");
      setMsg(
        `HRMS seed cleared — ${res.loginsRemoved} login(s), ${res.candidates} candidate(s), ${res.requisitions} requisition(s), ${res.hrmsDocuments} document(s).`
      );
      await load();
    } catch (err) {
      const reason = actionReasonFromError("Could not purge HRMS seed", err);
      setActionError(reason);
      setMsgTone("err");
      setMsg(reason.message);
    } finally {
      setBusy(false);
    }
  }

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
          SPDC site and office team — not clients or consultants (those stay in CRM Directory). Set portal login role, company role for letters, department, CTC, then assign projects for site access to all modules.
          <span className="block mt-1">
            <strong>{payrollStats.ready}</strong> of <strong>{payrollStats.total}</strong> have CTC on file ·{" "}
            <button type="button" className="text-brand font-semibold underline" onClick={() => setPayrollFilter("missing")}>
              {payrollStats.missing} need setup
            </button>
          </span>
          <span className="block mt-1">
            Projects are never assigned automatically. Use <strong>Assign to project</strong>, or remove a project with the × on its chip.
          </span>
          <span className="block mt-1 font-semibold text-warn">
            Only office, HR, and admin can add or delete users. <strong>@spdc.in</strong> production logins stay protected.
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
          {canEdit ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void purgeUatLogins()}>
              Remove demo &amp; test logins
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void purgeHrmsSeed()}>
              Clear HRMS seed
            </Button>
          ) : null}
          {isAdmin ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void clearAllAssignments()}>
              Clear seeded assignments
            </Button>
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
            <Select className="!w-40" value={payrollFilter} onChange={(ev) => setPayrollFilter(ev.target.value as typeof payrollFilter)}>
              <option value="all">All staff</option>
              <option value="missing">Missing CTC</option>
              <option value="ready">Payroll ready</option>
            </Select>
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
                <th className="px-4 py-2 font-semibold">Emp code</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Dept</th>
                <th className="px-4 py-2 font-semibold">Designation</th>
                <th className="px-4 py-2 font-semibold">CTC / yr</th>
                <th className="px-4 py-2 font-semibold">Payroll</th>
                <th className="px-4 py-2 font-semibold">Projects</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                {canEdit ? <th className="px-4 py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shownEmployees.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-sand/20">
                  <td className="px-4 py-2.5 font-medium">
                    <div>{e.fullName}</div>
                    <div className="text-[10px] text-steel-muted font-mono">{e.email}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.profile?.empCode || "—"}</td>
                  <td className="px-4 py-2.5">{ROLE_LABELS[e.role || ""] || e.role?.replace("_", " ")}</td>
                  <td className="px-4 py-2.5">{e.profile?.department || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{e.profile?.designation || "—"}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">{money(e.profile?.ctcAnnual)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={hasPayrollSetup(e) ? "ok" : "warn"}>{hasPayrollSetup(e) ? "Ready" : "Set CTC"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[15rem]">
                      {(e.memberships || []).length === 0 ? (
                        <span className="text-[10px] text-steel-muted">Not on any project</span>
                      ) : null}
                      {(e.memberships || []).map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 text-[10px] font-mono bg-brand-soft rounded pl-1.5"
                        >
                          <Link to={`/projects/${m.project.id}/directory`} className="text-brand py-0.5">
                            {m.project.code}
                          </Link>
                          {canEdit ? (
                            <button
                              type="button"
                              title={`Remove from ${m.project.code}`}
                              disabled={busy}
                              className="px-1 py-0.5 text-steel-muted hover:text-danger disabled:opacity-50"
                              onClick={() => void removeAssignment(e.id, m.project.id, m.project.code, e.fullName)}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.isActive !== false ? "ok" : "warn"}>{e.isActive !== false ? "Active" : "Inactive"}</Badge>
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3 mb-1" onClick={() => setEditUser(e)}>
                        Setup
                      </Button>
                      <UserManageActions
                        user={e}
                        token={token}
                        showEdit={false}
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
        departments={departments}
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
            {["site_employee", "site_engineer", "office", "project_manager", "viewer"].map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
        </div>
      </RegisterEntryModal>
    </div>
  );
}

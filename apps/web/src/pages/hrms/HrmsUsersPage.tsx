import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { Badge, Button, Card, Input, Select } from "../../components/ui";
import { downloadCsv, USER_CSV_DETAILED_SAMPLE, USER_CSV_HEADERS } from "../../lib/csvTemplates";

const LOGIN_ROLES = ["site_employee", "office", "employee", "vendor", "client"] as const;

/** HRMS user management — office admin only. */
export default function HrmsUsersPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    empCode: "",
    department: "Site",
    designation: "",
    password: "Demo@1234",
  });
  const [assign, setAssign] = useState({ userId: "", projectId: "", role: "site_employee" });

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }).catch(() => []),
      api<any[]>("/api/projects", { token }).catch(() => []),
    ]);
    setEmployees(e);
    setProjects(p);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(form) });
      setMsg(`Login created for ${form.email}`);
      setForm({
        fullName: "",
        email: "",
        role: "site_employee",
        phone: "",
        empCode: "",
        department: "Site",
        designation: "",
        password: "Demo@1234",
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignProject() {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/assign", { method: "POST", token, body: JSON.stringify(assign) });
      setMsg("Employee added to project directory.");
      setAssignOpen(false);
      setAssign({ userId: "", projectId: "", role: "site_employee" });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: any) {
    if (!isAdmin) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel-muted max-w-2xl">
          Create portal logins, assign people to projects, and manage active accounts. Role permissions stay in Office → Access.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setModalOpen(true)}>+ Add user</Button>
          <Button type="button" variant="secondary" onClick={() => setAssignOpen(true)}>Assign to project</Button>
          <Link to="/roles" className="text-sm font-semibold text-brand self-center px-2">Role matrix ↗</Link>
        </div>
      </div>

      {msg && <p className="text-sm text-ok bg-brand-soft/40 border border-brand/20 px-3 py-2 rounded-lg">{msg}</p>}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">Users ({employees.length})</span>
          <div className="flex flex-wrap gap-2">
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
                {isAdmin ? <th className="px-4 py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-sand/20">
                  <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                  <td className="px-4 py-2.5 text-steel-muted">{e.email}</td>
                  <td className="px-4 py-2.5 capitalize">{e.role?.replace("_", " ")}</td>
                  <td className="px-4 py-2.5">{e.profile?.department || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(e.memberships || []).slice(0, 3).map((m: any) => (
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
                  {isAdmin ? (
                    <td className="px-4 py-2.5">
                      <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => void toggleActive(e)}>
                        {e.isActive !== false ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen}
        title="Add user with login"
        onClose={() => setModalOpen(false)}
        onSave={() => void createUser()}
        saving={busy}
        saveLabel="Create login"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input required placeholder="Full name" value={form.fullName} onChange={(ev) => setForm({ ...form, fullName: ev.target.value })} />
          <Input required type="email" placeholder="Login email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
          <Select value={form.role} onChange={(ev) => setForm({ ...form, role: ev.target.value })}>
            {LOGIN_ROLES.map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
          <Input placeholder="Password" value={form.password} onChange={(ev) => setForm({ ...form, password: ev.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} />
          <Input placeholder="Emp code" value={form.empCode} onChange={(ev) => setForm({ ...form, empCode: ev.target.value })} />
          <Input placeholder="Department" value={form.department} onChange={(ev) => setForm({ ...form, department: ev.target.value })} />
          <Input placeholder="Designation" value={form.designation} onChange={(ev) => setForm({ ...form, designation: ev.target.value })} />
        </div>
      </RegisterEntryModal>

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
          <Select required value={assign.userId} onChange={(ev) => setAssign({ ...assign, userId: ev.target.value })}>
            <option value="">Employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.role})</option>
            ))}
          </Select>
          <Select required value={assign.projectId} onChange={(ev) => setAssign({ ...assign, projectId: ev.target.value })}>
            <option value="">Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </Select>
          <Select value={assign.role} onChange={(ev) => setAssign({ ...assign, role: ev.target.value })}>
            {["site_employee", "office", "employee", "vendor", "project_manager"].map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
        </div>
      </RegisterEntryModal>
    </div>
  );
}

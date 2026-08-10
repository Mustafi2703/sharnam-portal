import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, Select, Stat } from "../components/ui";
import { downloadCsv, USER_CSV_DETAILED_SAMPLE, USER_CSV_HEADERS } from "../lib/csvTemplates";

/**
 * HRMS dashboard — KPIs, employee directory, project/vendor assignment.
 * Sub-tools (Recruitment, Onboarding, etc.) open from the tool rail in HrmsLayout.
 */

export default function HrmPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [empForm, setEmpForm] = useState({
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
  const [vendorAssign, setVendorAssign] = useState({ vendorId: "", projectId: "", trade: "" });

  const load = useCallback(async () => {
    const [e, p, v, dash] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }).catch(() => []),
      canManage ? api<any[]>("/api/projects", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
      api<any>("/api/hrm/dashboard", { token }).catch(() => null),
    ]);
    setEmployees(e);
    setProjects(p);
    setVendors(v);
    setDashboard(dash);
  }, [token, canManage]);
  useEffect(() => {
    void load();
  }, [load]);

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(empForm) });
      setEmpForm({ fullName: "", email: "", role: "site_employee", phone: "", empCode: "", department: "Site", designation: "", password: "Demo@1234" });
      setMsg("Employee login created.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-5">
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Headcount" value={String(dashboard.headcount ?? employees.length)} />
          <Stat label="Punches today" value={String(dashboard.punchesToday ?? 0)} />
          <Stat label="Pending leave" value={String(dashboard.pendingLeave ?? 0)} />
          <Stat label="Open offers" value={String(dashboard.openOffers ?? 0)} />
          <Stat label="Open reqs" value={String(dashboard.openReqs ?? 0)} />
          <Stat label="Active candidates" value={String(dashboard.activeCandidates ?? 0)} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/hrm/recruitment" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Recruitment</span>
          <span className="hrms-quick-card__title">Requisition → Interview → Offer</span>
        </Link>
        <Link to="/hrm/onboarding" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Onboarding</span>
          <span className="hrms-quick-card__title">Pre-join checklist + Day 1</span>
        </Link>
        <Link to="/hrm/payroll" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Payroll</span>
          <span className="hrms-quick-card__title">Payslips + pay hike</span>
        </Link>
        <Link to="/hrm/attendance" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Attendance</span>
          <span className="hrms-quick-card__title">Geo check-in / out</span>
        </Link>
        <Link to="/hrm/leave" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Leave</span>
          <span className="hrms-quick-card__title">Request → Approve</span>
        </Link>
        <Link to="/hrm/masters" className="hrms-quick-card">
          <span className="hrms-quick-card__tag">Masters</span>
          <span className="hrms-quick-card__title">Leave types + holidays</span>
        </Link>
      </div>

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {canManage && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Add employee with login</h3>
            <form className="grid sm:grid-cols-2 gap-2" onSubmit={createEmployee}>
              <Input required placeholder="Full name" value={empForm.fullName} onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })} />
              <Input required type="email" placeholder="Login email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
              <Select value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}>
                {["site_employee", "office", "employee", "vendor", "client"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
              <Input placeholder="Password" value={empForm.password} onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} />
              <Input placeholder="Phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} />
              <Input placeholder="Emp code" value={empForm.empCode} onChange={(e) => setEmpForm({ ...empForm, empCode: e.target.value })} />
              <Input placeholder="Department" value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} />
              <Input placeholder="Designation" value={empForm.designation} onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} />
              <Button type="submit" className="sm:col-span-2">Create login</Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3 border-t border-line pt-3">
              <Button type="button" variant="secondary" onClick={() => downloadCsv("users-empty.csv", [...USER_CSV_HEADERS], [])}>Empty CSV</Button>
              <Button type="button" variant="secondary" onClick={() => downloadCsv("users-detailed.csv", [...USER_CSV_HEADERS], USER_CSV_DETAILED_SAMPLE)}>Detailed CSV</Button>
              <Link to="/roles" className="text-sm font-semibold text-brand self-center">Users management →</Link>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Assign employee → project</h3>
            <p className="text-xs text-steel-muted mb-2">Adds them to that project&rsquo;s directory.</p>
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api("/api/hrm/assign", { method: "POST", token, body: JSON.stringify(assign) });
                setMsg("Employee added to project directory.");
                await load();
              }}
            >
              <Select required value={assign.userId} onChange={(e) => setAssign({ ...assign, userId: e.target.value })}>
                <option value="">Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.role})</option>
                ))}
              </Select>
              <Select required value={assign.projectId} onChange={(e) => setAssign({ ...assign, projectId: e.target.value })}>
                <option value="">Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
              <Select value={assign.role} onChange={(e) => setAssign({ ...assign, role: e.target.value })}>
                {["site_employee", "office", "employee", "vendor", "project_manager"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
              <Button type="submit" className="w-full">Assign to directory</Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Assign vendor → project</h3>
            <p className="text-xs text-steel-muted mb-2">Vendors appear in project Directory + Communications matrix.</p>
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/vendors/project/${vendorAssign.projectId}/assign`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ vendorId: vendorAssign.vendorId, tradeRole: vendorAssign.trade }),
                });
                setMsg("Vendor added to project directory.");
              }}
            >
              <Select required value={vendorAssign.vendorId} onChange={(e) => setVendorAssign({ ...vendorAssign, vendorId: e.target.value })}>
                <option value="">Vendor company</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
              <Select required value={vendorAssign.projectId} onChange={(e) => setVendorAssign({ ...vendorAssign, projectId: e.target.value })}>
                <option value="">Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
              <Input placeholder="Trade / package" value={vendorAssign.trade} onChange={(e) => setVendorAssign({ ...vendorAssign, trade: e.target.value })} />
              <Button type="submit" className="w-full">Assign vendor</Button>
            </form>
          </Card>
        </div>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Employees ({employees.length})</div>
        <ul className="divide-y max-h-[420px] overflow-y-auto">
          {employees.map((e) => (
            <li key={e.id} className="px-4 py-2 text-sm">
              <div className="font-medium">{e.fullName}</div>
              <div className="text-xs text-steel-muted capitalize">
                {e.role?.replace("_", " ")} · {e.profile?.empCode || "—"} · {e.profile?.department || "—"}
              </div>
              {e.memberships?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.memberships.slice(0, 3).map((m: any) => (
                    <Link key={m.id} to={`/projects/${m.project.id}/directory`} className="text-[10px] font-mono text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                      {m.project.code}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

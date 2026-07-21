import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

/**
 * HRM — company people + assign into project directory (employees & vendors).
 * Project Directory tool shows the live roster for each site.
 */
export default function HrmPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leave, setLeave] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [empForm, setEmpForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    empCode: "",
    department: "Site",
    designation: "",
  });
  const [assign, setAssign] = useState({ userId: "", projectId: "", role: "site_employee" });
  const [vendorAssign, setVendorAssign] = useState({ vendorId: "", projectId: "", trade: "" });
  const [msg, setMsg] = useState("");
  const canManage = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [e, a, l, p, v] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }),
      api<any[]>("/api/hrm/attendance", { token }),
      api<any[]>("/api/hrm/leave", { token }),
      canManage ? api<any[]>("/api/projects", { token }) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setEmployees(e);
    setAttendance(a);
    setLeave(l);
    setProjects(p);
    setVendors(v);
  };

  useEffect(() => {
    void load();
  }, [token, canManage]);

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(empForm) });
    setEmpForm({
      fullName: "",
      email: "",
      role: "site_employee",
      phone: "",
      empCode: "",
      department: "Site",
      designation: "",
    });
    setMsg("Employee created.");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HRM · Directory"
        title="People & project directory"
        subtitle="Maintain the company roster, then assign employees and vendors into a project directory (Communication Matrix orgs live here). Open Directory inside a project to browse the live list."
        actions={
          <Button
            onClick={async () => {
              await api("/api/hrm/attendance", {
                method: "POST",
                token,
                body: JSON.stringify({
                  status: "Present",
                  checkIn: new Date().toTimeString().slice(0, 5),
                }),
              });
              await load();
            }}
          >
            Check in today
          </Button>
        }
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {canManage && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Add employee</h3>
            <form className="grid sm:grid-cols-2 gap-2" onSubmit={createEmployee}>
              <Input required placeholder="Full name" value={empForm.fullName} onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })} />
              <Input required type="email" placeholder="Email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
              <Select value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}>
                {["site_employee", "office", "employee", "vendor"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              <Input placeholder="Phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} />
              <Input placeholder="Emp code" value={empForm.empCode} onChange={(e) => setEmpForm({ ...empForm, empCode: e.target.value })} />
              <Input placeholder="Department" value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Designation" value={empForm.designation} onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} />
              <Button type="submit" className="sm:col-span-2">
                Create login (password: Demo@1234)
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Assign employee → project</h3>
            <p className="text-xs text-steel-muted mb-2">Adds them to that project’s directory.</p>
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
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.role})
                  </option>
                ))}
              </Select>
              <Select required value={assign.projectId} onChange={(e) => setAssign({ ...assign, projectId: e.target.value })}>
                <option value="">Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
              <Select value={assign.role} onChange={(e) => setAssign({ ...assign, role: e.target.value })}>
                {["site_employee", "office", "employee", "vendor", "project_manager"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
              <Button type="submit" className="w-full">
                Assign to directory
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Assign vendor → project</h3>
            <p className="text-xs text-steel-muted mb-2">Vendors appear in project Directory + Communications matrix orgs.</p>
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
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <Select required value={vendorAssign.projectId} onChange={(e) => setVendorAssign({ ...vendorAssign, projectId: e.target.value })}>
                <option value="">Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
              <Input placeholder="Trade / package" value={vendorAssign.trade} onChange={(e) => setVendorAssign({ ...vendorAssign, trade: e.target.value })} />
              <Button type="submit" className="w-full">
                Assign vendor
              </Button>
            </form>
            {vendorAssign.projectId && (
              <Link to={`/projects/${vendorAssign.projectId}/directory`} className="mt-3 inline-flex text-xs font-semibold text-brand">
                Open project directory →
              </Link>
            )}
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card padding={false} className="lg:col-span-1">
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Employees</div>
          <ul className="divide-y max-h-[480px] overflow-y-auto">
            {employees.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{e.fullName}</div>
                <div className="text-xs text-steel-muted capitalize">
                  {e.role.replace("_", " ")} · {e.profile?.empCode || "—"} · {e.profile?.department || "—"}
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
        <Card>
          <h2 className="font-semibold mb-3">Today attendance</h2>
          <ul className="text-sm space-y-2">
            {attendance.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>{a.user.fullName}</span>
                <Badge tone="ok">
                  {a.status} {a.checkIn || ""}
                </Badge>
              </li>
            ))}
            {!attendance.length && <li className="text-steel-muted">No marks yet</li>}
          </ul>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Leave</h2>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/hrm/leave", { method: "POST", token, body: JSON.stringify(leaveForm) });
              setLeaveForm({ fromDate: "", toDate: "", reason: "" });
              await load();
            }}
          >
            <Input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} required />
            <Input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} required />
            <Input placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
            <Button type="submit" variant="secondary" className="w-full">
              Request leave
            </Button>
          </form>
          <ul className="text-sm space-y-1">
            {leave.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 items-center">
                <span>
                  {l.user.fullName}: <Badge tone={l.status === "Approved" ? "ok" : "warn"}>{l.status}</Badge>
                </span>
                {canManage && l.status === "Pending" && (
                  <button
                    className="text-brand text-xs font-semibold"
                    onClick={async () => {
                      await api(`/api/hrm/leave/${l.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ status: "Approved" }),
                      });
                      await load();
                    }}
                  >
                    Approve
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

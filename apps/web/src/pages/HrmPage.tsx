import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, PageHeader, Select } from "../components/ui";
import { downloadCsv, USER_CSV_DETAILED_SAMPLE, USER_CSV_HEADERS } from "../lib/csvTemplates";

/**
 * HRMS hub — one tile per tool. Each tool has its own dedicated page like
 * every other module in the portal.
 *
 *  · Recruitment              → /hrms/recruitment
 *  · Pre-joining + Onboarding → /hrms/onboarding
 *  · Payroll + Pay hike       → /hrms/payroll
 *  · Attendance (geo)         → /hrms/attendance
 *  · Leave (pre-approval)     → /hrms/leave
 *  · Leave types + Holidays   → /hrms/masters
 *
 * Adding an employee login and assigning them to projects / vendors is a
 * small enough form to keep on the hub for admin / office users.
 */

const TILES = [
  { href: "/hrms/recruitment", tag: "1", eyebrow: "Recruitment", title: "Requisition → Job posting → Candidates → Interviews → Offer", sub: "Manpower requisition, HR approval, LinkedIn/Naukri postings, interview scorecards, offer letters. Teams meeting link auto-generated." },
  { href: "/hrms/onboarding", tag: "2", eyebrow: "Pre-joining · Onboarding", title: "Document collection, BGV, IT asset, ID card, welcome kit → Day 1 formalities", sub: "Stateful checklists — per-employee audit trail." },
  { href: "/hrms/payroll", tag: "3", eyebrow: "Payroll · Pay hike", title: "Monthly payslip compute + salary revision workflow", sub: "Deterministic compute from CTC + paid-days. Editable overrides. Approvals audited." },
  { href: "/hrms/attendance", tag: "4", eyebrow: "Attendance", title: "Geo-fenced site check-in / check-out", sub: "GPS capture with optional site verification. Photo attendance runs through Site Pilot on each project." },
  { href: "/hrms/leave", tag: "5", eyebrow: "Leave management", title: "Request → Approve → Balance updates", sub: "Pre-approval flow. Balances tick down on approve. Payroll picks up paid vs LWP." },
  { href: "/hrms/masters", tag: "6", eyebrow: "Masters", title: "Leave types & holidays uploads", sub: "Seed CL / SL / PL / CO / LWP. Upload the year's holidays." },
];

export default function HrmPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
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
    const [e, p, v] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }).catch(() => []),
      canManage ? api<any[]>("/api/projects", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setEmployees(e);
    setProjects(p);
    setVendors(v);
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="HRMS · Sharnam"
        title="Human Resources — dedicated desk"
        subtitle="Each tool has its own page — Recruitment, Onboarding, Payroll, Attendance, Leave, Masters. HR admin has a separate login link (/login/hr) so this desk stays scoped to HR + office roles."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <Link key={t.href} to={t.href} className="block rounded-2xl border border-line bg-white p-4 hover:border-ink transition">
            <div className="text-xs uppercase tracking-widest text-brand font-semibold">{t.tag} · {t.eyebrow}</div>
            <div className="mt-1 font-semibold">{t.title}</div>
            <div className="text-xs text-steel-muted mt-1">{t.sub}</div>
          </Link>
        ))}
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

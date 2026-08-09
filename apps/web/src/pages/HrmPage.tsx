import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { downloadCsv, USER_CSV_DETAILED_SAMPLE, USER_CSV_HEADERS } from "../lib/csvTemplates";

/**
 * HRM — company people + assign into project directory + attendance (with geo-fence),
 * leave types, holidays, and leave requests with balances.
 */
export default function HrmPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leave, setLeave] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
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

  const [leaveTypeForm, setLeaveTypeForm] = useState({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "", region: "India" });
  const [checkInProject, setCheckInProject] = useState("");
  const [geoStatus, setGeoStatus] = useState("");
  const [msg, setMsg] = useState("");

  const canManage = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const year = new Date().getFullYear();
    const [e, a, l, lt, hs, p, v, bl] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }),
      api<any[]>("/api/hrm/attendance", { token }),
      api<any[]>("/api/hrm/leave", { token }),
      api<any[]>("/api/hrm/leave-types", { token }),
      api<any[]>(`/api/hrm/holidays?year=${year}`, { token }),
      canManage ? api<any[]>("/api/projects", { token }) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
      api<any[]>(`/api/hrm/leave-balances?year=${year}`, { token }).catch(() => []),
    ]);
    setEmployees(e);
    setAttendance(a);
    setLeave(l);
    setLeaveTypes(lt);
    setHolidays(hs);
    setProjects(p);
    setVendors(v);
    setBalances(bl);
  };

  useEffect(() => {
    void load();
  }, [token, canManage]);

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(empForm) });
    setEmpForm({ fullName: "", email: "", role: "site_employee", phone: "", empCode: "", department: "Site", designation: "", password: "Demo@1234" });
    setMsg("Employee login created.");
    await load();
  }

  async function checkInWithGeo(kind: "in" | "out") {
    setGeoStatus("Requesting GPS…");
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGeoStatus(`GPS ok · ±${Math.round(geo.accuracy)}m`);
        try {
          await api("/api/hrm/attendance", {
            method: "POST",
            token,
            body: JSON.stringify({
              status: "Present",
              kind,
              [kind === "in" ? "checkIn" : "checkOut"]: new Date().toTimeString().slice(0, 5),
              geo,
              projectId: checkInProject || undefined,
            }),
          });
          setMsg(`${kind === "in" ? "Checked in" : "Checked out"} — GPS captured${checkInProject ? " · site verified" : ""}.`);
          await load();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Check-in failed");
        }
      },
      (err) => setGeoStatus(`GPS error — ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const holidaysThisYear = useMemo(() => holidays.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [holidays]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HRM · Directory · Attendance · Leave"
        title="People, attendance & leave"
        subtitle="Company roster + project assignments + geo-fenced site check-in + leave types, balances & holidays. Everything cross-linked into Communication Matrix and project directory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={checkInProject} onChange={(e) => setCheckInProject(e.target.value)} className="max-w-xs">
              <option value="">No project (office)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </Select>
            <Button type="button" onClick={() => void checkInWithGeo("in")}>Check-in (GPS)</Button>
            <Button type="button" variant="secondary" onClick={() => void checkInWithGeo("out")}>Check-out</Button>
          </div>
        }
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}
      {geoStatus && <p className="text-xs text-steel-muted">GPS: {geoStatus}</p>}

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
              <li key={a.id} className="flex justify-between gap-2 items-start">
                <div>
                  <div>{a.user?.fullName}</div>
                  {(a.inLat || a.inLng) && (
                    <div className="text-[10px] text-steel-muted">
                      {a.inSiteName ? `Site: ${a.inSiteName}` : `${a.inLat?.toFixed(4)}, ${a.inLng?.toFixed(4)}`}
                      {a.inGeofenceOk ? " · ✓ inside geofence" : ""}
                    </div>
                  )}
                </div>
                <Badge tone={a.inGeofenceOk ? "ok" : "warn"}>
                  {a.status} {a.checkIn || ""}
                </Badge>
              </li>
            ))}
            {!attendance.length && <li className="text-steel-muted">No marks yet</li>}
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Leave request</h2>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/hrm/leave", { method: "POST", token, body: JSON.stringify(leaveForm) });
              setLeaveForm({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
              setMsg("Leave request submitted — awaiting approval.");
              await load();
            }}
          >
            <Select value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}>
              <option value="">Leave type</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} required />
            <Input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} required />
            <label className="text-xs text-steel-muted flex items-center gap-2">
              <input type="checkbox" checked={leaveForm.halfDay} onChange={(e) => setLeaveForm({ ...leaveForm, halfDay: e.target.checked })} />
              Half-day
            </label>
            <Input placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
            <Button type="submit" variant="secondary" className="w-full">Request leave (pre-approval)</Button>
          </form>
          {balances.length > 0 && (
            <div className="text-xs border-t border-line pt-2">
              <div className="font-semibold mb-1">Your balances · {new Date().getFullYear()}</div>
              <ul className="space-y-0.5">
                {balances.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>{b.leaveType?.name}</span>
                    <span className="tabular-nums">{b.balance}/{b.entitled}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="text-sm space-y-1 border-t border-line pt-2">
            {leave.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 items-center">
                <span>
                  {l.user?.fullName}
                  {l.leaveType ? ` · ${l.leaveType.name}` : ""}: <Badge tone={l.status === "Approved" ? "ok" : l.status === "Rejected" ? "danger" : "warn"}>{l.status}</Badge>
                </span>
                {canManage && l.status === "Pending" && (
                  <span className="flex gap-1">
                    <button
                      className="text-brand text-xs font-semibold"
                      onClick={async () => {
                        await api(`/api/hrm/leave/${l.id}`, { method: "PATCH", token, body: JSON.stringify({ status: "Approved" }) });
                        await load();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="text-danger text-xs font-semibold"
                      onClick={async () => {
                        await api(`/api/hrm/leave/${l.id}`, { method: "PATCH", token, body: JSON.stringify({ status: "Rejected" }) });
                        await load();
                      }}
                    >
                      Reject
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {canManage && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Leave types (masters)</h3>
            <form
              className="grid sm:grid-cols-3 gap-2 mb-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await api("/api/hrm/leave-types", { method: "POST", token, body: JSON.stringify(leaveTypeForm) });
                setLeaveTypeForm({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
                await load();
              }}
            >
              <Input placeholder="Code (CL / SL / PL)" value={leaveTypeForm.code} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value })} required />
              <Input placeholder="Name" value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })} required />
              <Input placeholder="Days / year" type="number" value={leaveTypeForm.daysPerYear} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, daysPerYear: e.target.value })} />
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={leaveTypeForm.isPaid} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, isPaid: e.target.checked })} />Paid</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={leaveTypeForm.carryForward} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, carryForward: e.target.checked })} />Carry-fwd</label>
              <Button type="submit">Add leave type</Button>
            </form>
            <ul className="text-sm divide-y">
              {leaveTypes.map((t) => (
                <li key={t.id} className="py-1.5 flex justify-between">
                  <span>
                    <span className="font-medium">{t.name}</span>{" "}
                    <span className="text-xs text-steel-muted">· {t.code} · {t.daysPerYear}/yr {t.isPaid ? "· paid" : "· unpaid"}</span>
                  </span>
                </li>
              ))}
              {!leaveTypes.length && <li className="text-steel-muted py-2 text-sm">No leave types yet. Suggested seed: CL / SL / PL / CO / LWP.</li>}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Holidays · {new Date().getFullYear()}</h3>
            <form
              className="grid sm:grid-cols-4 gap-2 mb-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await api("/api/hrm/holidays", { method: "POST", token, body: JSON.stringify(holidayForm) });
                setHolidayForm({ date: "", name: "", region: "India" });
                await load();
              }}
            >
              <Input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} required />
              <Input placeholder="Name" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} required className="sm:col-span-2" />
              <Input placeholder="Region" value={holidayForm.region} onChange={(e) => setHolidayForm({ ...holidayForm, region: e.target.value })} />
              <Button type="submit" className="sm:col-span-4">Add holiday</Button>
            </form>
            <ul className="text-sm divide-y max-h-64 overflow-y-auto">
              {holidaysThisYear.map((h) => (
                <li key={h.id} className="py-1.5 flex justify-between items-center">
                  <span>
                    <span className="font-mono text-xs">{new Date(h.date).toISOString().slice(0, 10)}</span> · {h.name}
                    {h.region && <span className="text-xs text-steel-muted"> ({h.region})</span>}
                  </span>
                  <button
                    className="text-danger text-xs"
                    onClick={async () => {
                      await api(`/api/hrm/holidays/${h.id}`, { method: "DELETE", token });
                      await load();
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {!holidaysThisYear.length && <li className="text-steel-muted py-2">No holidays uploaded for this year.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

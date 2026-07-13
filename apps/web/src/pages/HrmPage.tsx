import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function HrmPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leave, setLeave] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });

  const load = async () => {
    const [e, a, l] = await Promise.all([
      api<any[]>("/api/hrm/employees", { token }),
      api<any[]>("/api/hrm/attendance", { token }),
      api<any[]>("/api/hrm/leave", { token }),
    ]);
    setEmployees(e);
    setAttendance(a);
    setLeave(l);
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">HRM</h1>
        <p className="text-steel-muted">Employees, attendance, leave — construction office shell.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-brand text-white px-4 py-2 text-sm"
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
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="rounded-2xl bg-white border p-4 lg:col-span-1">
          <h2 className="font-semibold mb-3">Employees</h2>
          <ul className="text-sm space-y-2">
            {employees.map((e) => (
              <li key={e.id}>
                <div className="font-medium">{e.fullName}</div>
                <div className="text-steel-muted capitalize">
                  {e.role.replace("_", " ")} · {e.profile?.empCode || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-white border p-4">
          <h2 className="font-semibold mb-3">Today attendance</h2>
          <ul className="text-sm space-y-2">
            {attendance.map((a) => (
              <li key={a.id}>
                {a.user.fullName}: {a.status} {a.checkIn || ""}
              </li>
            ))}
            {!attendance.length && <li className="text-steel-muted">No marks yet</li>}
          </ul>
        </section>
        <section className="rounded-2xl bg-white border p-4 space-y-3">
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
            <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} required />
            <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} required />
            <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
            <button className="rounded-xl bg-steel text-white px-3 py-2 text-sm">Request leave</button>
          </form>
          <ul className="text-sm space-y-1">
            {leave.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>
                  {l.user.fullName}: {l.status}
                </span>
                {(user?.role === "admin" || user?.role === "office") && l.status === "Pending" && (
                  <button
                    className="text-brand"
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
        </section>
      </div>
    </div>
  );
}

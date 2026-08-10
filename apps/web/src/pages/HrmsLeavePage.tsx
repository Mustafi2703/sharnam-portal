import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";

/** HRMS · Leave — pre-approval flow with balances + admin approve/reject. */
export default function HrmsLeavePage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [leave, setLeave] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const year = new Date().getFullYear();
    const [l, t, b] = await Promise.all([
      api<any[]>("/api/hrm/leave", { token }).catch(() => []),
      api<any[]>("/api/hrm/leave-types", { token }).catch(() => []),
      api<any[]>(`/api/hrm/leave-balances?year=${year}`, { token }).catch(() => []),
    ]);
    setLeave(l);
    setTypes(t);
    setBalances(b);
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/hrm/leave", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
      setMsg("Leave request submitted — awaiting approval.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <div className="space-y-5">
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="font-semibold">Request leave</h3>
          <form className="space-y-2" onSubmit={submit}>
            <Select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
              <option value="">Leave type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            <Input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
            <label className="text-xs text-steel-muted flex items-center gap-2">
              <input type="checkbox" checked={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.checked })} />
              Half-day
            </label>
            <Input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <Button type="submit" className="w-full" variant="secondary">Submit</Button>
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
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Requests</h3>
          <ul className="text-sm space-y-1">
            {leave.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 items-center border-b border-line py-1.5">
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
            {!leave.length && <li className="text-steel-muted">No requests yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

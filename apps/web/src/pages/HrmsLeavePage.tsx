import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";

type LeaveType = { id: string; code: string; name: string; daysPerYear: number };
type Balance = { id: string; entitled: number; used: number; balance: number; leaveType: LeaveType };
type LeaveRow = {
  id: string;
  status: string;
  days: number;
  halfDay: boolean;
  fromDate: string;
  toDate: string;
  reason?: string | null;
  leaveType?: LeaveType | null;
  user?: { fullName?: string; email?: string };
};

/** HRMS · Leave — balances (PL default 12), employee apply, HR approve / convert / adjust. */
export default function HrmsLeavePage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const year = new Date().getFullYear();
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [staff, setStaff] = useState<{ id: string; fullName: string }[]>([]);
  const [hrUserId, setHrUserId] = useState("");
  const [balanceDraft, setBalanceDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
  const [msg, setMsg] = useState("");

  const balanceUserId = canManage && hrUserId ? hrUserId : user?.id || "";

  const loadBalances = useCallback(async () => {
    if (!token || !balanceUserId) return;
    const q = new URLSearchParams({ year: String(year), userId: balanceUserId });
    const b = await api<Balance[]>(`/api/hrm/leave-balances?${q}`, { token }).catch(() => []);
    setBalances(b);
    setBalanceDraft(Object.fromEntries(b.map((row) => [row.leaveType.id, String(row.entitled)])));
  }, [token, balanceUserId, year]);

  const load = useCallback(async () => {
    if (!token) return;
    const leaveQ = canManage ? "/api/hrm/leave?all=1" : "/api/hrm/leave";
    const [l, t] = await Promise.all([
      api<LeaveRow[]>(leaveQ, { token }).catch(() => []),
      api<LeaveType[]>("/api/hrm/leave-types", { token }).catch(() => []),
    ]);
    setLeave(l);
    setTypes(t);
    await loadBalances();
  }, [token, canManage, loadBalances]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage || !token) return;
    void api<{ id: string; fullName: string }[]>("/api/hrm/employees", { token })
      .then((rows) => setStaff(rows.map((e) => ({ id: e.id, fullName: e.fullName }))))
      .catch(() => setStaff([]));
  }, [token, canManage]);

  useEffect(() => {
    if (hrUserId) void loadBalances();
  }, [hrUserId, loadBalances]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/hrm/leave", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          ...(canManage && hrUserId ? { userId: hrUserId } : {}),
        }),
      });
      setForm({ fromDate: "", toDate: "", reason: "", leaveTypeId: "", halfDay: false });
      setMsg("Leave request submitted — awaiting HR approval.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function saveBalances() {
    if (!hrUserId) {
      setMsg("Select an employee to update leave balances.");
      return;
    }
    setMsg("");
    try {
      await api("/api/hrm/leave-balances/bulk", {
        method: "POST",
        token,
        body: JSON.stringify({
          userId: hrUserId,
          year,
          balances: types.map((t) => ({
            leaveTypeId: t.id,
            entitled: Number(balanceDraft[t.id] ?? t.daysPerYear),
          })),
        }),
      });
      setMsg("Leave balances updated.");
      await loadBalances();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save balances");
    }
  }

  async function patchLeave(id: string, body: Record<string, unknown>) {
    await api(`/api/hrm/leave/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
    await load();
  }

  const shownLeave = canManage ? leave : leave;

  return (
    <div className="space-y-5">
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <p className="text-xs text-steel-muted max-w-2xl">
        SPDC defaults on setup: CL 12 · <strong>PL 12</strong> · Sick 6 · Emergency 3 · Short 24 (per year). Employees see{" "}
        <span className="font-mono">remaining / entitled</span> below when they apply.
      </p>

      {canManage ? (
        <Card className="space-y-3">
          <h3 className="font-semibold">HR — manage employee leave</h3>
          <Select value={hrUserId} onChange={(e) => setHrUserId(e.target.value)} className="max-w-md">
            <option value="">Select employee…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
          {hrUserId && balances.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-steel-muted border-b border-line">
                    <th className="py-1 pr-2">Type</th>
                    <th className="py-1 pr-2">Entitled (days)</th>
                    <th className="py-1 pr-2">Used</th>
                    <th className="py-1">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.id} className="border-b border-line/60">
                      <td className="py-1.5 pr-2">{b.leaveType.name}</td>
                      <td className="py-1.5 pr-2">
                        <Input
                          className="!py-1 !text-sm max-w-[5rem]"
                          type="number"
                          min={0}
                          step={0.5}
                          value={balanceDraft[b.leaveType.id] ?? String(b.entitled)}
                          onChange={(e) =>
                            setBalanceDraft((d) => ({ ...d, [b.leaveType.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">{b.used}</td>
                      <td className="py-1.5 tabular-nums font-semibold text-brand">{b.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button type="button" variant="secondary" onClick={() => void saveBalances()}>
                  Save balances
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await api("/api/hrm/leave-balances/ensure-defaults", {
                      method: "POST",
                      token,
                      body: JSON.stringify({ userId: hrUserId, year }),
                    });
                    await loadBalances();
                    setMsg("Default balances applied (missing types only).");
                  }}
                >
                  Apply SPDC defaults
                </Button>
              </div>
            </div>
          ) : hrUserId ? (
            <p className="text-sm text-steel-muted">No balances yet — use Apply SPDC defaults.</p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="font-semibold">Request leave</h3>
          <form className="space-y-2" onSubmit={submit}>
            <Select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} required>
              <option value="">Leave type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            <Input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
            <label className="text-xs text-steel-muted flex items-center gap-2">
              <input type="checkbox" checked={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.checked })} />
              Half-day
            </label>
            <Input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <Button type="submit" className="w-full" variant="secondary">
              Submit
            </Button>
          </form>
          {balances.length > 0 && (
            <div className="text-xs border-t border-line pt-2">
              <div className="font-semibold mb-1">Your balances · {year}</div>
              <ul className="space-y-0.5">
                {balances.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span>{b.leaveType.name}</span>
                    <span className="tabular-nums font-medium">
                      {b.balance} left <span className="text-steel-muted font-normal">/ {b.entitled}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">{canManage ? "All requests" : "My requests"}</h3>
          <ul className="text-sm space-y-2">
            {shownLeave.map((l) => (
              <li key={l.id} className="border-b border-line pb-2">
                <div className="flex flex-wrap justify-between gap-2 items-start">
                  <span>
                    {canManage && l.user?.fullName ? `${l.user.fullName} · ` : ""}
                    {l.leaveType?.name || "Leave"} · {l.days}d{" "}
                    <Badge tone={l.status === "Approved" ? "ok" : l.status === "Rejected" ? "danger" : "warn"}>
                      {l.status}
                    </Badge>
                  </span>
                  <span className="text-[10px] text-steel-muted font-mono">
                    {String(l.fromDate).slice(0, 10)} → {String(l.toDate).slice(0, 10)}
                  </span>
                </div>
                {l.reason ? <p className="text-xs text-steel-muted mt-0.5">{l.reason}</p> : null}
                {canManage && (
                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    {l.status === "Pending" && (
                      <>
                        <button type="button" className="text-brand text-xs font-semibold" onClick={() => void patchLeave(l.id, { status: "Approved" })}>
                          Approve
                        </button>
                        <button type="button" className="text-danger text-xs font-semibold" onClick={() => void patchLeave(l.id, { status: "Rejected" })}>
                          Reject
                        </button>
                        <Select
                          className="!py-1 !text-xs max-w-[10rem]"
                          value={l.leaveType?.id || ""}
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== l.leaveType?.id) {
                              void patchLeave(l.id, { convertToLeaveTypeId: e.target.value });
                            }
                          }}
                        >
                          <option value="">Convert to…</option>
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.code}
                            </option>
                          ))}
                        </Select>
                      </>
                    )}
                    {l.status === "Approved" && (
                      <>
                        <Select
                          className="!py-1 !text-xs max-w-[10rem]"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) void patchLeave(l.id, { convertToLeaveTypeId: e.target.value });
                          }}
                        >
                          <option value="">Reclassify to…</option>
                          {types.filter((t) => t.id !== l.leaveType?.id).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.code}
                            </option>
                          ))}
                        </Select>
                        <button type="button" className="text-xs text-steel-muted underline" onClick={() => void patchLeave(l.id, { status: "Cancelled" })}>
                          Cancel &amp; restore balance
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
            {!shownLeave.length && <li className="text-steel-muted">No requests yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

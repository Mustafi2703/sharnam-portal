import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input } from "../components/ui";

/** HRMS · Masters — leave types + holidays uploads. Admin / office only. */
export default function HrmsMastersPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [types, setTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [typeForm, setTypeForm] = useState({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
  const [holForm, setHolForm] = useState({ date: "", name: "", region: "India" });

  const load = useCallback(async () => {
    const y = new Date().getFullYear();
    const [t, h] = await Promise.all([
      api<any[]>("/api/hrm/leave-types", { token }).catch(() => []),
      api<any[]>(`/api/hrm/holidays?year=${y}`, { token }).catch(() => []),
    ]);
    setTypes(t);
    setHolidays(h);
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const holSorted = useMemo(() => holidays.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [holidays]);

  async function addType(e: FormEvent) {
    e.preventDefault();
    await api("/api/hrm/leave-types", { method: "POST", token, body: JSON.stringify(typeForm) });
    setTypeForm({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
    await load();
  }
  async function addHol(e: FormEvent) {
    e.preventDefault();
    await api("/api/hrm/holidays", { method: "POST", token, body: JSON.stringify(holForm) });
    setHolForm({ date: "", name: "", region: "India" });
    await load();
  }

  return (
    <div className="space-y-5">
      {!canManage && (
        <p className="text-sm text-steel-muted">Read-only view — admin / office can edit these masters.</p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Leave types</h3>
          {canManage && (
            <form className="grid sm:grid-cols-3 gap-2 mb-3" onSubmit={addType}>
              <Input placeholder="Code (CL / SL / PL)" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} required />
              <Input placeholder="Name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} required />
              <Input placeholder="Days / year" type="number" value={typeForm.daysPerYear} onChange={(e) => setTypeForm({ ...typeForm, daysPerYear: e.target.value })} />
              <label className="text-xs flex items-center gap-2 col-span-1">
                <input type="checkbox" checked={typeForm.isPaid} onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })} />
                Paid
              </label>
              <label className="text-xs flex items-center gap-2 col-span-1">
                <input type="checkbox" checked={typeForm.carryForward} onChange={(e) => setTypeForm({ ...typeForm, carryForward: e.target.checked })} />
                Carry-fwd
              </label>
              <Button type="submit">Add leave type</Button>
            </form>
          )}
          <ul className="text-sm divide-y">
            {types.map((t) => (
              <li key={t.id} className="py-1.5 flex justify-between">
                <span>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-xs text-steel-muted">· {t.code} · {t.daysPerYear}/yr {t.isPaid ? "· paid" : "· unpaid"}</span>
                </span>
              </li>
            ))}
            {!types.length && <li className="text-steel-muted py-2 text-sm">No leave types yet. Suggested seed: CL / SL / PL / CO / LWP.</li>}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Holidays · {new Date().getFullYear()}</h3>
          {canManage && (
            <form className="grid sm:grid-cols-4 gap-2 mb-3" onSubmit={addHol}>
              <Input type="date" value={holForm.date} onChange={(e) => setHolForm({ ...holForm, date: e.target.value })} required />
              <Input placeholder="Name" value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} required className="sm:col-span-2" />
              <Input placeholder="Region" value={holForm.region} onChange={(e) => setHolForm({ ...holForm, region: e.target.value })} />
              <Button type="submit" className="sm:col-span-4">Add holiday</Button>
            </form>
          )}
          <ul className="text-sm divide-y max-h-72 overflow-y-auto">
            {holSorted.map((h) => (
              <li key={h.id} className="py-1.5 flex justify-between items-center">
                <span>
                  <span className="font-mono text-xs">{new Date(h.date).toISOString().slice(0, 10)}</span> · {h.name}
                  {h.region && <span className="text-xs text-steel-muted"> ({h.region})</span>}
                </span>
                {canManage && (
                  <button
                    className="text-danger text-xs"
                    onClick={async () => {
                      await api(`/api/hrm/holidays/${h.id}`, { method: "DELETE", token });
                      await load();
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {!holSorted.length && <li className="text-steel-muted py-2">No holidays uploaded for this year.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

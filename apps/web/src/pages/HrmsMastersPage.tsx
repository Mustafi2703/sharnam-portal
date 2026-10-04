import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";
import { HrmOrgMasters } from "../components/HrmOrgMasters";

/** HRMS · Masters — departments and roles, leave types, holidays. */
export default function HrmsMastersPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [types, setTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [typeForm, setTypeForm] = useState({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
  const [editingTypeId, setEditingTypeId] = useState("");
  const [typeMsg, setTypeMsg] = useState("");
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

  function blankType() {
    setEditingTypeId("");
    setTypeForm({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
  }

  async function addType(e: FormEvent) {
    e.preventDefault();
    setTypeMsg("");
    try {
      if (editingTypeId) {
        await api(`/api/hrm/leave-types/${editingTypeId}`, { method: "PATCH", token, body: JSON.stringify(typeForm) });
      } else {
        await api("/api/hrm/leave-types", { method: "POST", token, body: JSON.stringify(typeForm) });
      }
      blankType();
      await load();
    } catch (err) {
      setTypeMsg(err instanceof Error ? err.message : "Could not save the leave type");
    }
  }

  async function removeType(id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    setTypeMsg("");
    try {
      await api(`/api/hrm/leave-types/${id}`, { method: "DELETE", token });
      if (editingTypeId === id) blankType();
      await load();
    } catch (err) {
      setTypeMsg(err instanceof Error ? err.message : "Could not delete the leave type");
    }
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
        <p className="text-sm text-steel-muted">Read-only view — admin, office, and HR can edit these masters.</p>
      )}

      <HrmOrgMasters token={token} canManage={canManage} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Leave types</h3>
          {canManage && (
            <form className="flex flex-col gap-2 mb-3" onSubmit={addType}>
              <Input placeholder="Code (CL / SL / PL)" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} required />
              <Input placeholder="Name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} required />
              <Input placeholder="Days / year" type="number" value={typeForm.daysPerYear} onChange={(e) => setTypeForm({ ...typeForm, daysPerYear: e.target.value })} />
              <div className="flex flex-wrap gap-3">
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={typeForm.isPaid} onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })} />
                  Paid
                </label>
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={typeForm.carryForward} onChange={(e) => setTypeForm({ ...typeForm, carryForward: e.target.checked })} />
                  Carry-fwd
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingTypeId ? "Save leave type" : "Add leave type"}</Button>
                {editingTypeId ? (
                  <Button type="button" variant="secondary" onClick={blankType}>Cancel</Button>
                ) : null}
              </div>
            </form>
          )}
          {typeMsg ? <p className="text-xs text-danger mb-2">{typeMsg}</p> : null}
          <ul className="text-sm divide-y max-h-64 overflow-y-auto">
            {types.map((t) => (
              <li key={t.id} className="py-1.5 flex justify-between gap-2 items-start">
                <span>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-xs text-steel-muted">· {t.code} · {t.daysPerYear}/yr {t.isPaid ? "· paid" : "· unpaid"}</span>
                </span>
                {canManage ? (
                  <span className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="text-brand text-xs font-semibold"
                      onClick={() => {
                        setEditingTypeId(t.id);
                        setTypeForm({
                          code: t.code || "",
                          name: t.name || "",
                          daysPerYear: String(t.daysPerYear ?? ""),
                          isPaid: t.isPaid !== false,
                          carryForward: !!t.carryForward,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="text-danger text-xs font-semibold" onClick={() => void removeType(t.id, t.name)}>
                      Delete
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
            {!types.length && <li className="text-steel-muted py-2 text-sm">No leave types yet.</li>}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Holidays · {new Date().getFullYear()}</h3>
          {canManage && (
            <>
            <form className="flex flex-col gap-2 mb-3" onSubmit={addHol}>
              <Input type="date" value={holForm.date} onChange={(e) => setHolForm({ ...holForm, date: e.target.value })} required />
              <Input placeholder="Name" value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} required />
              <Input placeholder="Region" value={holForm.region} onChange={(e) => setHolForm({ ...holForm, region: e.target.value })} />
              <Button type="submit">Add holiday</Button>
            </form>
            <label className="block text-xs text-steel-muted mb-3">
              Upload holiday calendar (CSV: date, name, region, optional)
              <input
                type="file"
                accept=".csv,text/csv"
                className="block mt-1 text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  await api("/api/hrm/holidays/import-csv", { method: "POST", token, body: fd });
                  e.target.value = "";
                  await load();
                }}
              />
            </label>
            </>
          )}
          <ul className="text-sm divide-y max-h-64 overflow-y-auto">
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
            {!holSorted.length && <li className="text-steel-muted py-2">No holidays for this year.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

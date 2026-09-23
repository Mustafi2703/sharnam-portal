import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";

type DepartmentRow = { id: string; code: string; name: string; headName?: string | null };

/** HRMS · Masters — leave types, holidays, departments. */
export default function HrmsMastersPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [types, setTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [typeForm, setTypeForm] = useState({ code: "", name: "", daysPerYear: "", isPaid: true, carryForward: false });
  const [holForm, setHolForm] = useState({ date: "", name: "", region: "India" });
  const [deptForm, setDeptForm] = useState({ code: "", name: "", headName: "" });

  const load = useCallback(async () => {
    const y = new Date().getFullYear();
    const [t, h, d] = await Promise.all([
      api<any[]>("/api/hrm/leave-types", { token }).catch(() => []),
      api<any[]>(`/api/hrm/holidays?year=${y}`, { token }).catch(() => []),
      api<DepartmentRow[]>("/api/hrm/departments", { token }).catch(() => []),
    ]);
    setTypes(t);
    setHolidays(h);
    setDepartments(d);
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
  async function addDept(e: FormEvent) {
    e.preventDefault();
    await api("/api/hrm/departments", { method: "POST", token, body: JSON.stringify(deptForm) });
    setDeptForm({ code: "", name: "", headName: "" });
    await load();
  }

  return (
    <div className="space-y-5">
      {!canManage && (
        <p className="text-sm text-steel-muted">Read-only view — admin, office, and HR can edit these masters.</p>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-1">Departments</h3>
          <p className="text-[11px] text-steel-muted mb-3">Used on manpower requisitions, job postings, and employee profiles.</p>
          {canManage && (
            <form className="grid sm:grid-cols-2 gap-2 mb-3" onSubmit={addDept}>
              <Input placeholder="Code (e.g. SITE)" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
              <Input placeholder="Department name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required />
              <Input placeholder="Head name (optional)" value={deptForm.headName} onChange={(e) => setDeptForm({ ...deptForm, headName: e.target.value })} className="sm:col-span-2" />
              <Button type="submit" className="sm:col-span-2">
                Add department
              </Button>
            </form>
          )}
          <ul className="text-sm divide-y max-h-64 overflow-y-auto">
            {departments.map((d) => (
              <li key={d.id} className="py-1.5 flex justify-between gap-2">
                <span>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-steel-muted block font-mono">{d.code}{d.headName ? ` · ${d.headName}` : ""}</span>
                </span>
              </li>
            ))}
            {!departments.length && <li className="text-steel-muted py-2 text-sm">No departments yet — add Site, HR, Planning, etc.</li>}
          </ul>
        </Card>

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
          <ul className="text-sm divide-y max-h-64 overflow-y-auto">
            {types.map((t) => (
              <li key={t.id} className="py-1.5 flex justify-between">
                <span>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-xs text-steel-muted">· {t.code} · {t.daysPerYear}/yr {t.isPaid ? "· paid" : "· unpaid"}</span>
                </span>
              </li>
            ))}
            {!types.length && <li className="text-steel-muted py-2 text-sm">No leave types yet.</li>}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Holidays · {new Date().getFullYear()}</h3>
          {canManage && (
            <>
            <form className="grid sm:grid-cols-4 gap-2 mb-3" onSubmit={addHol}>
              <Input type="date" value={holForm.date} onChange={(e) => setHolForm({ ...holForm, date: e.target.value })} required />
              <Input placeholder="Name" value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} required className="sm:col-span-2" />
              <Input placeholder="Region" value={holForm.region} onChange={(e) => setHolForm({ ...holForm, region: e.target.value })} />
              <Button type="submit" className="sm:col-span-4">
                Add holiday
              </Button>
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

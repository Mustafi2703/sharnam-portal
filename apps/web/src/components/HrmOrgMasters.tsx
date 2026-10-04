import { useMemo, useState, type FormEvent } from "react";
import { SPDC_HIRING_ROLES } from "@sharnam/shared";
import { api } from "../api";
import { Button, Card, Input, Select } from "./ui";
import { LOGIN_TYPE_OPTIONS, useHrmOrg, type HrmDepartmentRow, type HrmDesignationRow } from "../lib/hrmOrg";

const loginLabel = (v: string) => LOGIN_TYPE_OPTIONS.find((o) => o.value === v)?.label || v;

/** HRMS · Masters — open, rename and close departments and the roles under them. */
export function HrmOrgMasters({ token, canManage }: { token: string | null | undefined; canManage: boolean }) {
  const { departments, designations, reload } = useHrmOrg(token, { includeClosedRoles: true });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [deptForm, setDeptForm] = useState({ name: "", headName: "" });
  const [editDept, setEditDept] = useState<HrmDepartmentRow | null>(null);
  const blankRole = { title: "", department: "", loginRole: "site_employee", scorecardRole: "" };
  const [roleForm, setRoleForm] = useState(blankRole);
  const [editRoleId, setEditRoleId] = useState("");
  const [filter, setFilter] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const grouped = useMemo(() => {
    const byDept = new Map<string, HrmDesignationRow[]>();
    for (const d of departments) byDept.set(d.name, []);
    for (const r of designations) {
      if (!showClosed && !r.isActive) continue;
      if (filter && r.department !== filter) continue;
      if (!byDept.has(r.department)) byDept.set(r.department, []);
      byDept.get(r.department)!.push(r);
    }
    return [...byDept.entries()].filter(([name, rows]) => (filter ? name === filter : rows.length || departments.some((d) => d.name === name)));
  }, [departments, designations, filter, showClosed]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ tone: "ok", text: ok });
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy("");
    }
  }

  function saveDept(e: FormEvent) {
    e.preventDefault();
    const name = deptForm.name.trim();
    if (!name) return;
    void run(
      "dept",
      async () => {
        if (editDept) {
          await api(`/api/hrm/departments/${editDept.id}`, { method: "PATCH", token, body: JSON.stringify(deptForm) });
        } else {
          const code = name.slice(0, 24).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
          await api("/api/hrm/departments", { method: "POST", token, body: JSON.stringify({ ...deptForm, code }) });
        }
        setDeptForm({ name: "", headName: "" });
        setEditDept(null);
      },
      editDept ? `Department renamed to ${name}.` : `Department ${name} opened.`,
    );
  }

  function closeDept(d: HrmDepartmentRow) {
    if (!window.confirm(`Delete the ${d.name} department? It leaves every department picker. People already in it keep it on their profile.`)) return;
    void run(`dept:${d.id}`, () => api(`/api/hrm/departments/${d.id}`, { method: "DELETE", token }), `${d.name} deleted.`);
  }

  function saveRole(e: FormEvent) {
    e.preventDefault();
    const title = roleForm.title.trim();
    if (!title || !roleForm.department) return;
    void run(
      "role",
      async () => {
        const body = JSON.stringify({ ...roleForm, title, scorecardRole: roleForm.scorecardRole || null });
        if (editRoleId) await api(`/api/hrm/designations/${editRoleId}`, { method: "PATCH", token, body });
        else await api("/api/hrm/designations", { method: "POST", token, body });
        setRoleForm(blankRole);
        setEditRoleId("");
      },
      editRoleId ? `${title} updated.` : `${title} opened under ${roleForm.department}.`,
    );
  }

  function closeRole(r: HrmDesignationRow) {
    const holders = r.employees ? ` ${r.employees} employee${r.employees === 1 ? "" : "s"} hold this role and keep it on their profile.` : "";
    if (!window.confirm(`Delete the ${r.title} role? It leaves every role picker.${holders}`)) return;
    void run(`role:${r.id}`, () => api(`/api/hrm/designations/${r.id}`, { method: "DELETE", token }), `${r.title} deleted.`);
  }

  function reopenRole(r: HrmDesignationRow) {
    void run(`role:${r.id}`, () => api(`/api/hrm/designations/${r.id}`, { method: "PATCH", token, body: JSON.stringify({ isActive: true }) }), `${r.title} reopened.`);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <h3 className="font-semibold">Departments And Roles</h3>
          <p className="text-[11px] text-steel-muted">
            Open a department or a role when you need it, delete it when you don't. Requisitions, new logins and employee profiles only offer what is open here.
          </p>
        </div>
      </div>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`text-xs mb-3 rounded-md px-3 py-2 ${msg.tone === "err" ? "bg-red-50 text-red-800 border border-red-200" : "bg-sand/50 text-ink border border-line"}`}>
          {msg.text}
        </p>
      ) : null}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 mt-3">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">Departments ({departments.length})</h4>
          {canManage && (
            <form className="space-y-2" onSubmit={saveDept}>
              <Input placeholder="Department name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required />
              <Input placeholder="Head of department (optional)" value={deptForm.headName} onChange={(e) => setDeptForm({ ...deptForm, headName: e.target.value })} />
              <div className="flex gap-2">
                <Button type="submit" className="!text-xs" disabled={busy === "dept"}>
                  {busy === "dept" ? "Saving…" : editDept ? "Save Department" : "Add Department"}
                </Button>
                {editDept ? (
                  <Button type="button" variant="secondary" className="!text-xs" onClick={() => { setEditDept(null); setDeptForm({ name: "", headName: "" }); }}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}
          <ul className="text-sm divide-y divide-line border border-line rounded-lg max-h-[420px] overflow-y-auto">
            {departments.map((d) => {
              const open = designations.filter((r) => r.department === d.name && r.isActive).length;
              return (
                <li key={d.id} className={`px-3 py-2 flex justify-between gap-2 items-start ${filter === d.name ? "bg-brand-soft/50" : ""}`}>
                  <button type="button" className="text-left min-w-0 cursor-pointer" onClick={() => setFilter(filter === d.name ? "" : d.name)}>
                    <span className="font-medium block truncate">{d.name}</span>
                    <span className="text-[11px] text-steel-muted">
                      {open} open role{open === 1 ? "" : "s"}{d.headName ? ` · Head: ${d.headName}` : ""}
                    </span>
                  </button>
                  {canManage ? (
                    <span className="flex gap-2 shrink-0 text-xs font-semibold">
                      <button type="button" className="text-brand cursor-pointer" onClick={() => { setEditDept(d); setDeptForm({ name: d.name, headName: d.headName || "" }); }}>
                        Edit
                      </button>
                      <button type="button" className="text-danger cursor-pointer disabled:opacity-50" disabled={busy === `dept:${d.id}`} onClick={() => closeDept(d)}>
                        {busy === `dept:${d.id}` ? "Deleting…" : "Delete"}
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
            {!departments.length && <li className="px-3 py-2 text-steel-muted">No departments yet.</li>}
          </ul>
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Roles {filter ? `· ${filter}` : ""} ({designations.filter((r) => r.isActive).length} open)
            </h4>
            <span className="flex items-center gap-3 text-xs">
              {filter ? (
                <button type="button" className="text-brand font-semibold cursor-pointer" onClick={() => setFilter("")}>
                  Show all departments
                </button>
              ) : null}
              <label className="flex items-center gap-1.5 text-steel-muted">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                Show deleted roles
              </label>
            </span>
          </div>
          {canManage && (
            <form className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2 items-end" onSubmit={saveRole}>
              <Input label="Role title" placeholder="Senior Planning Engineer" value={roleForm.title} onChange={(e) => setRoleForm({ ...roleForm, title: e.target.value })} required fieldClassName="xl:col-span-2" />
              <Select label="Department" value={roleForm.department} onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })} required>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </Select>
              <Select label="Default login" value={roleForm.loginRole} onChange={(e) => setRoleForm({ ...roleForm, loginRole: e.target.value })}>
                {LOGIN_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <Select label="Interview scorecard" value={roleForm.scorecardRole} onChange={(e) => setRoleForm({ ...roleForm, scorecardRole: e.target.value })}>
                <option value="">Pick at interview</option>
                {SPDC_HIRING_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
              <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
                <Button type="submit" className="!text-xs" disabled={busy === "role"}>
                  {busy === "role" ? "Saving…" : editRoleId ? "Save Role" : "Add Role"}
                </Button>
                {editRoleId ? (
                  <Button type="button" variant="secondary" className="!text-xs" onClick={() => { setEditRoleId(""); setRoleForm(blankRole); }}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}
          <div className="border border-line rounded-lg max-h-[520px] overflow-y-auto">
            {grouped.map(([dept, rows]) => (
              <div key={dept} className="border-b border-line last:border-b-0">
                <div className="px-3 py-1.5 bg-sand/40 text-[11px] font-semibold uppercase tracking-wider text-steel-muted sticky top-0">{dept}</div>
                <ul className="divide-y divide-line text-sm">
                  {rows.map((r) => (
                    <li key={r.id} className={`px-3 py-2 flex flex-wrap justify-between gap-2 items-center ${r.isActive ? "" : "opacity-60"}`}>
                      <span className="min-w-0">
                        <span className="font-medium">{r.title}</span>
                        {!r.isActive ? <span className="ml-2 text-[10px] uppercase tracking-wider text-danger font-semibold">Deleted</span> : null}
                        <span className="block text-[11px] text-steel-muted">
                          {loginLabel(r.loginRole)}
                          {r.scorecardRole ? ` · Scorecard: ${r.scorecardRole}` : ""}
                          {r.employees ? ` · ${r.employees} employee${r.employees === 1 ? "" : "s"}` : ""}
                        </span>
                      </span>
                      {canManage ? (
                        <span className="flex gap-2 shrink-0 text-xs font-semibold">
                          {r.isActive ? (
                            <>
                              <button
                                type="button"
                                className="text-brand cursor-pointer"
                                onClick={() => {
                                  setEditRoleId(r.id);
                                  setRoleForm({ title: r.title, department: r.department, loginRole: r.loginRole, scorecardRole: r.scorecardRole || "" });
                                }}
                              >
                                Edit
                              </button>
                              <button type="button" className="text-danger cursor-pointer disabled:opacity-50" disabled={busy === `role:${r.id}`} onClick={() => closeRole(r)}>
                                {busy === `role:${r.id}` ? "Deleting…" : "Delete"}
                              </button>
                            </>
                          ) : (
                            <button type="button" className="text-brand cursor-pointer disabled:opacity-50" disabled={busy === `role:${r.id}`} onClick={() => reopenRole(r)}>
                              Reopen
                            </button>
                          )}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {!rows.length && <li className="px-3 py-2 text-xs text-steel-muted">No open roles in this department.</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

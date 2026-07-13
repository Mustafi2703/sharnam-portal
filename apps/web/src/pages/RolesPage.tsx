import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { MODULES, type ModuleKey, type PermissionAction } from "@sharnam/shared";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve"];

export default function RolesPage() {
  const { token, user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const load = async () => {
    const [r, u] = await Promise.all([
      api<any[]>("/api/roles", { token }),
      api<any[]>("/api/users", { token }),
    ]);
    setRoles(r);
    setUsers(u);
  };

  useEffect(() => {
    void load();
  }, [token]);

  const role = roles.find((r) => r.key === selected);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Roles & portals</h1>
      <p className="text-steel-muted">Editable permission matrix — refine after client workshop.</p>

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.key}
            onClick={() => setSelected(r.key)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${selected === r.key ? "bg-brand text-white" : "bg-white border"}`}
          >
            {r.label} · {r.portal}
          </button>
        ))}
      </div>

      {role && (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-sand/50 text-left">
              <tr>
                <th className="p-3">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="p-3 capitalize">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m} className="border-t border-black/5">
                  <td className="p-3 font-medium">{m}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="p-3">
                      <input
                        type="checkbox"
                        checked={!!role.permissions?.[m]?.[a]}
                        onChange={(e) => {
                          const next = {
                            ...role.permissions,
                            [m as ModuleKey]: {
                              ...role.permissions[m],
                              [a]: e.target.checked,
                            },
                          };
                          setRoles(roles.map((r) => (r.key === role.key ? { ...r, permissions: next } : r)));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 border-t">
            <button
              className="rounded-xl bg-brand text-white px-4 py-2 text-sm"
              onClick={async () => {
                await api(`/api/roles/${role.key}`, {
                  method: "PUT",
                  token,
                  body: JSON.stringify({ permissions: role.permissions }),
                });
                await load();
              }}
            >
              Save {role.label}
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl bg-white border p-4">
        <h2 className="font-semibold mb-3">Assign user roles</h2>
        <ul className="space-y-2 text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap gap-2 items-center justify-between border-b border-black/5 pb-2">
              <div>
                <div className="font-medium">{u.fullName}</div>
                <div className="text-steel-muted">{u.email}</div>
              </div>
              <select
                className="rounded-xl border px-3 py-2"
                value={u.role}
                onChange={async (e) => {
                  await api(`/api/users/${u.id}`, {
                    method: "PATCH",
                    token,
                    body: JSON.stringify({ role: e.target.value }),
                  });
                  await load();
                }}
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.key}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

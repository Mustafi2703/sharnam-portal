import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { MODULES, type ModuleKey, type PermissionAction } from "@sharnam/shared";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { WORKSPACES } from "../workspaces";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve"];

/** Admin — allocate who can see / do what (Parikh-style role cards + matrix) */
export default function RolesPage() {
  const { token, user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  const [msg, setMsg] = useState("");
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

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

  async function saveRole() {
    if (!role) return;
    setMsg("");
    try {
      await api(`/api/roles/${role.key}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ permissions: role.permissions }),
      });
      setMsg(`Saved access for ${role.label}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHero
        title="Who can see what"
        subtitle="Sharnam admin allocates module visibility and actions per role — same idea as Parikh role management. Project module toggles stay in Master."
        actions={
          <Link to="/master">
            <Button type="button" className="!bg-amber-500">
              Master module toggles →
            </Button>
          </Link>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelected(r.key)}
            className={`text-left rounded-2xl border p-4 transition ${
              selected === r.key ? "border-amber-400 bg-amber-50 shadow-sm" : "border-line bg-white hover:border-[#1e3a5f]/40"
            }`}
          >
            <div className="font-display text-lg text-[#1e3a5f]">{r.label}</div>
            <div className="text-xs font-mono text-steel-muted mt-1">{r.key}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              <Badge tone="brand">{r.portal}</Badge>
              <Badge tone="neutral">{users.filter((u) => u.role === r.key).length} users</Badge>
            </div>
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {role && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-[#1e3a5f]">{role.label} permissions</h2>
              <p className="text-sm text-steel-muted mt-1">Toggle view / create / edit / approve per module.</p>
            </div>
            <Button type="button" onClick={() => void saveRole()}>
              Save access
            </Button>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">Portal modules (reference)</h3>
            <div className="flex flex-wrap gap-2">
              {WORKSPACES.map((w) => (
                <span key={w.key} className="rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#1e3a5f]">
                  {w.title}
                </span>
              ))}
            </div>
            <p className="text-xs text-steel-muted mt-2">
              Per-project enable/disable is controlled in Master → Module toggles. This matrix controls role capabilities.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
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
                  <tr key={m} className="border-t border-line">
                    <td className="p-3 font-medium">{m}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-amber-500"
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
          </div>
        </Card>
      )}
    </div>
  );
}

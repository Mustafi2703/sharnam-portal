import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { MODULES, type ModuleKey, type PermissionAction } from "@sharnam/shared";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { WORKSPACES } from "../workspaces";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve"];

/** Office / Admin — allocate who can see / do what */
export default function RolesPage() {
  const { token, user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  const [msg, setMsg] = useState("");

  const canManage = user?.role === "admin" || user?.role === "office";
  if (!canManage) return <Navigate to="/dashboard" replace />;

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
        title="Access control"
        subtitle="Sharnam Office allocates module visibility and actions per role. Project module on/off stays in Master."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/audit">
              <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary">
                Audit trail
              </Button>
            </Link>
            <Link to="/master">
              <Button type="button" className="!bg-[var(--color-mark)] !border-[var(--color-mark)]">
                Master module toggles →
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelected(r.key)}
            className={`text-left rounded-xl border p-4 transition ${
              selected === r.key
                ? "border-brand bg-brand-soft shadow-sm"
                : "border-line bg-paper hover:border-brand/40"
            }`}
          >
            <div className="font-display text-lg text-ink">{r.label}</div>
            <div className="text-xs font-mono text-steel-muted mt-1">{r.key}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              <Badge tone="brand">{r.portal}</Badge>
              <Badge tone="neutral">{users.filter((u) => u.role === r.key).length} users</Badge>
            </div>
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-ok bg-brand-soft border border-line px-3 py-2 rounded-lg">{msg}</p>}

      {role && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-ink">{role.label} permissions</h2>
              <p className="text-sm text-steel-muted mt-1">Toggle view / create / edit / approve per module.</p>
            </div>
            <Button type="button" onClick={() => void saveRole()}>
              Save access
            </Button>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
              Portal modules (reference)
            </h3>
            <div className="flex flex-wrap gap-2">
              {WORKSPACES.map((w) => (
                <span
                  key={w.key}
                  className="rounded-lg border border-line bg-sand px-3 py-1.5 text-xs font-semibold text-ink"
                >
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
              <thead className="bg-sand text-left text-ink">
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
                    <td className="p-3 font-medium text-ink">{m}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-brand)]"
                          checked={!!role.permissions?.[m]?.[a]}
                          onChange={(e) => {
                            const next = {
                              ...role.permissions,
                              [m as ModuleKey]: {
                                ...role.permissions[m],
                                [a]: e.target.checked,
                              },
                            };
                            setRoles(roles.map((row) => (row.key === role.key ? { ...row, permissions: next } : row)));
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

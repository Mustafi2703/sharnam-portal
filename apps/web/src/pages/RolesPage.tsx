import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { UserAccountEditModal, type UserAccountRow } from "../components/UserAccountEditModal";
import { UserManageActions } from "../components/UserManageActions";
import {
  accountKindLabel,
  badgeToneForKind,
  homePathForUser,
  kindForAccount,
  loginPathForAccount,
  type PortalAccountKind,
} from "../lib/portalAccounts";
import { useConsultantTypes } from "../lib/consultantTypes";
import { MODULES, type ModuleKey, type PermissionAction } from "@sharnam/shared";
import { Badge, Button, Card, Input, PageHero } from "../components/ui";
import { WORKSPACES } from "../workspaces";
import {
  downloadCsv,
  USER_CSV_DETAILED_SAMPLE,
  USER_CSV_HEADERS,
} from "../lib/csvTemplates";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "approve"];

/** Office / Admin — users with login + role access matrix */
export default function RolesPage() {
  const { token, user, impersonate } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState("");
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<UserAccountRow[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  const [msg, setMsg] = useState("");
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | PortalAccountKind>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [userQ, setUserQ] = useState("");
  const { types: consultantTypes } = useConsultantTypes(token);

  const canManage = user?.role === "admin" || user?.role === "office";
  /** Admins can open any desk as that user; an active test session can hop straight on. */
  const canImpersonate = user?.role === "admin" || Boolean(user?.impersonatedBy);
  const isAdmin = user?.role === "admin";
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  async function signInAs(row: UserAccountRow) {
    setSwitching(row.id);
    setMsg("");
    try {
      const res = await impersonate(row.id);
      navigate(homePathForUser(res.user), { replace: true });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open that desk");
    } finally {
      setSwitching("");
    }
  }

  const load = async () => {
    const demoQ = showDemoLogins && isAdmin ? "&includeDemo=1" : "";
    const [r, u] = await Promise.all([
      api<any[]>("/api/roles", { token }),
      api<UserAccountRow[]>(`/api/hrm/employees?scope=all${demoQ}`, { token }),
    ]);
    setRoles(r);
    setUsers(u);
  };

  useEffect(() => {
    if (!canManage) return;
    void load();
  }, [token, canManage, showDemoLogins]);

  async function deactivateDemoSeedLogins() {
    if (
      !window.confirm(
        "Turn off all demo seed logins (@sharnam.demo, @consultant.demo, @arvind.demo, @bhavanainfra.demo)? Real @spdc.in staff stay active."
      )
    )
      return;
    setMsg("");
    try {
      const res = await api<{ deactivated: number; emails: string[] }>("/api/hrm/employees/deactivate-demo-seed", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setMsg(
        res.deactivated
          ? `Deactivated ${res.deactivated} demo login${res.deactivated === 1 ? "" : "s"}.`
          : "No active demo seed logins found."
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not deactivate demo logins");
    }
  }

  const shownUsers = useMemo(() => {
    const needle = userQ.trim().toLowerCase();
    return users.filter((u) => {
      const kind = kindForAccount(u);
      if (kindFilter !== "all" && kind !== kindFilter) return false;
      if (kindFilter === "stakeholder" && typeFilter) {
        const trade = u.profile?.department || u.vendor?.trade || "";
        if (trade !== typeFilter) return false;
      }
      if (!needle) return true;
      return [u.fullName, u.email, u.role, accountKindLabel(kind), u.profile?.department, u.vendor?.name, u.vendor?.trade]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [users, kindFilter, typeFilter, userQ]);

  if (!canManage) return <Navigate to="/dashboard" replace />;

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
        title="Access & users"
        subtitle="Edit existing logins and the permission matrix. Create new people on the matching desk — staff in HRMS, everyone else in CRM."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/hrm/users">
              <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary">
                HRMS users
              </Button>
            </Link>
            <Link to="/crm/directory/clients">
              <Button type="button" className="!bg-[var(--color-mark)] !border-[var(--color-mark)]">
                CRM directories →
              </Button>
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm text-ok bg-sand border border-line px-3 py-2 rounded-lg">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h2 className="font-display text-lg text-ink">Create a login</h2>
          <p className="text-sm text-steel-muted">
            One desk per party. This page does not create SPDC staff or external companies.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Link to="/hrm/users" className="rounded-lg border border-line bg-sand/40 px-3 py-2.5 hover:border-brand">
              <div className="text-sm font-semibold text-ink">SPDC staff</div>
              <div className="text-[11px] text-steel-muted mt-0.5">HRMS → Users · /login/office or /login/site</div>
            </Link>
            <Link to="/crm/directory/clients" className="rounded-lg border border-line bg-sand/40 px-3 py-2.5 hover:border-brand">
              <div className="text-sm font-semibold text-ink">Clients</div>
              <div className="text-[11px] text-steel-muted mt-0.5">CRM → Clients · /login/client</div>
            </Link>
            <Link to="/crm/directory/stakeholders" className="rounded-lg border border-line bg-sand/40 px-3 py-2.5 hover:border-brand">
              <div className="text-sm font-semibold text-ink">Consultants</div>
              <div className="text-[11px] text-steel-muted mt-0.5">CRM → Consultants · /login/stakeholder</div>
            </Link>
            <Link to="/crm/directory/vendors" className="rounded-lg border border-line bg-sand/40 px-3 py-2.5 hover:border-brand">
              <div className="text-sm font-semibold text-ink">Vendors / contractors</div>
              <div className="text-[11px] text-steel-muted mt-0.5">CRM → Vendors · /login/vendor</div>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadCsv("users-empty.csv", [...USER_CSV_HEADERS], [])}
            >
              Empty users CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadCsv("users-detailed.csv", [...USER_CSV_HEADERS], USER_CSV_DETAILED_SAMPLE)}
            >
              Detailed sample CSV
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink">All portal logins</h2>
            <Badge tone="neutral">{shownUsers.length}{userQ || kindFilter !== "all" ? ` / ${users.length}` : ""} accounts</Badge>
          </div>
          {!showDemoLogins ? (
            <p className="text-xs text-steel-muted">
              Demo seed logins are hidden. Only real SPDC staff and live client / vendor accounts show here.
            </p>
          ) : null}
          {isAdmin ? (
            <div className="flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-steel-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-mark)]"
                  checked={showDemoLogins}
                  onChange={(e) => setShowDemoLogins(e.target.checked)}
                />
                Show demo seed logins
              </label>
              <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3" onClick={() => void deactivateDemoSeedLogins()}>
                Deactivate demo logins
              </Button>
            </div>
          ) : null}
          <Input
            className="!text-sm"
            placeholder="Search name, email, company…"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {(["all", "staff", "client", "stakeholder", "vendor"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
                  kindFilter === k ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
                }`}
                onClick={() => {
                  setKindFilter(k);
                  if (k !== "stakeholder") setTypeFilter("");
                }}
              >
                {k === "all" ? "All" : accountKindLabel(k)}
              </button>
            ))}
          </div>
          {kindFilter === "stakeholder" ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
                  !typeFilter ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
                }`}
                onClick={() => setTypeFilter("")}
              >
                All types
              </button>
              {consultantTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
                    typeFilter === t ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
                  }`}
                  onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="divide-y divide-line max-h-[420px] overflow-y-auto text-sm">
            {shownUsers.map((u) => {
              const kind = kindForAccount(u);
              const trade = u.profile?.department || u.vendor?.trade || "";
              return (
              <li key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{u.fullName}</div>
                  <div className="text-xs text-steel-muted truncate">
                    {u.email} · {accountKindLabel(kind)}
                    {kind === "stakeholder" && trade ? ` · ${trade}` : ""}
                    {" · "}
                    {loginPathForAccount(u.role, kind)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={u.isActive === false ? "warn" : badgeToneForKind(kind)}>
                    {u.isActive === false ? "Off" : accountKindLabel(kind)}
                  </Badge>
                  {canImpersonate && u.id !== user?.id && u.isActive !== false ? (
                    <button
                      type="button"
                      disabled={!!switching}
                      className="text-[11px] font-semibold text-brand whitespace-nowrap disabled:opacity-50"
                      onClick={() => void signInAs(u)}
                    >
                      {switching === u.id ? "Opening…" : "Sign in as"}
                    </button>
                  ) : null}
                  <UserManageActions
                    user={u}
                    token={token}
                    onEdit={() => setEditUser(u)}
                    onChanged={async () => {
                      setMsg("User list updated.");
                      await load();
                    }}
                  />
                </div>
              </li>
            );
            })}
            {!shownUsers.length && <li className="py-6 text-steel-muted">No users match this filter.</li>}
          </ul>
        </Card>
      </div>

      <UserAccountEditModal
        open={!!editUser}
        user={editUser}
        token={token}
        isAdmin={user?.role === "admin"}
        forceKind={editUser ? kindForAccount(editUser) : undefined}
        onClose={() => setEditUser(null)}
        onSaved={async () => {
          setMsg("User updated.");
          await load();
        }}
        onDeleted={async () => {
          setMsg("User removed.");
          await load();
        }}
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelected(r.key)}
            className={`text-left rounded-xl border p-4 transition ${
              selected === r.key ? "border-[var(--color-mark)] bg-sand shadow-sm" : "border-line bg-paper hover:border-[#c45c26]/40"
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
                  style={{ borderLeftWidth: 3, borderLeftColor: w.accent }}
                >
                  {w.title}
                </span>
              ))}
            </div>
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
                          className="h-4 w-4 accent-[var(--color-mark)]"
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

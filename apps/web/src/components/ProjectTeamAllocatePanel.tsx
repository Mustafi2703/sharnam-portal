import { FormEvent, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { matchesSearch } from "./SearchableSelect";

export type AllocateUser = { id: string; fullName: string; email: string; role: string };
export type AllocateMember = {
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  portalRole?: string;
  role: string;
};

type Props = {
  projectId: string;
  token: string | null;
  users: AllocateUser[];
  members: AllocateMember[];
  canEdit: boolean;
  onMsg: (text: string) => void;
  onChanged: () => void;
};

/** Assign existing SPDC logins (or create + assign) to a live project. */
export function ProjectTeamAllocatePanel({ projectId, token, users, members, canEdit, onMsg, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [memberRole, setMemberRole] = useState("site_engineer");
  const [listQ, setListQ] = useState("");
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    password: "Demo@1234",
  });
  const shownMembers = members.filter((m) =>
    matchesSearch(`${m.fullName} ${m.email} ${m.portalRole || ""} ${m.role}`, listQ)
  );

  async function assignExisting(e: FormEvent) {
    e.preventDefault();
    if (!token || !memberUserIds.length) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({ userIds: memberUserIds, role: memberRole }),
      });
      setMemberUserIds([]);
      onMsg(`${memberUserIds.length} employee(s) assigned to this project.`);
      onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAssign(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!userForm.email.trim()) {
      onMsg("Email is required for a portal login.");
      return;
    }
    setBusy(true);
    try {
      const created = await api<{ id: string }>("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify(userForm),
      });
      await api("/api/hrm/assign", {
        method: "POST",
        token,
        body: JSON.stringify({ projectId, userId: created.id, role: userForm.role }),
      });
      onMsg(`${userForm.fullName || userForm.email} created. Password: ${userForm.password || "Demo@1234"}`);
      setUserForm({ fullName: "", email: "", role: "site_employee", phone: "", password: "Demo@1234" });
      onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Create user failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="!p-4 space-y-3">
      <h3 className="font-semibold text-sm">Allocate employees</h3>
      <p className="text-xs text-steel-muted">
        Assign the SPDC people already on the portal, or create a login. Email is required so they can sign in.
      </p>
      {members.length > 0 && (
        <Input
          placeholder="Search allocated people by name or email…"
          value={listQ}
          onChange={(e) => setListQ(e.target.value)}
        />
      )}
      <ul className="text-sm divide-y divide-line max-h-48 overflow-y-auto">
        {shownMembers.map((m) => (
          <li key={m.id} className="py-1.5 flex justify-between gap-2">
            <span>
              <span className="font-medium">{m.fullName}</span>
              <span className="block text-xs font-mono text-steel-muted">{m.email}</span>
            </span>
            <Badge tone="neutral">{m.portalRole || m.role}</Badge>
          </li>
        ))}
        {!members.length && <li className="py-2 text-xs text-steel-muted">No people on this project yet.</li>}
        {members.length > 0 && !shownMembers.length && (
          <li className="py-2 text-xs text-steel-muted">No allocated person matches “{listQ}”.</li>
        )}
      </ul>
      {canEdit && (
        <>
          <form className="space-y-2 border-t border-line pt-3" onSubmit={assignExisting}>
            <p className="text-xs text-steel-muted">Tick staff from the HRMS list (clients and vendors stay in CRM).</p>
            <ul className="max-h-44 overflow-y-auto border border-line rounded-lg divide-y">
              {users
                .filter((u) => !members.some((m) => m.userId === u.id || m.email === u.email))
                .map((u) => (
                  <li key={u.id} className="px-3 py-1.5 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberUserIds.includes(u.id)}
                      onChange={() =>
                        setMemberUserIds((cur) =>
                          cur.includes(u.id) ? cur.filter((id) => id !== u.id) : [...cur, u.id]
                        )
                      }
                    />
                    <span>
                      <span className="font-medium">{u.fullName}</span>
                      <span className="block text-[11px] font-mono text-steel-muted">{u.email}</span>
                    </span>
                  </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-2 items-end">
            <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
              <option value="project_manager">Project Manager</option>
              <option value="site_engineer">Site Engineer</option>
              <option value="quality_lead">Quality Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit" variant="secondary" disabled={busy || !memberUserIds.length}>
              Assign selected ({memberUserIds.length})
            </Button>
            </div>
          </form>
          <form className="grid sm:grid-cols-2 gap-2 border-t border-line pt-3" onSubmit={createAndAssign}>
            <p className="sm:col-span-2 text-[10px] uppercase tracking-wide text-steel-muted">Create login + assign</p>
            <Input required placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} />
            <Input required type="email" placeholder="Email (required)" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="site_employee">Site employee</option>
              <option value="office">Office</option>
              <option value="employee">Employee</option>
            </Select>
            <Input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            <Button type="submit" className="sm:col-span-2" disabled={busy}>
              Create user + add to project
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}

import { useMemo, useState } from "react";
import { SPDC_COMPANY_ROLES, suggestedProjectMemberRole } from "@sharnam/shared";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableCheckboxList } from "./SearchableCheckboxList";
import { isSpdcStaffMember, isSpdcStaffUser } from "../lib/spdcStaff";
import { isHiddenPortalListUser } from "../lib/portalUserLists";

export type AllocateUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  vendorId?: string | null;
  designation?: string | null;
  department?: string | null;
  empCode?: string | null;
};
export type AllocateMember = {
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  portalRole?: string;
  role: string;
  vendorId?: string | null;
  designation?: string | null;
  department?: string | null;
  empCode?: string | null;
};

const COMPANY_ROLES = [...SPDC_COMPANY_ROLES];

function roleOptions(current?: string | null) {
  const value = (current || "").trim();
  if (value && !COMPANY_ROLES.includes(value as (typeof COMPANY_ROLES)[number])) return [value, ...COMPANY_ROLES];
  return COMPANY_ROLES;
}

type Props = {
  projectId?: string;
  token: string | null;
  users: AllocateUser[];
  members?: AllocateMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  canEdit: boolean;
  onMsg: (text: string) => void;
  onChanged?: () => void;
};

function isSpdcStaff(u: AllocateUser) {
  return isSpdcStaffUser(u);
}

/** Assign SPDC team and mark company roles on the project card. */
export function ProjectTeamAllocatePanel({
  projectId,
  token,
  users,
  members = [],
  selectedIds,
  onChange,
  canEdit,
  onMsg,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [companyRole, setCompanyRole] = useState("Project Manager");
  const [listQ, setListQ] = useState("");
  const [localRoles, setLocalRoles] = useState<Record<string, string>>({});

  const roleFor = (userId: string | undefined, fallback?: string | null) =>
    (userId && localRoles[userId]) || fallback || "";

  const staff = useMemo(
    () => users.filter((u) => isSpdcStaff(u) && !isHiddenPortalListUser(u.email)),
    [users],
  );
  const staffItems = useMemo(
    () =>
      staff.map((u) => ({
        id: u.id,
        label: u.fullName,
        sublabel: roleFor(u.id, u.designation) || u.email,
        meta: roleFor(u.id, u.designation) ? u.email : undefined,
      })),
    [staff, localRoles],
  );

  async function persist() {
    if (!token || !projectId || !selectedIds.length) return;
    setBusy(true);
    try {
      if (selectedIds.length === 1) {
        await api(`/api/hrm/employees/${selectedIds[0]}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ designation: companyRole }),
        });
        setLocalRoles((prev) => ({ ...prev, [selectedIds[0]]: companyRole }));
      }
      const assignments = selectedIds.map((userId) => {
        const u = staff.find((x) => x.id === userId);
        const marked = selectedIds.length === 1 ? companyRole : roleFor(userId, u?.designation);
        return { userId, role: suggestedProjectMemberRole(marked) };
      });
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({ assignments }),
      });
      onMsg(`${selectedIds.length} team member(s) assigned to this project.`);
      onChange([]);
      onChanged?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string, name: string) {
    if (!token || !projectId) return;
    if (!window.confirm(`Remove ${name} from the SPDC team on this project?`)) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE", token });
      onMsg(`${name} removed from project team.`);
      onChanged?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not remove team member");
    } finally {
      setBusy(false);
    }
  }

  async function setCompanyRole(userId: string, memberId: string, designation: string) {
    if (!token || !userId || !designation) return;
    setBusy(true);
    setLocalRoles((prev) => ({ ...prev, [userId]: designation }));
    try {
      await api(`/api/hrm/employees/${userId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ designation }),
      });
      if (projectId && memberId) {
        await api(`/api/projects/${projectId}/members/${memberId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ role: suggestedProjectMemberRole(designation) }),
        });
      }
      onMsg(`Company role saved: ${designation}`);
      onChanged?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not save company role");
    } finally {
      setBusy(false);
    }
  }

  const staffMembers = useMemo(() => members.filter((m) => isSpdcStaffMember(m)), [members]);
  const assigned = staffMembers.filter((m) =>
    `${m.fullName} ${m.email} ${roleFor(m.userId, m.designation)} ${m.department || ""}`
      .toLowerCase()
      .includes(listQ.trim().toLowerCase()),
  );

  return (
    <Card className="!p-4 space-y-3">
      <h3 className="font-semibold text-sm">Team</h3>
      <p className="text-xs text-steel-muted">
        Mark the company role on this project card — Director, Coordinator, Project Manager, Senior / Junior / Billing / Planning / Safety / MEPF engineer. It is saved on the person and used on the communication matrix.
      </p>
      {staffMembers.length > 0 && (
        <>
          <Input
            placeholder="Search team on this project…"
            value={listQ}
            onChange={(e) => setListQ(e.target.value)}
          />
          <div className="text-[11px] font-semibold text-steel-muted grid grid-cols-[1fr_auto_auto] gap-2 px-1">
            <span>Name</span>
            <span>Company role</span>
            <span />
          </div>
          <ul className="text-sm divide-y divide-line max-h-48 overflow-y-auto">
            {assigned.map((m) => {
              const marked = roleFor(m.userId, m.designation);
              return (
              <li key={m.id} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                <span>
                  <span className="font-medium">{m.fullName}</span>
                  <span className="block text-xs font-mono text-steel-muted">{m.email}</span>
                </span>
                {canEdit && m.userId ? (
                  <Select
                    className="!text-xs min-w-[11rem]"
                    value={marked}
                    disabled={busy}
                    onChange={(e) => void setCompanyRole(m.userId!, m.id, e.target.value)}
                  >
                    <option value="">Select company role…</option>
                    {roleOptions(marked).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone={marked ? "ok" : "neutral"}>{marked || "No company role"}</Badge>
                )}
                {canEdit && projectId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="!text-xs text-danger"
                    disabled={busy}
                    onClick={() => void removeMember(m.id, m.fullName)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
              );
            })}
            {!assigned.length && <li className="py-2 text-xs text-steel-muted">No match.</li>}
          </ul>
        </>
      )}
      {canEdit && (
        <div className="space-y-2 border-t border-line pt-3">
          <SearchableCheckboxList
            items={staffItems}
            selectedIds={selectedIds}
            onChange={onChange}
            placeholder="Search team by name, company role, or email…"
            emptyMessage="No SPDC team in HRMS → Users yet."
            maxHeightClass="max-h-48"
          />
          {projectId ? (
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] font-semibold text-steel-muted block mb-1">
                  Company role for the person you add
                </label>
                <Select value={companyRole} onChange={(e) => setCompanyRole(e.target.value)}>
                  {COMPANY_ROLES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="button" variant="secondary" disabled={busy || !selectedIds.length} onClick={() => void persist()}>
                Add to team ({selectedIds.length})
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-steel-muted">
              {selectedIds.length
                ? `${selectedIds.length} team member(s) selected — they save with the project card (roles from HRMS company role).`
                : "Select team members; they save with the project card."}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

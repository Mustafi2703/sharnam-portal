import { useMemo, useState } from "react";
import { projectMemberRoleLabel, suggestedProjectMemberRole } from "@sharnam/shared";
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

const PROJECT_ROLE_OPTIONS = [
  "project_manager",
  "site_engineer",
  "quality_lead",
  "document_controller",
  "member",
  "viewer",
] as const;

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

function teamMemberSublabel(u: AllocateUser) {
  const parts = [u.designation, u.department, u.empCode].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return u.email;
}

/** Assign SPDC team from HRMS Users — company role + on-project role, not portal login list. */
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
  const [memberRole, setMemberRole] = useState("site_engineer");
  const [listQ, setListQ] = useState("");

  const staff = useMemo(
    () => users.filter((u) => isSpdcStaff(u) && !isHiddenPortalListUser(u.email)),
    [users],
  );
  const staffItems = useMemo(
    () =>
      staff.map((u) => ({
        id: u.id,
        label: u.fullName,
        sublabel: teamMemberSublabel(u),
        meta: u.designation ? u.email : undefined,
      })),
    [staff],
  );

  async function persist() {
    if (!token || !projectId || !selectedIds.length) return;
    setBusy(true);
    try {
      const assignments = selectedIds.map((userId) => {
        const u = staff.find((x) => x.id === userId);
        const role =
          selectedIds.length === 1
            ? memberRole
            : suggestedProjectMemberRole(u?.designation) || memberRole;
        return { userId, role };
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

  async function updateMemberRole(memberId: string, role: string) {
    if (!token || !projectId) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role }),
      });
      onChanged?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusy(false);
    }
  }

  const staffMembers = useMemo(() => members.filter((m) => isSpdcStaffMember(m)), [members]);
  const assigned = staffMembers.filter((m) =>
    `${m.fullName} ${m.email} ${m.designation || ""} ${m.department || ""} ${m.role} ${projectMemberRoleLabel(m.role)}`
      .toLowerCase()
      .includes(listQ.trim().toLowerCase()),
  );

  return (
    <Card className="!p-4 space-y-3">
      <h3 className="font-semibold text-sm">Team</h3>
      <p className="text-xs text-steel-muted">
        SPDC people from HRMS → Users with their company role (Director, PM, engineers, etc.). Clients, consultants, and
        vendors stay in the CRM lists above.
      </p>
      {staffMembers.length > 0 && (
        <>
          <Input
            placeholder="Search team on this project…"
            value={listQ}
            onChange={(e) => setListQ(e.target.value)}
          />
          <div className="text-[11px] font-semibold text-steel-muted grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1">
            <span>Name</span>
            <span className="hidden sm:inline">Company role</span>
            <span>On project</span>
            <span />
          </div>
          <ul className="text-sm divide-y divide-line max-h-48 overflow-y-auto">
            {assigned.map((m) => (
              <li key={m.id} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <span>
                  <span className="font-medium">{m.fullName}</span>
                  <span className="block text-xs font-mono text-steel-muted">{m.email}</span>
                  {m.department ? (
                    <span className="block text-[11px] text-steel-muted sm:hidden">{m.department}</span>
                  ) : null}
                </span>
                <span className="text-xs">
                  {m.designation ? (
                    <Badge tone="ok">{m.designation}</Badge>
                  ) : (
                    <span className="text-steel-muted">Set role in HRMS → Users</span>
                  )}
                  {m.department ? (
                    <span className="hidden sm:block text-[11px] text-steel-muted mt-0.5">{m.department}</span>
                  ) : null}
                </span>
                {canEdit && projectId ? (
                  <Select
                    className="!text-xs min-w-[9rem]"
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => void updateMemberRole(m.id, e.target.value)}
                  >
                    {PROJECT_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {projectMemberRoleLabel(r)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone="neutral">{projectMemberRoleLabel(m.role)}</Badge>
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
            ))}
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
                  On-project role (when one person selected)
                </label>
                <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                  {PROJECT_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {projectMemberRoleLabel(r)}
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

import { useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableCheckboxList } from "./SearchableCheckboxList";
import { isSpdcStaffMember, isSpdcStaffUser } from "../lib/spdcStaff";

export type AllocateUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  vendorId?: string | null;
};
export type AllocateMember = {
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  portalRole?: string;
  role: string;
  vendorId?: string | null;
};

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

/** Assign SPDC staff from HRMS Users only — no clients, consultants, or vendors. */
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

  const staff = useMemo(() => users.filter(isSpdcStaff), [users]);
  const staffItems = useMemo(
    () =>
      staff.map((u) => ({
        id: u.id,
        label: u.fullName,
        sublabel: u.role.replace("_", " "),
        meta: u.email,
      })),
    [staff]
  );

  async function persist() {
    if (!token || !projectId || !selectedIds.length) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({ userIds: selectedIds, role: memberRole }),
      });
      onMsg(`${selectedIds.length} SPDC employee(s) assigned to this project.`);
      onChanged?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  const staffMembers = useMemo(() => members.filter((m) => isSpdcStaffMember(m)), [members]);
  const assigned = staffMembers.filter((m) =>
    `${m.fullName} ${m.email} ${m.portalRole || ""} ${m.role}`.toLowerCase().includes(listQ.trim().toLowerCase())
  );

  return (
    <Card className="!p-4 space-y-3">
      <h3 className="font-semibold text-sm">SPDC employees</h3>
      <p className="text-xs text-steel-muted">
        Only people from HRMS → Users. Clients, consultants, and vendors stay on the CRM lists above.
      </p>
      {staffMembers.length > 0 && (
        <>
          <Input
            placeholder="Search allocated staff…"
            value={listQ}
            onChange={(e) => setListQ(e.target.value)}
          />
          <ul className="text-sm divide-y divide-line max-h-36 overflow-y-auto">
            {assigned.map((m) => (
              <li key={m.id} className="py-1.5 flex justify-between gap-2">
                <span>
                  <span className="font-medium">{m.fullName}</span>
                  <span className="block text-xs font-mono text-steel-muted">{m.email}</span>
                </span>
                <Badge tone="neutral">{m.portalRole || m.role}</Badge>
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
            placeholder="Search SPDC staff by name or email…"
            emptyMessage="No SPDC staff in HRMS → Users yet."
            maxHeightClass="max-h-48"
          />
          {projectId ? (
            <div className="flex flex-wrap gap-2 items-end">
              <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                <option value="project_manager">Project Manager</option>
                <option value="site_engineer">Site Engineer</option>
                <option value="quality_lead">Quality Lead</option>
                <option value="member">Member</option>
              </Select>
              <Button type="button" variant="secondary" disabled={busy || !selectedIds.length} onClick={() => void persist()}>
                Assign selected ({selectedIds.length})
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-steel-muted">
              {selectedIds.length
                ? `${selectedIds.length} staff selected — they save with the project card.`
                : "Tick staff now; they save with the project card."}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

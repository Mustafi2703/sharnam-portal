import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import {
  EMPTY_MATRIX_FORM,
  MatrixPartyFields,
  partyForSection,
  roleForSection,
  type MatrixFormState,
  type MatrixUser,
  type MatrixVendor,
} from "./MatrixPartyFields";

export type MatrixContact = {
  id: string;
  orgSection?: string | null;
  orgName?: string | null;
  isSectionHeader?: boolean;
  personName?: string | null;
  designation?: string | null;
  company?: string | null;
  spoc?: string | null;
  mobile?: string | null;
  email?: string | null;
  mailRole?: string | null;
  officeAddress?: string | null;
};

type AssignedVendor = { vendorId: string; partyType?: string; name?: string };

type Props = {
  projectId: string;
  token: string;
  project?: {
    name?: string;
    clientName?: string;
    clientEmail?: string | null;
    clientContactName?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    designConsultant?: string;
    contractorName?: string | null;
    pmcName?: string;
  } | null;
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  onMatrixKindChange: (k: "TECHNICAL" | "COMMERCIAL") => void;
  contacts: MatrixContact[];
  canEdit: boolean;
  allowCreateCompany?: boolean;
  onReload: () => Promise<void>;
  onMsg: (msg: string) => void;
};

export function CommsMatrixPanel({
  projectId,
  token,
  project,
  matrixKind,
  onMatrixKindChange,
  contacts,
  canEdit,
  allowCreateCompany = true,
  onReload,
  onMsg,
}: Props) {
  const [form, setForm] = useState<MatrixFormState>({ ...EMPTY_MATRIX_FORM, bothMatrices: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<MatrixUser[]>([]);
  const [vendors, setVendors] = useState<MatrixVendor[]>([]);
  const [assignedVendors, setAssignedVendors] = useState<AssignedVendor[]>([]);

  const loadDirectory = useCallback(async () => {
    const [u, v, overview] = await Promise.all([
      api<MatrixUser[]>("/api/users", { token }).catch(() => []),
      api<MatrixVendor[]>("/api/vendors", { token }).catch(() => []),
      api<{ vendors?: { vendorId?: string; vendor?: { id: string; partyType?: string; name?: string }; partyType?: string; name?: string }[] }>(
        `/api/directory/project/${projectId}/overview`,
        { token },
      ).catch(() => null),
    ]);
    setUsers(u);
    setVendors(v);
    setAssignedVendors(
      (overview?.vendors || []).map((row) => ({
        vendorId: row.vendorId || row.vendor?.id || "",
        partyType: row.partyType || row.vendor?.partyType,
        name: row.name || row.vendor?.name,
      })).filter((row) => row.vendorId),
    );
  }, [token, projectId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  async function seedBpcl(force: boolean) {
    setBusy(true);
    try {
      const r = await api<{ message?: string; technical?: number; commercial?: number }>(
        `/api/comms/contacts/${projectId}/seed-bpcl`,
        { method: "POST", token, body: JSON.stringify({ force, both: true }) },
      );
      onMsg(r.message || "BPCL matrices loaded.");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      try {
        await api(`/api/comms/contacts/${projectId}/from-setup`, {
          method: "POST",
          token,
          body: JSON.stringify({
            ...form,
            matrixKind,
            bothMatrices: form.bothMatrices,
            createDirectory: "none",
            orgName: form.orgName || form.company,
          }),
        });
      } catch {
        await api(`/api/comms/contacts/${projectId}`, {
          method: "POST",
          token,
          body: JSON.stringify({ ...form, matrixKind, company: form.company || form.orgName }),
        });
      }
      setForm({ ...EMPTY_MATRIX_FORM, orgSection: form.orgSection, bothMatrices: false, vendorPartyType: partyForSection(form.orgSection), userRole: roleForSection(form.orgSection) });
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not add row");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: MatrixContact) {
    setEditingId(row.id);
    setForm({
      ...EMPTY_MATRIX_FORM,
      orgSection: row.orgSection || "Other",
      orgName: row.orgName || "",
      personName: row.personName || "",
      designation: row.designation || "",
      company: row.company || "",
      spoc: row.spoc || "",
      mobile: row.mobile || "",
      email: row.email || "",
      mailRole: row.mailRole || "CC",
      officeAddress: row.officeAddress || "",
      bothMatrices: false,
      createDirectory: "none",
      vendorPartyType: partyForSection(row.orgSection || "Other"),
      userRole: roleForSection(row.orgSection || "Other"),
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);
    try {
      await api(`/api/comms/contacts/${editingId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          orgSection: form.orgSection,
          orgName: form.orgName || form.company,
          personName: form.personName,
          designation: form.designation,
          company: form.company,
          spoc: form.spoc,
          mobile: form.mobile,
          email: form.email,
          mailRole: form.mailRole,
          officeAddress: form.officeAddress,
        }),
      });
      setEditingId(null);
      await onReload();
      onMsg("Contact updated.");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(rowId: string, name: string) {
    if (!window.confirm(`Remove ${name || "this row"} from the ${matrixKind} matrix?`)) return;
    setBusy(true);
    try {
      await api(`/api/comms/contacts/${rowId}`, { method: "DELETE", token });
      if (editingId === rowId) setEditingId(null);
      await onReload();
      onMsg("Contact removed.");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const fields = (
    <MatrixPartyFields
      key={editingId || "new"}
      form={form}
      onChange={setForm}
      users={users}
      vendors={vendors}
      assignedVendors={assignedVendors}
      project={project}
      projectId={projectId}
      token={token}
      editing={Boolean(editingId)}
      onMsg={onMsg}
      onDirectoryChange={allowCreateCompany ? loadDirectory : undefined}
      allowCreateCompany={allowCreateCompany}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["TECHNICAL", "COMMERCIAL"] as const).map((k) => (
          <Button
            key={k}
            type="button"
            variant={matrixKind === k ? "primary" : "secondary"}
            onClick={() => onMatrixKindChange(k)}
          >
            {k === "TECHNICAL" ? "Technical Matrix" : "Commercial Matrix"}
          </Button>
        ))}
        {canEdit && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void seedBpcl(contacts.length > 0)}>
            {contacts.length ? "Reload From BPCL Excel" : "Load BPCL Excel"}
          </Button>
        )}
      </div>

      <Card className="!bg-procore-navy !text-white !border-0">
        <div className="font-display text-lg">{matrixKind} Communication Matrix</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-white/80 mt-2">
          <div>{project?.name || "—"}</div>
          <div>{project?.clientName || "—"}</div>
          <div>{project?.designConsultant || "—"}</div>
          <div>{project?.pmcName || "Sharnam Project Development Consultants & Co."}</div>
        </div>
      </Card>

      {editingId && canEdit && (
        <Card>
          <h3 className="font-semibold text-sm mb-3">Edit contact</h3>
          <form className="space-y-3" onSubmit={(e) => void saveEdit(e)}>
            {fields}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {canEdit && !editingId && (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Add contact</h3>
          <p className="text-[11px] text-steel-muted mb-3">
            Search the matching directory for this party. Missing consultant or vendor? Add them here — you stay on this
            matrix.
          </p>
          <form className="space-y-3" onSubmit={(e) => void addContact(e)}>
            {fields}
            <label className="flex items-center gap-2 text-xs text-steel-muted">
              <input type="checkbox" checked={form.bothMatrices} onChange={(e) => setForm({ ...form, bothMatrices: e.target.checked })} />
              Also add to the other matrix (Technical + Commercial)
            </label>
            <Button type="submit" disabled={busy}>
              Add Row
            </Button>
          </form>
        </Card>
      )}

      <Card padding={false} className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white flex justify-between gap-2">
          <span>{formatUiText(`${matrixKind} contact register`)}</span>
          <span className="text-[11px] font-normal text-white/70">{contacts.length} rows</span>
        </div>
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-sand text-left text-[10px] uppercase tracking-wider text-steel-muted sticky top-0">
            <tr>
              <th className="p-3">Sr.No</th>
              <th className="p-3">Name</th>
              <th className="p-3">Designation</th>
              <th className="p-3">Company</th>
              <th className="p-3">SPOC</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">General Mail (TO/CC)</th>
              <th className="p-3">Office Address</th>
              {canEdit && <th className="p-3 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let sectionIdx = -1;
              let personInSection = 0;
              return contacts.map((r) => {
                if (r.isSectionHeader) {
                  sectionIdx += 1;
                  personInSection = 0;
                  return (
                    <tr key={r.id} className="bg-brand-soft/80 border-t border-line">
                      <td className="p-3 font-mono font-semibold text-brand">{String.fromCharCode(65 + sectionIdx)}</td>
                      <td className="p-3 font-semibold text-ink" colSpan={canEdit ? 9 : 8}>
                        {r.orgName}
                      </td>
                      {canEdit && (
                        <td className="p-3">
                          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void deleteContact(r.id, r.orgName || "section")}>
                            Delete
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                }
                personInSection += 1;
                return (
                  <tr key={r.id} className="border-t border-line hover:bg-sand/40">
                    <td className="p-3 font-mono text-xs text-steel-muted">{personInSection}</td>
                    <td className="p-3 font-medium whitespace-pre-line">{r.personName || "—"}</td>
                    <td className="p-3">{r.designation || "—"}</td>
                    <td className="p-3">{r.company || r.orgName || "—"}</td>
                    <td className="p-3 text-xs whitespace-pre-line">{r.spoc || "—"}</td>
                    <td className="p-3 font-mono text-xs">{r.mobile || "—"}</td>
                    <td className="p-3 text-xs break-all">{r.email || "—"}</td>
                    <td className="p-3">
                      <Badge tone={r.mailRole === "TO" ? "brand" : "neutral"}>{r.mailRole || "—"}</Badge>
                    </td>
                    <td className="p-3 text-xs text-steel-muted max-w-[180px] whitespace-pre-line">{r.officeAddress || "—"}</td>
                    {canEdit && (
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => startEdit(r)}>
                            Edit
                          </Button>
                          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void deleteContact(r.id, r.personName || "")}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              });
            })()}
            {!contacts.length && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="p-8 text-center text-steel-muted text-sm">
                  No rows — import the project directory or add a Client / Consultant / Contractor from the lists above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { FormEvent, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { formatUiText } from "../lib/formatUiText";

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

const ORG_SECTIONS = ["Client", "PMC", "Consultant", "Contractor", "Other"];

const EMPTY_FORM = {
  orgSection: "Client",
  orgName: "",
  personName: "",
  designation: "",
  company: "",
  spoc: "",
  mobile: "",
  email: "",
  mailRole: "CC",
  officeAddress: "",
};

type Props = {
  projectId: string;
  token: string;
  project?: { name?: string; clientName?: string; designConsultant?: string; pmcName?: string } | null;
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  onMatrixKindChange: (k: "TECHNICAL" | "COMMERCIAL") => void;
  contacts: MatrixContact[];
  canEdit: boolean;
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
  onReload,
  onMsg,
}: Props) {
  const [contactForm, setContactForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

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
      await api(`/api/comms/contacts/${projectId}`, {
        method: "POST",
        token,
        body: JSON.stringify({ ...contactForm, matrixKind, company: contactForm.company || contactForm.orgName }),
      });
      setContactForm({ ...EMPTY_FORM, orgSection: contactForm.orgSection, orgName: contactForm.orgName });
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: MatrixContact) {
    setEditingId(row.id);
    setEditForm({
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
        body: JSON.stringify(editForm),
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
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => void saveEdit(e)}>
            <Select value={editForm.orgSection} onChange={(e) => setEditForm({ ...editForm, orgSection: e.target.value })}>
              {ORG_SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input placeholder="Organisation" value={editForm.orgName} onChange={(e) => setEditForm({ ...editForm, orgName: e.target.value })} required />
            <Input placeholder="Name" value={editForm.personName} onChange={(e) => setEditForm({ ...editForm, personName: e.target.value })} required />
            <Input placeholder="Designation" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
            <Input placeholder="Company" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            <Input placeholder="SPOC" value={editForm.spoc} onChange={(e) => setEditForm({ ...editForm, spoc: e.target.value })} />
            <Input placeholder="Mobile" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
            <Input placeholder="E-mail" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <Select value={editForm.mailRole} onChange={(e) => setEditForm({ ...editForm, mailRole: e.target.value })}>
              <option value="TO">TO</option>
              <option value="CC">CC</option>
            </Select>
            <Input className="sm:col-span-2" placeholder="Office address" value={editForm.officeAddress} onChange={(e) => setEditForm({ ...editForm, officeAddress: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
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
          <h3 className="font-semibold text-sm mb-3">Add contact</h3>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => void addContact(e)}>
            <Select value={contactForm.orgSection} onChange={(e) => setContactForm({ ...contactForm, orgSection: e.target.value })}>
              {ORG_SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input placeholder="Organisation" value={contactForm.orgName} onChange={(e) => setContactForm({ ...contactForm, orgName: e.target.value })} required />
            <Input placeholder="Name" value={contactForm.personName} onChange={(e) => setContactForm({ ...contactForm, personName: e.target.value })} />
            <Input placeholder="Designation" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} />
            <Input placeholder="Company" value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} />
            <Input placeholder="SPOC" value={contactForm.spoc} onChange={(e) => setContactForm({ ...contactForm, spoc: e.target.value })} />
            <Input placeholder="Mobile" value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} />
            <Input placeholder="E-mail" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <Select value={contactForm.mailRole} onChange={(e) => setContactForm({ ...contactForm, mailRole: e.target.value })}>
              <option value="TO">TO</option>
              <option value="CC">CC</option>
            </Select>
            <Input className="sm:col-span-2" placeholder="Office address" value={contactForm.officeAddress} onChange={(e) => setContactForm({ ...contactForm, officeAddress: e.target.value })} />
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
                  No rows — click Load BPCL Excel to pre-fill technical and commercial matrices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

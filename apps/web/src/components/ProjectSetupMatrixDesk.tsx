import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableSelect } from "./SearchableSelect";
import { formatUiText } from "../lib/formatUiText";
import type { MatrixContact } from "./CommsMatrixPanel";

const ORG_SECTIONS = ["Client", "PMC", "Consultant", "Contractor", "Other"] as const;
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
  bothMatrices: true,
  createDirectory: "both" as "none" | "user" | "vendor" | "both",
  userRole: "site_employee",
  vendorPartyType: "Client",
};

type UserRow = { id: string; fullName: string; email: string; role: string; phone?: string | null };
type VendorRow = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
  businessPhone?: string | null;
  address?: string | null;
};

type Props = {
  projectId: string;
  token: string;
  project?: { name?: string; clientName?: string | null; designConsultant?: string | null; pmcName?: string | null } | null;
  users: UserRow[];
  vendors: VendorRow[];
  canEdit: boolean;
  onMsg: (msg: string) => void;
  onDirectoryChange?: () => Promise<void>;
};

function partyForSection(section: string) {
  if (section === "Client") return "Client";
  if (section === "PMC") return "PMC";
  if (section === "Consultant") return "Consultant";
  if (section === "Contractor") return "Contractor";
  return "Vendor";
}

function roleForSection(section: string) {
  if (section === "Client") return "client";
  if (section === "Contractor") return "vendor";
  if (section === "Consultant") return "employee";
  return "site_employee";
}

export function ProjectSetupMatrixDesk({
  projectId,
  token,
  project,
  users,
  vendors,
  canEdit,
  onMsg,
  onDirectoryChange,
}: Props) {
  const [matrixKind, setMatrixKind] = useState<"TECHNICAL" | "COMMERCIAL">("TECHNICAL");
  const [contacts, setContacts] = useState<MatrixContact[]>([]);
  const [counts, setCounts] = useState({ technical: 0, commercial: 0 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickUserId, setPickUserId] = useState("");
  const [pickVendorId, setPickVendorId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tech, comm] = await Promise.all([
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=TECHNICAL`, { token }).catch(() => []),
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=COMMERCIAL`, { token }).catch(() => []),
    ]);
    const people = (rows: MatrixContact[]) => rows.filter((r) => !r.isSectionHeader).length;
    setCounts({ technical: people(tech), commercial: people(comm) });
    setContacts(matrixKind === "COMMERCIAL" ? comm : tech);
    if (!tech.length && !comm.length) {
      await api(`/api/comms/contacts/${projectId}/scaffold`, { method: "POST", token }).catch(() => null);
      const [tech2, comm2] = await Promise.all([
        api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=TECHNICAL`, { token }).catch(() => []),
        api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=COMMERCIAL`, { token }).catch(() => []),
      ]);
      setCounts({ technical: people(tech2), commercial: people(comm2) });
      setContacts(matrixKind === "COMMERCIAL" ? comm2 : tech2);
    }
  }, [projectId, token, matrixKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      vendorPartyType: partyForSection(f.orgSection),
      userRole: roleForSection(f.orgSection),
    }));
  }, [form.orgSection]);

  function applyUser(id: string) {
    setPickUserId(id);
    const u = users.find((x) => x.id === id);
    if (!u) return;
    const section = u.role === "client" ? "Client" : u.role === "vendor" ? "Contractor" : "PMC";
    setForm((f) => ({
      ...f,
      orgSection: section,
      orgName: section === "PMC" ? "Sharnam Project Development Consultants & Co." : f.orgName || u.fullName,
      personName: u.fullName,
      email: u.email,
      mobile: u.phone || "",
      company: section === "PMC" ? "Sharnam PDC" : f.company,
      designation: u.role.replace(/_/g, " "),
      spoc: u.fullName,
      createDirectory: "user",
      userRole: u.role === "client" || u.role === "vendor" || u.role === "office" || u.role === "employee" ? u.role : "site_employee",
    }));
  }

  function applyVendor(id: string) {
    setPickVendorId(id);
    const v = vendors.find((x) => x.id === id);
    if (!v) return;
    const section =
      v.partyType === "Client" ? "Client" : v.partyType === "Consultant" || v.partyType === "Designer" || v.partyType === "PMC" ? (v.partyType === "PMC" ? "PMC" : "Consultant") : "Contractor";
    setForm((f) => ({
      ...f,
      orgSection: section,
      orgName: v.name,
      company: v.name,
      personName: v.primaryContactName || v.name,
      email: v.email || "",
      mobile: v.businessPhone || "",
      designation: v.trade || v.partyType || "",
      officeAddress: v.address || "",
      spoc: v.primaryContactName || v.name,
      createDirectory: "vendor",
      vendorPartyType: v.partyType || partyForSection(section),
    }));
  }

  async function submitRow(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      if (editingId) {
        await api(`/api/comms/contacts/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            orgSection: form.orgSection,
            orgName: form.orgName,
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
        onMsg("Matrix row updated — same book as in-project Comms.");
      } else {
        const r = await api<{
          contacts: { created: boolean; matrixKind: string }[];
          directory?: { user?: { created: boolean; email: string; tempPassword?: string }; vendor?: { created: boolean; name: string } };
        }>(`/api/comms/contacts/${projectId}/from-setup`, {
          method: "POST",
          token,
          body: JSON.stringify({
            ...form,
            matrixKind,
            bothMatrices: form.bothMatrices,
          }),
        });
        const extra = [
          r.directory?.user?.created ? `portal ${r.directory.user.email}${r.directory.user.tempPassword ? ` / ${r.directory.user.tempPassword}` : ""}` : "",
          r.directory?.vendor?.created ? `directory ${r.directory.vendor.name}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        onMsg(extra ? `Added to comms matrix and ${extra}.` : "Added to communication matrix (in-project Comms).");
        await onDirectoryChange?.();
      }
      setForm({
        ...EMPTY_FORM,
        orgSection: form.orgSection,
        orgName: form.orgName,
        bothMatrices: form.bothMatrices,
        createDirectory: form.createDirectory,
        vendorPartyType: partyForSection(form.orgSection),
        userRole: roleForSection(form.orgSection),
      });
      setPickUserId("");
      setPickVendorId("");
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: MatrixContact) {
    setEditingId(row.id);
    setForm({
      ...EMPTY_FORM,
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

  async function deleteContact(rowId: string, name: string) {
    if (!window.confirm(`Remove ${name || "this row"} from the ${matrixKind} matrix?`)) return;
    setBusy(true);
    try {
      await api(`/api/comms/contacts/${rowId}`, { method: "DELETE", token });
      if (editingId === rowId) setEditingId(null);
      onMsg("Contact removed from comms.");
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function importDirectory() {
    setBusy(true);
    try {
      const r = await api<{ created: number; skipped: number }>(`/api/comms/contacts/${projectId}/sync-from-directory`, {
        method: "POST",
        token,
      });
      onMsg(`Directory imported — ${r.created} new rows, ${r.skipped} already on the matrix.`);
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const peopleRows = useMemo(() => contacts.filter((c) => !c.isSectionHeader), [contacts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Communication matrix</h3>
          <p className="text-xs text-steel-muted mt-0.5 max-w-2xl">
            Same BPCL fields as the Excel (Name, Designation, Company, SPOC, Mobile, E-mail, TO/CC, Office). None are
            required to launch. You can keep editing this matrix in project Comms. Adding a row with a directory option also
            creates the user or vendor and assigns them to this project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void importDirectory()}>
            Import assigned directory
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(["TECHNICAL", "COMMERCIAL"] as const).map((k) => (
          <Button key={k} type="button" variant={matrixKind === k ? "primary" : "secondary"} onClick={() => setMatrixKind(k)}>
            {k === "TECHNICAL" ? `Technical (${counts.technical})` : `Commercial (${counts.commercial})`}
          </Button>
        ))}
      </div>

      {canEdit && (
        <Card className="!p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-sm">{editingId ? "Edit matrix row" : "Add person to matrix"}</h4>
            {editingId && (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
                Cancel edit
              </Button>
            )}
          </div>
          {!editingId && (
            <div className="grid sm:grid-cols-2 gap-2">
              <SearchableSelect
                options={users.map((u) => ({ value: u.id, label: u.fullName, sublabel: `${u.email} · ${u.role}` }))}
                value={pickUserId}
                onChange={applyUser}
                placeholder="Prefill from People directory…"
                searchPlaceholder="Search people…"
              />
              <SearchableSelect
                options={vendors.map((v) => ({ value: v.id, label: v.name, sublabel: [v.partyType, v.email].filter(Boolean).join(" · ") }))}
                value={pickVendorId}
                onChange={applyVendor}
                placeholder="Prefill from Clients / Vendors / Stakeholders…"
                searchPlaceholder="Search companies…"
              />
            </div>
          )}
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => void submitRow(e)}>
            <Select value={form.orgSection} onChange={(e) => setForm({ ...form, orgSection: e.target.value })}>
              {ORG_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input placeholder="Organisation (optional)" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
            <Input placeholder="Name (optional)" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} />
            <Input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            <Input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input placeholder="SPOC" value={form.spoc} onChange={(e) => setForm({ ...form, spoc: e.target.value })} />
            <Input placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            <Input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Select value={form.mailRole} onChange={(e) => setForm({ ...form, mailRole: e.target.value })}>
              <option value="TO">TO</option>
              <option value="CC">CC</option>
            </Select>
            <Input className="sm:col-span-2" placeholder="Office address" value={form.officeAddress} onChange={(e) => setForm({ ...form, officeAddress: e.target.value })} />
            {!editingId && (
              <>
                <label className="flex items-center gap-2 text-xs text-steel-muted sm:col-span-2 lg:col-span-3">
                  <input type="checkbox" checked={form.bothMatrices} onChange={(e) => setForm({ ...form, bothMatrices: e.target.checked })} />
                  Add to both Technical and Commercial
                </label>
                <Select value={form.createDirectory} onChange={(e) => setForm({ ...form, createDirectory: e.target.value as typeof form.createDirectory })}>
                  <option value="none">Matrix only — do not create login</option>
                  <option value="user">Also create / assign portal user</option>
                  <option value="vendor">Also create / assign company in directory</option>
                  <option value="both">User + company in directory</option>
                </Select>
                {(form.createDirectory === "user" || form.createDirectory === "both") && (
                  <Select value={form.userRole} onChange={(e) => setForm({ ...form, userRole: e.target.value })}>
                    <option value="client">Client portal</option>
                    <option value="vendor">Contractor portal</option>
                    <option value="site_employee">Site engineer</option>
                    <option value="office">Office</option>
                    <option value="employee">Employee / consultant</option>
                  </Select>
                )}
                {(form.createDirectory === "vendor" || form.createDirectory === "both") && (
                  <Select value={form.vendorPartyType} onChange={(e) => setForm({ ...form, vendorPartyType: e.target.value })}>
                    <option value="Client">Client</option>
                    <option value="Consultant">Consultant</option>
                    <option value="PMC">PMC</option>
                    <option value="Contractor">Contractor</option>
                    <option value="Vendor">Vendor / supplier</option>
                    <option value="Designer">Designer</option>
                  </Select>
                )}
              </>
            )}
            <Button type="submit" className="sm:col-span-2 lg:col-span-3" disabled={busy}>
              {editingId ? "Save row" : "Add to communication matrix"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="!bg-procore-navy !text-white !border-0">
        <div className="font-display text-lg">{matrixKind} Communication Matrix</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-white/80 mt-2">
          <div>{project?.name || "—"}</div>
          <div>{project?.clientName || "—"}</div>
          <div>{project?.designConsultant || "—"}</div>
          <div>{project?.pmcName || "Sharnam Project Development Consultants & Co."}</div>
        </div>
      </Card>

      <Card padding={false} className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white flex justify-between gap-2">
          <span>{formatUiText(`${matrixKind} contact register`)}</span>
          <span className="text-[11px] font-normal text-white/70">{peopleRows.length} people</span>
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
                  Sections will appear after the first save. Add Client, PMC, Consultant, and Contractor rows above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

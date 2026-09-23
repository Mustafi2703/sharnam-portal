import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { downloadAuthFile } from "../lib/downloadReport";
import { Badge, Button, Card } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import type { MatrixContact } from "./CommsMatrixPanel";
import {
  EMPTY_MATRIX_FORM,
  MatrixPartyFields,
  partyForSection,
  roleForSection,
  type MatrixFormState,
  type MatrixUser,
  type MatrixVendor,
} from "./MatrixPartyFields";

type AssignedVendor = { vendorId: string; partyType?: string; name?: string };

type Props = {
  projectId: string;
  token: string;
  project?: {
    name?: string;
    clientName?: string | null;
    clientEmail?: string | null;
    clientContactName?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    designConsultant?: string | null;
    contractorName?: string | null;
    pmcName?: string | null;
  } | null;
  users: MatrixUser[];
  vendors: MatrixVendor[];
  assignedVendors?: AssignedVendor[];
  canEdit: boolean;
  onMsg: (msg: string) => void;
  onDirectoryChange?: () => Promise<void>;
};

export function ProjectSetupMatrixDesk({
  projectId,
  token,
  project,
  users,
  vendors,
  assignedVendors,
  canEdit,
  onMsg,
  onDirectoryChange,
}: Props) {
  const [matrixKind, setMatrixKind] = useState<"TECHNICAL" | "COMMERCIAL">("TECHNICAL");
  const [deskTab, setDeskTab] = useState<"edit" | "export">("edit");
  const [contacts, setContacts] = useState<MatrixContact[]>([]);
  const [counts, setCounts] = useState({ technical: 0, commercial: 0 });
  const [form, setForm] = useState<MatrixFormState>(EMPTY_MATRIX_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await api(`/api/comms/contacts/${projectId}/sync-from-directory`, { method: "POST", token }).catch(() => null);
    const [tech, comm] = await Promise.all([
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=TECHNICAL`, { token }).catch(() => []),
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=COMMERCIAL`, { token }).catch(() => []),
    ]);
    const people = (rows: MatrixContact[]) => rows.filter((r) => !r.isSectionHeader).length;
    setCounts({ technical: people(tech), commercial: people(comm) });
    setContacts(matrixKind === "COMMERCIAL" ? comm : tech);
  }, [projectId, token, matrixKind]);

  useEffect(() => {
    void load();
  }, [load]);

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
            createDirectory: "none",
            orgName: form.orgName || form.company,
          }),
        });
        const extra = [
          r.directory?.user?.created ? `portal ${r.directory.user.email}` : "",
          r.directory?.vendor?.created ? `directory ${r.directory.vendor.name}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        onMsg(extra ? `Added to comms matrix and ${extra}.` : `Added to ${matrixKind === "COMMERCIAL" ? "commercial" : "technical"} matrix.`);
        await onDirectoryChange?.();
      }
      setForm({
        ...EMPTY_MATRIX_FORM,
        orgSection: form.orgSection,
        bothMatrices: form.bothMatrices,
        vendorPartyType: partyForSection(form.orgSection),
        userRole: roleForSection(form.orgSection),
        mailRole: form.orgSection === "Client" ? "TO" : "CC",
      });
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

  async function exportMatrix(kind: "TECHNICAL" | "COMMERCIAL", format: "xlsx" | "html") {
    setBusy(true);
    try {
      if (format === "xlsx") {
        await downloadAuthFile(
          `/api/comms/contacts/${projectId}/export.xlsx?kind=${kind}`,
          token,
          `${projectId}-matrix-${kind.toLowerCase()}.xlsx`,
        );
        onMsg(`${kind === "TECHNICAL" ? "Technical" : "Commercial"} matrix downloaded as Excel.`);
      } else {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || ""}/api/comms/contacts/${projectId}/export.html?kind=${kind}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        if (!res.ok) throw new Error("Export failed");
        const html = await res.text();
        const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
        window.open(url, "_blank", "noopener,noreferrer");
        onMsg("Print view opened — use the browser Print dialog to save as PDF.");
      }
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Communication matrix</h3>
          <p className="text-xs text-steel-muted mt-0.5 max-w-2xl">
            Technical and commercial sheets fill from the project card — client, PMC, consultants, vendors, and SPDC staff.
            Delete leftover seed rows, then pick the live companies. New companies go on the CRM directories, not here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={deskTab === "edit" ? "primary" : "secondary"} onClick={() => setDeskTab("edit")}>
            Edit matrix
          </Button>
          <Button type="button" variant={deskTab === "export" ? "primary" : "secondary"} onClick={() => setDeskTab("export")}>
            Export
          </Button>
          {deskTab === "edit" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void importDirectory()}>
              Import assigned directory
            </Button>
          ) : null}
        </div>
      </div>

      {deskTab === "export" ? (
        <Card className="!p-5 space-y-4">
          <div>
            <h4 className="font-semibold text-sm">Export communication matrix</h4>
            <p className="text-xs text-steel-muted mt-1 max-w-2xl leading-relaxed">
              Download the BPCL-style sheets for sharing or printing. Exports use the contacts saved on this project — update the matrix on
              the Edit tab first if anything changed.
            </p>
          </div>
          {(["TECHNICAL", "COMMERCIAL"] as const).map((kind) => (
            <div key={kind} className="rounded-xl border border-line bg-sand/30 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-sm">
                  {kind === "TECHNICAL" ? "Technical matrix" : "Commercial matrix"}
                </span>
                <Badge tone="neutral">{kind === "TECHNICAL" ? counts.technical : counts.commercial} people</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void exportMatrix(kind, "xlsx")}>
                  Download Excel
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void exportMatrix(kind, "html")}>
                  Open for print / PDF
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <>
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_MATRIX_FORM);
                }}
              >
                Cancel edit
              </Button>
            )}
          </div>
          <form className="space-y-3" onSubmit={(e) => void submitRow(e)}>
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
              onDirectoryChange={onDirectoryChange}
              allowCreateCompany={false}
            />
            {!editingId && (
              <label className="flex items-center gap-2 text-xs text-steel-muted">
                <input type="checkbox" checked={form.bothMatrices} onChange={(e) => setForm({ ...form, bothMatrices: e.target.checked })} />
                Add to both Technical and Commercial
              </label>
            )}
            <Button type="submit" disabled={busy}>
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
        </>
      )}
    </div>
  );
}

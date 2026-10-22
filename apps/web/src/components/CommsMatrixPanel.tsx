import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import { downloadAuthFile } from "../lib/downloadReport";
import { useClientLogo } from "../lib/useClientLogo";
import { matrixSubtitle } from "./MatrixOnboard";
import { MatrixBlocksTable, MatrixCompanyEditor, clearMatrixPeople, deleteMatrixCompanyBlock } from "./MatrixBlocksTable";
import type { MatrixBlock } from "@sharnam/shared";
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
    clientLogoUrl?: string | null;
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
  const [companyBlock, setCompanyBlock] = useState<MatrixBlock<MatrixContact & { id: string }> | null>(null);
  const [lockedSection, setLockedSection] = useState(false);

  function addPersonTo(block: MatrixBlock) {
    setEditingId(null);
    setLockedSection(true);
    setForm({
      ...EMPTY_MATRIX_FORM,
      bothMatrices: false,
      orgSection: block.orgSection,
      company: block.company,
      orgName: block.company,
      mailRole: "CC",
      vendorPartyType: partyForSection(block.orgSection),
      userRole: roleForSection(block.orgSection),
    });
    document.getElementById("matrix-add-person")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const clientLogoSrc = useClientLogo(projectId, project?.clientLogoUrl, token);

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
      setLockedSection(false);
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
      lockSection={lockedSection && !editingId}
      hideManualFields
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
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void downloadAuthFile(
              `/api/comms/contacts/${projectId}/export.xlsx?kind=${matrixKind}`,
              token,
              `${projectId}-matrix-${matrixKind.toLowerCase()}.xlsx`,
            )
          }
        >
          Export Excel
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ sharePointUrl?: string | null; message?: string }>(
                `/api/comms/contacts/${projectId}/sharepoint-link`,
                { method: "POST", token, timeoutMs: 120_000, body: JSON.stringify({ kind: matrixKind, file: "xlsx", refresh: true }) },
              );
              if (!r.sharePointUrl) throw new Error(r.message || "SharePoint link is not ready");
              window.open(r.sharePointUrl, "_blank", "noopener,noreferrer");
              onMsg("Opened the matrix Excel in SharePoint. The PDF is filed in the same folder.");
            } catch (err) {
              onMsg(err instanceof Error ? err.message : "Could not open SharePoint");
            } finally {
              setBusy(false);
            }
          }}
        >
          Open Excel in SharePoint
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ sharePointUrl?: string | null; message?: string }>(
                `/api/comms/contacts/${projectId}/sharepoint-link`,
                { method: "POST", token, timeoutMs: 120_000, body: JSON.stringify({ kind: matrixKind, file: "pdf" }) },
              );
              if (!r.sharePointUrl) throw new Error(r.message || "SharePoint link is not ready");
              window.open(r.sharePointUrl, "_blank", "noopener,noreferrer");
              onMsg("Opened the matrix PDF in SharePoint.");
            } catch (err) {
              onMsg(err instanceof Error ? err.message : "Could not open SharePoint");
            } finally {
              setBusy(false);
            }
          }}
        >
          Open PDF in SharePoint
        </Button>
      </div>

      <Card className="!p-4 border border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <img src="/logo-transparent.png" alt="SPDC" className="h-12 w-auto object-contain" />
          <div className="text-center flex-1 min-w-[180px]">
            <div className="font-display text-lg text-ink uppercase tracking-wide">{matrixKind} Communication Matrix</div>
            <div className="text-xs text-steel-muted mt-1">
              <span data-preserve-case>{matrixSubtitle(project)}</span>
            </div>
          </div>
          {clientLogoSrc ? (
            <img src={clientLogoSrc} alt="Client" className="h-12 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="text-[11px] text-steel-muted w-[140px] text-right">{formatUiText("Upload client logo on the project card")}</span>
          )}
        </div>
      </Card>

      {editingId && canEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold text-sm">Edit matrix row</h3>
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => setEditingId(null)}>
                Close
              </Button>
            </div>
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
        </div>
      )}

      {canEdit && !editingId && (
        <Card id="matrix-add-person">
          <h3 className="font-semibold text-sm mb-1">Add contact</h3>
          <p className="text-[11px] text-steel-muted mb-3">
            Names added on the CRM company (client, consultant, PMC, vendor) are in the name list for that party. Missing a company? Add it here — you stay on this matrix.
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

      <MatrixBlocksTable
        contacts={contacts}
        matrixKind={matrixKind}
        canEdit={canEdit}
        busy={busy}
        onDeleteCompany={async (block) => {
          setBusy(true);
          try {
            const msg = await deleteMatrixCompanyBlock({ projectId, token, matrixKind, block });
            if (msg) {
              onMsg(msg);
              await onReload();
            }
          } catch (err) {
            onMsg(err instanceof Error ? err.message : "Could not delete the company");
          } finally {
            setBusy(false);
          }
        }}
        onClearPeople={async () => {
          setBusy(true);
          try {
            const msg = await clearMatrixPeople({ projectId, token, matrixKind });
            if (msg) {
              onMsg(msg);
              await onReload();
            }
          } catch (err) {
            onMsg(err instanceof Error ? err.message : "Could not clear the matrix");
          } finally {
            setBusy(false);
          }
        }}
        onEditPerson={startEdit}
        onDeleteRow={(id, label) => void deleteContact(id, label)}
        onEditCompany={setCompanyBlock}
        onAddPerson={addPersonTo}
        emptyText="No rows — import the project directory or add a Client / Consultant / Contractor above."
      />
      {companyBlock ? (
        <MatrixCompanyEditor
          key={companyBlock.key}
          projectId={projectId}
          token={token}
          matrixKind={matrixKind}
          block={companyBlock}
          onClose={() => setCompanyBlock(null)}
          onSaved={onReload}
          onMsg={onMsg}
        />
      ) : null}
    </div>
  );
}

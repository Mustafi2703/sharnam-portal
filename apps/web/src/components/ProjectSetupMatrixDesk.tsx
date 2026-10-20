import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { downloadAuthFile } from "../lib/downloadReport";
import { useClientLogo } from "../lib/useClientLogo";
import { matrixSubtitle, useMatrixPortalStatus } from "./MatrixOnboard";
import { MatrixBlocksTable, MatrixCompanyEditor } from "./MatrixBlocksTable";
import type { MatrixBlock } from "@sharnam/shared";
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
    clientLogoUrl?: string | null;
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
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [contacts, setContacts] = useState<MatrixContact[]>([]);
  const [counts, setCounts] = useState({ technical: 0, commercial: 0 });
  const [form, setForm] = useState<MatrixFormState>(EMPTY_MATRIX_FORM);
  const [editForm, setEditForm] = useState<MatrixFormState>(EMPTY_MATRIX_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientLogoSrc = useClientLogo(projectId, project?.clientLogoUrl, token);
  const portal = useMatrixPortalStatus(projectId, token, canEdit);
  const { reloadStatus } = portal;
  const [companyBlock, setCompanyBlock] = useState<MatrixBlock<MatrixContact & { id: string }> | null>(null);

  function addPersonTo(block: MatrixBlock) {
    setEditingId(null);
    setForm({
      ...EMPTY_MATRIX_FORM,
      bothMatrices: form.bothMatrices,
      orgSection: block.orgSection,
      company: block.company,
      orgName: block.company,
      mailRole: "CC",
      vendorPartyType: partyForSection(block.orgSection),
      userRole: roleForSection(block.orgSection),
    });
    document.getElementById("matrix-add-person")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const load = useCallback(async () => {
    void reloadStatus();
    const [tech, comm] = await Promise.all([
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=TECHNICAL`, { token }).catch(() => []),
      api<MatrixContact[]>(`/api/comms/contacts/${projectId}?kind=COMMERCIAL`, { token }).catch(() => []),
    ]);
    const people = (rows: MatrixContact[]) => rows.filter((r) => !r.isSectionHeader).length;
    setCounts({ technical: people(tech), commercial: people(comm) });
    setContacts(matrixKind === "COMMERCIAL" ? comm : tech);
  }, [projectId, token, matrixKind, reloadStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRow(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
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
    setEditForm({
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
          orgSection: editForm.orgSection,
          orgName: editForm.orgName || editForm.company,
          personName: editForm.personName,
          designation: editForm.designation,
          company: editForm.company,
          spoc: editForm.spoc,
          mobile: editForm.mobile,
          email: editForm.email,
          mailRole: editForm.mailRole,
          officeAddress: editForm.officeAddress,
        }),
      });
      setEditingId(null);
      onMsg("Contact updated.");
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not update contact");
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

  async function openSharePoint(kind: "TECHNICAL" | "COMMERCIAL", file: "xlsx" | "pdf" = "xlsx") {
    setBusy(true);
    try {
      const r = await api<{ sharePointUrl?: string | null; message?: string }>(
        `/api/comms/contacts/${projectId}/sharepoint-link`,
        { method: "POST", token, timeoutMs: 120_000, body: JSON.stringify({ kind, file, refresh: file === "xlsx" }) },
      );
      if (!r.sharePointUrl) throw new Error(r.message || "SharePoint link is not ready");
      window.open(r.sharePointUrl, "_blank", "noopener,noreferrer");
      onMsg(file === "pdf" ? "Opened the matrix PDF in SharePoint." : "Opened the matrix Excel in SharePoint. The PDF is filed in the same folder.");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not open SharePoint");
    } finally {
      setBusy(false);
    }
  }

  async function previewMatrix(kind: "TECHNICAL" | "COMMERCIAL") {
    setBusy(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/api/comms/contacts/${projectId}/export.html?kind=${kind}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!res.ok) throw new Error("Preview failed");
      const html = await res.text();
      setPreviewTitle(kind === "TECHNICAL" ? "Technical matrix" : "Commercial matrix");
      setPreviewHtml(html);
      onMsg(`${kind === "TECHNICAL" ? "Technical" : "Commercial"} matrix preview opened.`);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

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
          <Button type="button" disabled={busy} onClick={() => void openSharePoint(matrixKind)}>
            Open Excel in SharePoint
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void previewMatrix(matrixKind)}>
            Preview
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
              Excel and PDF use the Sharnam logo and the client logo, landscape layout, BPCL columns. Open Excel in SharePoint replaces the filed copy with the current sheet.
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
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void previewMatrix(kind)}>
                  Preview
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void exportMatrix(kind, "xlsx")}>
                  Download Excel
                </Button>
                <Button type="button" disabled={busy} onClick={() => void openSharePoint(kind, "xlsx")}>
                  Open Excel in SharePoint
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void openSharePoint(kind, "pdf")}>
                  Open PDF in SharePoint
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
        <Card id="matrix-add-person" className="!p-4 space-y-3">
          <h4 className="font-semibold text-sm">Add person to matrix</h4>
          <p className="text-[11px] text-steel-muted">
            Use this form only to add someone extra. To change an existing row, click Edit on that contact.
          </p>
          <form className="space-y-3" onSubmit={(e) => void submitRow(e)}>
            <MatrixPartyFields
              form={form}
              onChange={setForm}
              users={users}
              vendors={vendors}
              assignedVendors={assignedVendors}
              project={project}
              projectId={projectId}
              token={token}
              editing={false}
              onMsg={onMsg}
              onDirectoryChange={onDirectoryChange}
              allowCreateCompany={false}
            />
            <label className="flex items-center gap-2 text-xs text-steel-muted">
              <input type="checkbox" checked={form.bothMatrices} onChange={(e) => setForm({ ...form, bothMatrices: e.target.checked })} />
              Add to both Technical and Commercial
            </label>
            <Button type="submit" disabled={busy}>
              Add to communication matrix
            </Button>
          </form>
        </Card>
      )}

      {editingId && canEdit ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold text-sm">Edit contact</h3>
                <p className="text-[11px] text-steel-muted">{editForm.personName || editForm.email || "Matrix row"}</p>
              </div>
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => setEditingId(null)}>
                Close
              </Button>
            </div>
            <form className="space-y-3" onSubmit={(e) => void saveEdit(e)}>
              <MatrixPartyFields
                key={editingId}
                form={editForm}
                onChange={setEditForm}
                users={users}
                vendors={vendors}
                assignedVendors={assignedVendors}
                project={project}
                projectId={projectId}
                token={token}
                editing
                onMsg={onMsg}
                onDirectoryChange={onDirectoryChange}
                allowCreateCompany={false}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  Save contact
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <Card className="!p-4 border border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <img src="/logo-transparent.png" alt="SPDC" className="h-12 w-auto object-contain" />
          <div className="text-center flex-1 min-w-[180px]">
            <div className="font-display text-lg text-ink">{matrixKind} Communication Matrix</div>
            <div className="text-xs text-steel-muted mt-1">
              <span data-preserve-case>{matrixSubtitle(project)}</span>
            </div>
          </div>
          {clientLogoSrc ? (
            <img src={clientLogoSrc} alt="Client" className="h-12 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="text-[11px] text-steel-muted w-[140px] text-right">Upload client logo on the project card</span>
          )}
        </div>
      </Card>

      <MatrixBlocksTable
        contacts={contacts}
        matrixKind={matrixKind}
        canEdit={canEdit}
        busy={busy}
        portal={portal}
        onEditPerson={startEdit}
        onDeleteRow={(id, label) => void deleteContact(id, label)}
        onEditCompany={setCompanyBlock}
        onAddPerson={addPersonTo}
        emptyText="Sections will appear after the first save. Add Client, PMC, Consultant, and Contractor people above."
      />
      {companyBlock ? (
        <MatrixCompanyEditor
          key={companyBlock.key}
          projectId={projectId}
          token={token}
          matrixKind={matrixKind}
          block={companyBlock}
          onClose={() => setCompanyBlock(null)}
          onSaved={load}
          onMsg={onMsg}
        />
      ) : null}
        </>
      )}

      {previewHtml ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-ink/50 backdrop-blur-sm p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mx-auto flex h-full w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{previewTitle} · Preview</div>
                <p className="text-[11px] text-steel-muted">Landscape BPCL layout with Sharnam and client logos</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  Print / Save PDF
                </Button>
                <Button type="button" onClick={() => setPreviewHtml(null)}>
                  Close
                </Button>
              </div>
            </div>
            <iframe title={previewTitle} srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white min-h-0" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

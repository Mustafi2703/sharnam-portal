import { FormEvent, useMemo, useState } from "react";
import { buildMatrixBlocks, matrixBlockRows, type MatrixBlock } from "@sharnam/shared";
import { api } from "../api";
import { Badge, Button, Card, Input, TextArea } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import type { MatrixContact } from "./CommsMatrixPanel";
import { PortalStateCell, useMatrixPortalStatus } from "./MatrixOnboard";

type Block = MatrixBlock<MatrixContact & { id: string }>;

type Props = {
  contacts: MatrixContact[];
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  canEdit: boolean;
  busy: boolean;
  portal: ReturnType<typeof useMatrixPortalStatus>;
  onEditPerson: (row: MatrixContact) => void;
  onDeleteRow: (rowId: string, label: string) => void;
  onEditCompany: (block: Block) => void;
  onAddPerson: (block: Block) => void;
  emptyText: string;
};

const COLS = 9;

/** BPCL layout: one lettered row per company; company, SPOC and office address merged down that company's people. */
export function MatrixBlocksTable({ contacts, matrixKind, canEdit, busy, portal, onEditPerson, onDeleteRow, onEditCompany, onAddPerson, emptyText }: Props) {
  const blocks = useMemo(() => buildMatrixBlocks(contacts as (MatrixContact & { id: string })[], { keepEmpty: true }), [contacts]);
  const people = blocks.reduce((n, b) => n + b.people.length, 0);
  const width = COLS + (canEdit ? 2 : 0);

  return (
    <Card padding={false} className="overflow-x-auto">
      <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white flex justify-between gap-2">
        <span>{formatUiText(`${matrixKind} contact register`)}</span>
        <span className="text-[11px] font-normal text-white/70">
          {blocks.length} {formatUiText("companies")} · {people} {formatUiText("people")}
        </span>
      </div>
      <table className="w-full text-sm min-w-[1100px] border-collapse">
        <thead className="bg-sand text-left text-[10px] uppercase tracking-wider text-steel-muted sticky top-0">
          <tr>
            <th className="p-3">SR.NO</th>
            <th className="p-3">NAME</th>
            <th className="p-3">DESIGNATION</th>
            <th className="p-3 text-center">NAME OF COMPANY</th>
            <th className="p-3 text-center">SINGLE POINT OF CONTACT</th>
            <th className="p-3">MOBILE</th>
            <th className="p-3">E-MAIL</th>
            <th className="p-3 text-center">GENERAL MAIL COMMUNICATION</th>
            <th className="p-3">OFFICE ADD.</th>
            {canEdit && <th className="p-3">PORTAL</th>}
            {canEdit && <th className="p-3 w-28">Actions</th>}
          </tr>
        </thead>
        {blocks.map((block) => {
          const rows = matrixBlockRows(block);
          const extras = block.people.length ? block.placeholders : [];
          const span = rows.length + extras.length;
          const companyCell = (
            <>
              <td rowSpan={span} className="p-3 text-center font-semibold border-x border-line align-middle" data-preserve-case>
                {block.company}
              </td>
              <td rowSpan={span} className="p-3 text-center text-xs whitespace-pre-line border-x border-line align-middle" data-preserve-case>
                {block.spoc || "—"}
                {canEdit && !block.spocIsSet && block.spoc ? (
                  <div className="mt-1 text-[10px] font-normal text-amber-700">{formatUiText("not set · showing TO people")}</div>
                ) : null}
              </td>
            </>
          );
          const addressCell = (
            <td rowSpan={span} className="p-3 text-xs text-steel-muted whitespace-pre-line max-w-[200px] border-x border-line align-middle" data-preserve-case>
              {block.officeAddress || "—"}
            </td>
          );
          return (
            <tbody key={block.key} className="border-t-2 border-line">
              <tr className="bg-brand-soft/80">
                <td className="p-3 font-mono font-semibold text-brand">{block.letter}</td>
                <td className="p-3 font-semibold text-ink uppercase" colSpan={canEdit ? width - 2 : width - 1} data-preserve-case>
                  {block.company}
                  <span className="ml-2 text-[10px] font-normal normal-case text-steel-muted">{block.orgSection}</span>
                </td>
                {canEdit && (
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <Button type="button" className="!text-xs !py-1" disabled={busy} onClick={() => onEditCompany(block)}>
                        Edit company
                      </Button>
                      <Button type="button" variant="secondary" className="!text-xs !py-1" disabled={busy} onClick={() => onAddPerson(block)}>
                        Add person
                      </Button>
                      {!block.people.length && !block.placeholders.length && block.headerId ? (
                        <Button type="button" variant="secondary" className="!text-xs !py-1" disabled={busy} onClick={() => onDeleteRow(block.headerId!, block.company)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                )}
              </tr>
              {rows.map((r, i) => (
                <tr key={r?.id || `${block.key}-empty`} className="border-t border-line hover:bg-sand/40">
                  <td className="p-3 font-mono text-xs text-steel-muted">{i + 1}</td>
                  <td className="p-3 font-medium whitespace-pre-line" data-preserve-case>
                    {r ? r.personName || "—" : <span className="text-steel-muted font-normal">{formatUiText("no people yet")}</span>}
                  </td>
                  <td className="p-3" data-preserve-case>{r?.designation || "—"}</td>
                  {i === 0 ? companyCell : null}
                  <td className="p-3 font-mono text-xs">{r?.mobile || "—"}</td>
                  <td className="p-3 text-xs break-all" data-preserve-case>{r?.email || "—"}</td>
                  <td className="p-3 text-center">{r ? <Badge tone={r.mailRole === "TO" ? "brand" : "neutral"}>{r.mailRole || "—"}</Badge> : null}</td>
                  {i === 0 ? addressCell : null}
                  {canEdit && <td className="p-3">{r ? <PortalStateCell row={r} state={portal.stateOf(r)} /> : null}</td>}
                  {canEdit && (
                    <td className="p-3">
                      {r ? (
                        <div className="flex flex-col gap-1">
                          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => onEditPerson(r)}>
                            Edit
                          </Button>
                          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => onDeleteRow(r.id, r.personName || "")}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))}
              {extras.map((r) => (
                <tr key={r.id} className="border-t border-line bg-sand/30 text-steel-muted">
                  <td className="p-3 text-xs">—</td>
                  <td className="p-3 text-xs italic" colSpan={2}>
                    {formatUiText("company-only row — edit it to name the person, or delete it")}
                  </td>
                  <td className="p-3" colSpan={3} />
                  {canEdit && <td className="p-3" />}
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => onEditPerson(r)}>
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => onDeleteRow(r.id, `${block.company} (company-only row)`)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          );
        })}
        {!blocks.length && (
          <tbody>
            <tr>
              <td colSpan={width} className="p-8 text-center text-steel-muted text-sm">
                {emptyText}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </Card>
  );
}

/** Edit the company-wide fields of one block: name, single point of contact, office address. */
export function MatrixCompanyEditor({
  projectId,
  token,
  matrixKind,
  block,
  onClose,
  onSaved,
  onMsg,
}: {
  projectId: string;
  token: string;
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  block: Block;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onMsg: (m: string) => void;
}) {
  const [name, setName] = useState(block.company);
  const [spoc, setSpoc] = useState(block.spocIsSet ? block.spoc : "");
  const [address, setAddress] = useState(block.officeAddress);
  const [both, setBoth] = useState(true);
  const [busy, setBusy] = useState(false);

  const addSpoc = (person: string, note: string) =>
    setSpoc((cur) => [cur.trim(), note ? `${person}\n(${note})` : person].filter(Boolean).join("\n\n"));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/comms/contacts/${projectId}/company`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          matrixKind,
          bothMatrices: both,
          orgSection: block.orgSection,
          company: block.company,
          newCompany: name.trim() && name.trim() !== block.company ? name.trim() : undefined,
          spoc,
          officeAddress: address,
        }),
      });
      onMsg(`${name.trim() || block.company} updated${both ? " on both matrices" : ""}.`);
      await onSaved();
      onClose();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not save the company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold text-sm">
              {formatUiText("edit company")} · {block.letter}
            </h3>
            <p className="text-[11px] text-steel-muted">{formatUiText("applies to every person row of this company")}</p>
          </div>
          <Button type="button" variant="secondary" className="!text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
        <form className="space-y-3" onSubmit={(e) => void save(e)}>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Name of company</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-preserve-case />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Single point of contact</span>
            <TextArea rows={5} value={spoc} onChange={(e) => setSpoc(e.target.value)} placeholder={"Mr. A\n(HO Discussion)\n\nMr. B\n(Site Discussion)"} data-preserve-case />
          </label>
          {block.people.length ? (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-steel-muted">{formatUiText("add from this company")}:</span>
              {block.people.map((p) => (
                <span key={p.id} className="inline-flex gap-1">
                  <button type="button" className="rounded-full border border-line px-2 py-0.5 hover:bg-sand" onClick={() => addSpoc(p.personName || "", "")} data-preserve-case>
                    {p.personName}
                  </button>
                  <button type="button" className="rounded-full border border-line px-2 py-0.5 hover:bg-sand" onClick={() => addSpoc(p.personName || "", "HO Discussion")}>
                    HO
                  </button>
                  <button type="button" className="rounded-full border border-line px-2 py-0.5 hover:bg-sand" onClick={() => addSpoc(p.personName || "", "Site Discussion")}>
                    Site
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Office address</span>
            <TextArea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} data-preserve-case />
          </label>
          <label className="flex items-center gap-2 text-xs text-steel-muted">
            <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} />
            Apply to both Technical and Commercial
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save company
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

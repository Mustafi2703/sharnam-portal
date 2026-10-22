import { FormEvent, useMemo, useState } from "react";
import { buildMatrixBlocks, matrixBlockRows, type MatrixBlock } from "@sharnam/shared";
import { api } from "../api";
import { Button, Card, Input, TextArea } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import type { MatrixContact } from "./CommsMatrixPanel";

type Block = MatrixBlock<MatrixContact & { id: string }>;

type Props = {
  contacts: MatrixContact[];
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  canEdit: boolean;
  busy: boolean;
  onEditPerson: (row: MatrixContact) => void;
  onDeleteRow: (rowId: string, label: string) => void;
  onEditCompany: (block: Block) => void;
  onAddPerson: (block: Block) => void;
  onDeleteCompany: (block: Block) => void;
  onClearPeople?: () => void;
  emptyText: string;
};

/** BPCL Communication Matrix_BPCL (2).xlsx column widths, A–I. */
const SHEET_WIDTHS = [10.8, 27.1, 27.8, 23.3, 24.3, 25.3, 37.7, 31, 30.3];
const SHEET_TOTAL = SHEET_WIDTHS.reduce((a, b) => a + b, 0);
const HEADERS = ["SR.NO", "NAME", "DESIGNATION", "NAME OF COMPANY", "SINGLE POINT OF CONTACT", "MOBILE", "E-MAIL", "GENERAL MAIL COMMUNICATION", "OFFICE ADD."];
const GRID = "border border-[#445469]";
const CELL = `${GRID} px-2 py-2 align-middle font-semibold text-[13px] text-[#111]`;

/** Sheet-style BPCL matrix: one lettered row per company; company, SPOC and office address merged down that company's people. */
export function MatrixBlocksTable({ contacts, matrixKind, canEdit, busy, onEditPerson, onDeleteRow, onEditCompany, onAddPerson, onDeleteCompany, onClearPeople, emptyText }: Props) {
  const blocks = useMemo(() => buildMatrixBlocks(contacts as (MatrixContact & { id: string })[], { keepEmpty: true }), [contacts]);
  const people = blocks.reduce((n, b) => n + b.people.length, 0);
  const width = HEADERS.length + (canEdit ? 1 : 0);

  return (
    <Card padding={false} className="overflow-x-auto">
      <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white flex justify-between gap-2">
        <span>{formatUiText(`${matrixKind} contact register`)}</span>
        <span className="flex items-center gap-3 text-[11px] font-normal text-white/70">
          {blocks.length} {formatUiText("companies")} · {people} {formatUiText("people")}
          {canEdit && onClearPeople ? (
            <button type="button" disabled={busy} className="rounded border border-white/40 px-2 py-0.5 text-white hover:bg-white/10 disabled:opacity-50" onClick={onClearPeople}>
              {formatUiText("Clear people · keep teams")}
            </button>
          ) : null}
        </span>
      </div>
      <table className="w-full min-w-[1180px] table-fixed border-collapse bg-white" style={{ fontFamily: "Calibri, 'Segoe UI', system-ui, sans-serif" }}>
        <colgroup>
          {SHEET_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${((w / SHEET_TOTAL) * (canEdit ? 88 : 100)).toFixed(2)}%` }} />
          ))}
          {canEdit ? <col style={{ width: "12%" }} /> : null}
        </colgroup>
        <thead>
          <tr>
            {HEADERS.map((h) => (
              <th key={h} className={`${GRID} bg-[#445469] px-2 py-3 text-center text-[12px] font-bold uppercase leading-tight text-white`}>
                {h}
              </th>
            ))}
            {canEdit ? <th className="border border-line bg-sand px-2 py-3 text-[11px] font-semibold text-steel-muted">Actions</th> : null}
          </tr>
        </thead>
        {blocks.map((block) => {
          const rows = matrixBlockRows(block);
          const span = Math.max(rows.length, 1);
          const merged = (value: string, extra = "") => (
            <td rowSpan={span} className={`${CELL} ${extra} whitespace-pre-line`} data-preserve-case>
              {value || ""}
            </td>
          );
          return (
            <tbody key={block.key}>
              <tr className="bg-[#e8eef8]">
                <td className={`${CELL} text-center`}>{block.letter}</td>
                <td className={`${CELL} uppercase`} colSpan={HEADERS.length - 1} data-preserve-case>
                  {block.company}
                </td>
                {canEdit ? (
                  <td className="border border-line px-2 py-1.5 align-middle">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" className="!text-[11px] !py-1 !px-2" disabled={busy} onClick={() => onEditCompany(block)}>
                        Edit
                      </Button>
                      <Button type="button" variant="secondary" className="!text-[11px] !py-1 !px-2" disabled={busy} onClick={() => onAddPerson(block)}>
                        Add Person
                      </Button>
                      <Button type="button" variant="danger" className="!text-[11px] !py-1 !px-2" disabled={busy} onClick={() => onDeleteCompany(block)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
              {rows.map((r, i) => (
                <tr key={r?.id || `${block.key}-empty`} className="hover:bg-sand/40">
                  <td className={`${CELL} text-center`}>{i + 1}</td>
                  <td className={`${CELL} whitespace-pre-line`} data-preserve-case>
                    {r?.personName || ""}
                  </td>
                  <td className={CELL} data-preserve-case>{r?.designation || ""}</td>
                  {i === 0 ? merged(block.company, "text-center") : null}
                  {i === 0 ? merged(block.spoc, "text-center") : null}
                  <td className={CELL}>{r?.mobile || ""}</td>
                  <td className={`${CELL} break-all text-[#0563c1]`} data-preserve-case>{r?.email || ""}</td>
                  <td className={`${CELL} text-center`}>{r?.mailRole || ""}</td>
                  {i === 0 ? merged(block.officeAddress, "text-[12px]") : null}
                  {canEdit ? (
                    <td className="border border-line px-2 py-1.5 align-middle">
                      {r ? (
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" variant="secondary" className="!text-[11px] !py-1 !px-2" disabled={busy} onClick={() => onEditPerson(r)}>
                            Edit
                          </Button>
                          <Button type="button" variant="secondary" className="!text-[11px] !py-1 !px-2" disabled={busy} onClick={() => onDeleteRow(r.id, r.personName || "")}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  ) : null}
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

/** Confirm, then delete a company block from this sheet (and optionally the other one). */
export async function deleteMatrixCompanyBlock(opts: {
  projectId: string;
  token: string;
  matrixKind: "TECHNICAL" | "COMMERCIAL";
  block: Block;
}): Promise<string | null> {
  const { projectId, token, matrixKind, block } = opts;
  const count = block.people.length + block.placeholders.length;
  if (!window.confirm(`Delete ${block.company} and its ${count} row(s) from the ${matrixKind} matrix?`)) return null;
  const other = matrixKind === "TECHNICAL" ? "COMMERCIAL" : "TECHNICAL";
  const both = window.confirm(`Also delete ${block.company} from the ${other} matrix?`);
  const r = await api<{ deleted: number }>(`/api/comms/contacts/${projectId}/company/delete`, {
    method: "POST",
    token,
    body: JSON.stringify({ matrixKind, bothMatrices: both, orgSection: block.orgSection, company: block.company }),
  });
  return `${block.company} removed — ${r.deleted} row(s)${both ? " from both matrices" : ""}.`;
}

/** Confirm, then empty the matrix to one row per company (team), removing every person and duplicate row. */
export async function clearMatrixPeople(opts: { projectId: string; token: string; matrixKind: "TECHNICAL" | "COMMERCIAL" }): Promise<string | null> {
  const { projectId, token, matrixKind } = opts;
  if (!window.confirm(`Remove every person from the ${matrixKind} matrix and keep only the company teams?`)) return null;
  const other = matrixKind === "TECHNICAL" ? "COMMERCIAL" : "TECHNICAL";
  const both = window.confirm(`Also clear the ${other} matrix?`);
  const r = await api<{ deleted: number; teams: number }>(`/api/comms/contacts/${projectId}/clear-to-teams`, {
    method: "POST",
    token,
    body: JSON.stringify({ matrixKind, bothMatrices: both }),
  });
  return `Matrix cleared — ${r.deleted} row(s) removed, ${r.teams} team(s) kept${both ? " on both sheets" : ""}.`;
}

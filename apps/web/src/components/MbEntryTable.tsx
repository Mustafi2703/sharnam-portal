/**
 * Measurement book — SPDC MB sheet (cube-style register, inline editable).
 */
import { Fragment, useMemo, useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { formatQty } from "./BoqMonitoringEditor";
import { CostRegisterShell } from "./CostRegisterShell";
import { RegisterSheetCell } from "./RegisterSheetCell";

export type MbRow = {
  id: string;
  packageName: string;
  srNo?: string | null;
  itemCode?: string | null;
  description: string;
  nos1?: number;
  nos2?: number;
  length?: number;
  width?: number;
  height?: number;
  qty?: number;
  unit?: string | null;
  raBill?: string | null;
  remark?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  rows: MbRow[];
  singlePackage?: string;
  canFullEdit: boolean;
  canSiteEdit: boolean;
  onChanged: () => void;
};

export function MbEntryTable({ projectId, token, rows, singlePackage, canFullEdit, canSiteEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const canEditDims = canFullEdit || canSiteEdit;
  const hidePackage = Boolean(singlePackage);

  const grouped = useMemo(() => {
    const map = new Map<string, MbRow[]>();
    let lastHeading = "";
    for (const r of rows) {
      const sr = String(r.srNo || "").trim();
      const looksHeading = !sr || !/^\d/.test(sr);
      if (looksHeading && r.description) lastHeading = r.description;
      const key = r.itemCode || lastHeading || r.packageName || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  const colSpan = hidePackage ? 12 : 13;

  async function patchLine(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/mb/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLine(id: string) {
    if (!window.confirm("Delete this MB line?")) return;
    setBusyId(id);
    try {
      await api(`/api/cost/${projectId}/mb/${id}`, { method: "DELETE", token });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  function cell(
    value: string | number | null | undefined,
    onSave: (v: string) => void,
    opts?: { type?: string; numeric?: boolean; disabled?: boolean; className?: string }
  ) {
    if (opts?.disabled) {
      if (opts.numeric && value != null && value !== "") {
        return <span className="cube-num tabular-nums">{formatQty(Number(value))}</span>;
      }
      return <span>{value ?? "—"}</span>;
    }
    return (
      <RegisterSheetCell
        type={opts?.type || (opts?.numeric ? "number" : "text")}
        value={opts?.numeric ? formatQty(Number(value) || 0) : String(value ?? "")}
        className={opts?.className}
        onCommit={onSave}
      />
    );
  }

  return (
    <CostRegisterShell
      title={`Measurement Book (MB)${singlePackage ? ` — ${singlePackage}` : ""}`}
      subtitle={`${rows.length} lines · ${grouped.length} sections · Nos × Length × Width × Height → Qty`}
      footer={msg ? <p className="text-sm text-brand-dark bg-brand-soft px-4 py-2">{msg}</p> : undefined}
    >
      <table className="cube-register__table register-editor-pro min-w-[88rem] mb-entry-panel">
        <thead className="spdc-register-thead">
          <tr>
            {!hidePackage && <th rowSpan={2} className="text-left sticky-col">Package</th>}
            <th rowSpan={2} className="text-left">SR No.</th>
            <th rowSpan={2} className="text-left min-w-[12rem]">Description</th>
            <th colSpan={2} className="text-center">No</th>
            <th rowSpan={2} className="text-left num">Length</th>
            <th rowSpan={2} className="text-left num">Width</th>
            <th rowSpan={2} className="text-left num">Height</th>
            <th rowSpan={2} className="text-left num">Qty</th>
            <th rowSpan={2} className="text-left">UoM</th>
            <th rowSpan={2} className="text-left">RA-Bill</th>
            <th rowSpan={2} className="text-left min-w-[8rem]">Remark</th>
            <th rowSpan={2} className="text-left w-12" />
          </tr>
          <tr>
            <th className="spdc-th-sub text-center num">No</th>
            <th className="spdc-th-sub text-center num">No</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([heading, items]) => (
            <Fragment key={heading}>
              <tr className="boq-section-row">
                <td colSpan={colSpan} className="sticky-col text-left">
                  <span className="boq-section-label">{heading}</span>
                </td>
              </tr>
              {items.map((b) => (
                <tr key={b.id} className={`boq-line-row ${busyId === b.id ? "opacity-60" : ""}`}>
                  {!hidePackage && (
                    <td className="sticky-col text-left align-top">
                      {cell(b.packageName, (v) => void patchLine(b.id, { packageName: v }), { disabled: !canFullEdit })}
                    </td>
                  )}
                  <td className="text-left align-top font-mono">
                    {cell(b.srNo, (v) => void patchLine(b.id, { srNo: v }), { disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top min-w-[12rem]">
                    {cell(b.description, (v) => void patchLine(b.id, { description: v }), {
                      disabled: !canEditDims,
                      className: "min-w-[10rem]",
                    })}
                  </td>
                  <td className="text-left align-top num">
                    {cell(b.nos1, (v) => void patchLine(b.id, { nos1: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top num">
                    {cell(b.nos2, (v) => void patchLine(b.id, { nos2: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top num">
                    {cell(b.length, (v) => void patchLine(b.id, { length: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top num">
                    {cell(b.width, (v) => void patchLine(b.id, { width: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top num">
                    {cell(b.height, (v) => void patchLine(b.id, { height: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                  </td>
                  <td className="text-left align-top num font-medium">
                    {cell(b.qty, (v) => void patchLine(b.id, { qty: Number(v) || 0 }), { numeric: true, disabled: !canFullEdit })}
                  </td>
                  <td className="text-left align-top">
                    {cell(b.unit, (v) => void patchLine(b.id, { unit: v }), { disabled: !canFullEdit })}
                  </td>
                  <td className="text-left align-top">
                    {cell(b.raBill, (v) => void patchLine(b.id, { raBill: v }), { disabled: !canFullEdit })}
                  </td>
                  <td className="text-left align-top">
                    {cell(b.remark, (v) => void patchLine(b.id, { remark: v }), { disabled: !canEditDims, className: "min-w-[6rem]" })}
                  </td>
                  <td className="text-left align-top">
                    {canFullEdit && (
                      <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                        Del
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={colSpan} className="empty text-left p-6">
                No MB rows — pick a package above, upload an MB sheet in setup, or add a row.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </CostRegisterShell>
  );
}

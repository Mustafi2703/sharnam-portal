import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FINANCE_PACKAGES,
  materialMatchesPackage,
  raMatchesPackage,
  type FinancePackage,
  sheetColumnsForPackage,
} from "@sharnam/finance/disciplines";
import { api } from "../../../api";
import { downloadAuthFile } from "../../../lib/downloadReport";
import { ReferenceSheetToolbar } from "../../../components/ReferenceSheetToolbar";
import { RegisterEmptyRow, RegisterSheetFrame } from "../../../components/RegisterSheetFrame";
import { RegisterSheetCell } from "../../../components/RegisterSheetCell";
import { Card } from "../../../components/ui";

function fmtDateInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function money(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

type Props = {
  projectId: string;
  token: string;
  canWrite: boolean;
  activePkg: FinancePackage | null;
  ras: any[];
  invoices: any[];
  reload: () => Promise<void>;
  setMsg: (m: string) => void;
};

/** Viatrix Payment Summary sheet — inline editable bill register for one discipline/package. */
export function FinanceBillRegister({
  projectId,
  token,
  canWrite,
  activePkg,
  ras,
  invoices,
  reload,
  setMsg,
}: Props) {
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    if (!activePkg) return [];
    if (activePkg.billKind === "ra") return ras.filter((r) => raMatchesPackage(r, activePkg));
    return invoices.filter((m) => materialMatchesPackage(m, activePkg));
  }, [activePkg, ras, invoices]);

  const columns = activePkg ? sheetColumnsForPackage(activePkg) : [];

  async function patchRa(id: string, field: string, raw: string) {
    const body: Record<string, unknown> = {};
    if (["againstBillRaised", "priceVariation", "totalInvoiceWithoutGst", "advanceAdjusted", "totalInvoiceWithGst", "retentionAmount", "netAmountPayable", "otherRecoveries", "gstAmount"].includes(field)) {
      body[field] = Number(raw.replace(/,/g, "")) || 0;
    } else if (field === "invoiceDate") {
      body.invoiceDate = raw || null;
    } else if (field === "invoiceNumber") {
      body.invoiceNumber = raw || null;
    } else if (field === "raNumber") {
      body.raNumber = raw;
    } else {
      body[field] = raw;
    }
    await api(`/api/finance/ra/${id}`, { method: "PUT", token, body: JSON.stringify(body) });
  }

  async function patchMaterial(id: string, field: string, raw: string) {
    const body: Record<string, unknown> = {};
    if (["amountWithoutGst", "amountWithGst", "retentionAmount", "netPayable"].includes(field)) {
      body[field] = Number(raw.replace(/,/g, "")) || 0;
    } else if (field === "invoiceDate" || field === "receivedDate") {
      body[field] = raw || null;
    } else {
      body[field] = raw;
    }
    await api(`/api/finance/material-invoices/${id}`, { method: "PUT", token, body: JSON.stringify(body) });
  }

  async function addRow() {
    if (!activePkg || !canWrite) return;
    setBusy(true);
    try {
      if (activePkg.billKind === "ra") {
        const n = rows.length + 1;
        await api(`/api/finance/${projectId}/ra`, {
          method: "POST",
          token,
          body: JSON.stringify({
            packageKey: activePkg.key,
            discipline: activePkg.discipline,
            raNumber: `RA-${String(n).padStart(2, "0")}`,
            status: "Submitted",
          }),
        });
      } else {
        await api(`/api/finance/${projectId}/material-invoices`, {
          method: "POST",
          token,
          body: JSON.stringify({
            packageKey: activePkg.key,
            sheetCategory: activePkg.sheetName,
            description: "New invoice line",
            srNo: String(rows.length + 1),
          }),
        });
      }
      setMsg(`Added row on ${activePkg.sheetName}.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this bill line?")) return;
    setBusy(true);
    try {
      const path = activePkg?.billKind === "ra" ? `/api/finance/ra/${id}` : `/api/finance/material-invoices/${id}`;
      await api(path, { method: "DELETE", token });
      setMsg("Bill line deleted.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSheet(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replace", activePkg?.billKind === "material" ? "1" : "0");
      if (activePkg) fd.append("discipline", activePkg.key);
      const out = await api<any>(`/api/finance/${projectId}/payment-summary/import`, { method: "POST", token, body: fd });
      setMsg(`Imported ${out.raImported ?? 0} RA + ${out.materialImported ?? 0} material lines.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!activePkg) {
    return (
      <div className="space-y-4">
        <Card className="!p-4">
          <p className="text-sm text-steel-muted mb-3">
            Select a discipline above to open its Viatrix Payment Summary sheet — Civil RA Bill, PEB Supply Material, Fire, etc.
            Each project maintains its own bill lines; export matches the client workbook format.
          </p>
        </Card>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {FINANCE_PACKAGES.map((pkg) => (
            <Link key={pkg.key} to={`/projects/${projectId}/finance?tab=bills&discipline=${pkg.key}`}>
              <Card className="!p-4 hover:border-brand/40 transition-colors h-full">
                <div className="text-[10px] uppercase text-steel-muted">{pkg.billKind === "ra" ? "Running account" : "Material / tax invoice"}</div>
                <div className="font-semibold text-sm mt-1">{pkg.label}</div>
                <div className="text-xs text-steel-muted mt-2">Sheet: {pkg.sheetName}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 flex flex-col min-h-[420px]">
      <ReferenceSheetToolbar
        sheetLabel={`Payment Summary · ${activePkg.sheetName}`}
        rowCount={rows.length}
        canEdit={canWrite}
        onAddRow={() => void addRow()}
        onUpload={canWrite ? uploadSheet : undefined}
        uploadTitle={`Import ${activePkg.sheetName}`}
        uploadHint="Upload Viatrix Payment Summary .xlsx — lines merge into this project's register."
        onDownloadXlsx={() =>
          void downloadAuthFile(`/api/finance/${projectId}/payment-summary/download.xlsx`, token, `Payment-Summary-${activePkg.key}.xlsx`).catch((e) =>
            setMsg(e instanceof Error ? e.message : "Download failed")
          )
        }
        busy={busy}
      />

      <RegisterSheetFrame title={activePkg.label} sheetLabel={activePkg.sheetName} rowCount={rows.length} className="min-h-[360px]">
        <table className="register-sheet min-w-max w-full text-xs">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="register-sheet__th whitespace-nowrap px-2 py-1.5 text-left">
                  {c.label}
                </th>
              ))}
              {canWrite && <th className="register-sheet__th w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="register-sheet__row border-t border-line">
                {columns.map((col) => {
                  if (col.key === "srNo") {
                    return (
                      <td key={col.key} className="register-sheet__td px-2 py-1 text-steel-muted">
                        {row.srNo ?? idx + 1}
                      </td>
                    );
                  }
                  const field = col.field || col.key;
                  let val = row[field];
                  if (col.type === "date") val = fmtDateInput(val);
                  return (
                    <td key={col.key} className="register-sheet__td px-1 py-0.5">
                      <RegisterSheetCell
                        value={val}
                        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                        disabled={!canWrite}
                        onCommit={(v) => {
                          void (activePkg.billKind === "ra" ? patchRa(row.id, field, v) : patchMaterial(row.id, field, v))
                            .then(() => reload())
                            .catch((err) => setMsg(err instanceof Error ? err.message : "Save failed"));
                        }}
                      />
                    </td>
                  );
                })}
                {canWrite && (
                  <td className="register-sheet__td px-2">
                    <button type="button" className="text-danger text-[10px]" onClick={() => void deleteRow(row.id)}>
                      Del
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <RegisterEmptyRow
                colSpan={columns.length + (canWrite ? 1 : 0)}
                message={`No lines on ${activePkg.sheetName} — + Add row or upload Payment Summary.`}
              />
            )}
          </tbody>
          {rows.length > 0 && activePkg.billKind === "ra" && (
            <tfoot>
              <tr className="border-t-2 border-ink font-semibold">
                <td colSpan={4} className="px-2 py-2">
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.againstBillRaised || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.priceVariation || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.totalInvoiceWithoutGst || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.advanceAdjusted || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.totalInvoiceWithGst || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.retentionAmount || 0), 0))}</td>
                <td className="px-2 py-2 text-right">{money(rows.reduce((s, r) => s + Number(r.netAmountPayable || 0), 0))}</td>
                {canWrite && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </RegisterSheetFrame>
    </div>
  );
}

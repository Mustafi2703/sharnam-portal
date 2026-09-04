import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { UploadModal } from "./UploadModal";
import { Button, Card, Input } from "./ui";

export type CostStructureRow = {
  packageName: string;
  monitoringRows: number;
  mbRows: number;
  bbsRows: number;
  mbQty?: number;
  bbsWeightKg?: number;
};

type Props = {
  projectId: string;
  token?: string | null;
  structures: CostStructureRow[];
  canEdit: boolean;
  busy?: boolean;
  onChanged: () => void | Promise<void>;
  onOpenTab: (tab: "monitoring" | "mb" | "bbs" | "budget" | "cashflow", pkg?: string) => void;
  onSyncTemplate?: () => void | Promise<void>;
  message?: string;
  onMessage?: (msg: string) => void;
  /** When true, show as primary tab content (full width, no collapse). */
  primary?: boolean;
};

type SheetModal = { pkg: string; kind: "monitoring" | "mb" | "bbs" };

/** SPDC cost setup — structures, MB/BBS sheets per package, full workbook load. */
export function CostStructureSetupPanel({
  projectId,
  token,
  structures,
  canEdit,
  busy,
  onChanged,
  onOpenTab,
  onSyncTemplate,
  message,
  onMessage,
  primary,
}: Props) {
  const [structureName, setStructureName] = useState("New structure");
  const [localBusy, setLocalBusy] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [sheetModal, setSheetModal] = useState<SheetModal | null>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const isBusy = busy || localBusy;
  const hasData = structures.some((s) => s.monitoringRows || s.mbRows || s.bbsRows);

  const spdcColumns = useMemo(
    () => ({
      mb: "Sr · Description · Nos × L × W × H · Qty · UoM · RA-Bill",
      bbs: "Bar mark · Shape · Dia · Bend dims · Length · Weight",
      monitoring: "Item · BOQ · GFC · Achieved · Certified · EV/CPI",
    }),
    []
  );

  async function loadFullTemplate() {
    if (onSyncTemplate) {
      await onSyncTemplate();
      onOpenTab("monitoring", "Civil Dormitory");
      return;
    }
    setLocalBusy(true);
    onMessage?.("");
    try {
      const out = await api<{ budget: number; monitoring: number; mb: number; bbs: number; cashflow?: number }>(
        `/api/cost/${projectId}/sync-template`,
        { method: "POST", token }
      );
      onMessage?.(
        `Loaded SPDC_Budget_Arvind 49.xls — Budget ${out.budget}, Monitoring ${out.monitoring}, MB ${out.mb}, BBS ${out.bbs}${out.cashflow != null ? `, Cashflow ${out.cashflow}` : ""} rows`
      );
      await onChanged();
      onOpenTab("monitoring", "Civil Dormitory");
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Template load failed");
    } finally {
      setLocalBusy(false);
    }
  }

  async function importWorkbook(file: File) {
    setLocalBusy(true);
    onMessage?.("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (/\.xls$/i.test(file.name) || /budget|arvind/i.test(file.name)) {
        const out = await api<{
          fullWorkbook?: boolean;
          budget: number;
          monitoring: number;
          mb: number;
          bbs: number;
          openPackage?: string;
        }>(`/api/cost/${projectId}/boq/import`, { method: "POST", token, body: fd });
        onMessage?.(
          `Loaded full workbook — Budget ${out.budget}, Monitoring ${out.monitoring}, MB ${out.mb}, BBS ${out.bbs}`
        );
        onOpenTab("monitoring", out.openPackage || "Civil Dormitory");
      } else {
        fd.append("kind", "all");
        fd.append("replace", replaceExisting ? "1" : "0");
        const out = await api<{ mbImported: number; bbsImported: number; mbSheets: number; bbsSheets: number; packages: string[] }>(
          `/api/cost/${projectId}/workbook/import`,
          { method: "POST", token, body: fd }
        );
        onMessage?.(
          `Imported ${out.mbSheets} MB tabs (${out.mbImported} rows) + ${out.bbsSheets} BBS tabs (${out.bbsImported} rows) — ${out.packages.join(", ")}`
        );
        onOpenTab("mb", out.packages[0] || "Dormitory Civil");
      }
      await onChanged();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Workbook import failed");
    } finally {
      setLocalBusy(false);
    }
  }

  async function addStructure(file: File, pkgName: string) {
    setLocalBusy(true);
    onMessage?.("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("packageName", pkgName.trim() || "Imported structure");
      await api(`/api/cost/${projectId}/structure/import`, { method: "POST", token, body: fd });
      onMessage?.(`Structure "${pkgName}" BOQ imported — opening monitoring sheet.`);
      await onChanged();
      onOpenTab("monitoring", pkgName.trim() || "Imported structure");
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Structure import failed");
    } finally {
      setLocalBusy(false);
    }
  }

  async function uploadSheetForPackage(pkg: string, kind: "monitoring" | "mb" | "bbs", file: File) {
    setLocalBusy(true);
    onMessage?.("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("packageName", pkg);
      if (kind === "monitoring") {
        await api(`/api/cost/${projectId}/structure/import`, { method: "POST", token, body: fd });
        onMessage?.(`Monitoring BOQ imported for ${pkg}`);
        onOpenTab("monitoring", pkg);
      } else {
        fd.append("replace", replaceExisting ? "1" : "0");
        await api(`/api/cost/${projectId}/${kind}/import`, { method: "POST", token, body: fd });
        onMessage?.(`${kind.toUpperCase()} sheet imported for ${pkg}`);
        onOpenTab(kind, pkg);
      }
      await onChanged();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Sheet upload failed");
    } finally {
      setLocalBusy(false);
    }
  }

  function closeModals() {
    setStructureModalOpen(false);
    setBulkModalOpen(false);
    setSheetModal(null);
    setModalFile(null);
    setReplaceExisting(false);
  }

  async function onStructureModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modalFile) return;
    await addStructure(modalFile, structureName);
    closeModals();
  }

  async function onBulkModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modalFile) return;
    await importWorkbook(modalFile);
    closeModals();
  }

  async function onSheetModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modalFile || !sheetModal) return;
    await uploadSheetForPackage(sheetModal.pkg, sheetModal.kind, modalFile);
    closeModals();
  }

  const sheetKindLabel =
    sheetModal?.kind === "monitoring" ? "Monitoring BOQ" : sheetModal?.kind === "mb" ? "Measurement Book" : "BBS";

  return (
    <>
      <Card padding={false} className={`overflow-visible shrink-0 ${primary ? "cost-setup-panel--primary" : ""}`}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0">
          <h3 className="font-semibold text-sm text-ink">Cost sheet setup — SPDC format</h3>
          <p className="text-xs text-steel-muted mt-1 text-left max-w-4xl">
            Each <strong>structure / package</strong> (Civil Dormitory, Electrical, UGWT, …) has Monitoring BOQ plus MB and BBS tools.
            Start with the full SPDC template, then upload per-structure sheets as packages grow.
          </p>
        </div>

        {canEdit && (
          <div className="px-4 py-4 border-b border-line grid sm:grid-cols-3 gap-4 shrink-0">
            <Card className="!p-4 space-y-2 bg-paper">
              <div className="text-[10px] uppercase font-semibold text-steel-muted">Step 1 · Full template</div>
              <p className="text-xs text-steel-muted">Budget WBS + all Monitoring + MB + BBS + cashflow from server file.</p>
              <Button type="button" disabled={isBusy} onClick={() => void loadFullTemplate()}>
                {isBusy ? "Loading…" : "Load SPDC_Budget_Arvind 49.xls"}
              </Button>
            </Card>
            <Card className="!p-4 space-y-2 bg-paper">
              <div className="text-[10px] uppercase font-semibold text-steel-muted">Step 2 · New structure</div>
              <p className="text-xs text-steel-muted">Add a package with a monitoring BOQ workbook (sections preserved).</p>
              <Button type="button" variant="secondary" disabled={isBusy} onClick={() => setStructureModalOpen(true)}>
                Upload structure BOQ…
              </Button>
            </Card>
            <Card className="!p-4 space-y-2 bg-paper">
              <div className="text-[10px] uppercase font-semibold text-steel-muted">Step 3 · Bulk MB + BBS</div>
              <p className="text-xs text-steel-muted">Import every MB/BBS tab from one Excel workbook.</p>
              <Button type="button" variant="secondary" disabled={isBusy} onClick={() => setBulkModalOpen(true)}>
                Import all MB/BBS sheets…
              </Button>
            </Card>
          </div>
        )}

        <details className="px-4 py-2 border-b border-line text-[10px] text-steel-muted shrink-0">
          <summary className="cursor-pointer font-semibold text-ink text-xs">Column reference (SPDC)</summary>
          <div className="mt-2 grid sm:grid-cols-3 gap-2 pb-2">
            <span><strong>MB:</strong> {spdcColumns.mb}</span>
            <span><strong>BBS:</strong> {spdcColumns.bbs}</span>
            <span><strong>Monitoring:</strong> {spdcColumns.monitoring}</span>
          </div>
        </details>

        {message && <p className="text-sm text-brand-dark bg-brand-soft px-4 py-2 shrink-0">{message}</p>}

        <div className="sheet-register__scroll register-sheet-viewport min-h-[14rem]">
          <table className="sheet-register__table min-w-[56rem]">
            <thead>
              <tr>
                <th className="text-left sticky-col">Structure / package</th>
                <th className="text-left num">Monitoring</th>
                <th className="text-left num">MB lines</th>
                <th className="text-left num">BBS lines</th>
                <th className="text-left">Open sheets</th>
                <th className="text-left min-w-[14rem]">Upload per structure</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s.packageName}>
                  <td className="sticky-col font-medium text-left">{s.packageName}</td>
                  <td className="num text-left">{s.monitoringRows || "—"}</td>
                  <td className="num text-left">
                    {s.mbRows || "—"}
                    {s.mbQty ? <span className="text-[10px] text-steel-muted block">Σ qty {Math.round(s.mbQty)}</span> : null}
                  </td>
                  <td className="num text-left">
                    {s.bbsRows || "—"}
                    {s.bbsWeightKg ? <span className="text-[10px] text-steel-muted block">{Math.round(s.bbsWeightKg)} kg</span> : null}
                  </td>
                  <td className="text-left whitespace-nowrap">
                    <button type="button" className="text-xs text-brand font-semibold mr-2" onClick={() => onOpenTab("monitoring", s.packageName)}>
                      BOQ
                    </button>
                    <button type="button" className="text-xs text-brand font-semibold mr-2" onClick={() => onOpenTab("mb", s.packageName)}>
                      MB
                    </button>
                    <button type="button" className="text-xs text-brand font-semibold" onClick={() => onOpenTab("bbs", s.packageName)}>
                      BBS
                    </button>
                  </td>
                  <td className="text-left">
                    {canEdit ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          className="!text-xs !py-1 !px-2"
                          disabled={isBusy}
                          onClick={() => setSheetModal({ pkg: s.packageName, kind: "monitoring" })}
                        >
                          Monitoring
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="!text-xs !py-1 !px-2"
                          disabled={isBusy}
                          onClick={() => setSheetModal({ pkg: s.packageName, kind: "mb" })}
                        >
                          MB
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="!text-xs !py-1 !px-2"
                          disabled={isBusy}
                          onClick={() => setSheetModal({ pkg: s.packageName, kind: "bbs" })}
                        >
                          BBS
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-steel-muted">Office only</span>
                    )}
                  </td>
                </tr>
              ))}
              {!structures.length && (
                <tr>
                  <td colSpan={6} className="empty text-left p-6">
                    {hasData ? (
                      "No structure rows"
                    ) : (
                      <>
                        No cost sheets yet — click <strong>Load SPDC_Budget_Arvind 49.xls</strong> above, or open{" "}
                        <Link to={`/projects/${projectId}/cost?tab=boq`} className="text-brand font-semibold">
                          Structure upload
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UploadModal
        open={structureModalOpen}
        title="Upload structure BOQ"
        context="Adds a new package with monitoring lines from your Excel (SPDC Monitoring* tab or generic BOQ)."
        file={modalFile}
        onFile={setModalFile}
        accept=".xlsx,.xls,.csv"
        fields={[
          {
            kind: "text",
            name: "packageName",
            label: "Structure / package name",
            required: true,
            value: structureName,
            onChange: setStructureName,
            placeholder: "e.g. Civil Dormitory",
          },
        ]}
        primaryLabel="Import structure"
        busy={isBusy}
        onClose={closeModals}
        onSubmit={(e) => void onStructureModalSubmit(e)}
      />

      <UploadModal
        open={bulkModalOpen}
        title="Import MB + BBS workbook"
        context="Imports all MB and BBS tabs from one Excel file. Use SPDC_Budget for full workbook or a dedicated MB/BBS export."
        file={modalFile}
        onFile={setModalFile}
        accept=".xlsx,.xls"
        fields={[
          {
            kind: "checkbox",
            name: "replace",
            label: "Replace existing MB/BBS rows for matching packages",
            checked: replaceExisting,
            onChange: setReplaceExisting,
          },
        ]}
        primaryLabel="Import workbook"
        busy={isBusy}
        onClose={closeModals}
        onSubmit={(e) => void onBulkModalSubmit(e)}
      />

      <UploadModal
        open={!!sheetModal}
        title={`Upload ${sheetKindLabel}`}
        context={sheetModal ? `Package: ${sheetModal.pkg}` : ""}
        file={modalFile}
        onFile={setModalFile}
        accept=".xlsx,.xls,.csv"
        fields={
          sheetModal?.kind !== "monitoring"
            ? [
                {
                  kind: "checkbox",
                  name: "replace",
                  label: "Replace existing rows for this package",
                  checked: replaceExisting,
                  onChange: setReplaceExisting,
                },
              ]
            : []
        }
        primaryLabel="Upload sheet"
        busy={isBusy}
        onClose={closeModals}
        onSubmit={(e) => void onSheetModalSubmit(e)}
      />
    </>
  );
}

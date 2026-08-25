import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
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
};

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
}: Props) {
  const [structureName, setStructureName] = useState("New structure");
  const [structureFile, setStructureFile] = useState<File | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  const isBusy = busy || localBusy;
  const hasData = structures.some((s) => s.monitoringRows || s.mbRows || s.bbsRows);

  const spdcColumns = useMemo(
    () => ({
      mb: "Sr · Description · Nos × Length × Width × Height · Qty · UoM · RA-Bill · Remark",
      bbs: "Bar mark · Shape · Dia · Bend dims A–E · Total length · Weight · Location",
      monitoring: "Item · Description · Rate · BOQ · GFC · Achieved · Certified · EV/CPI columns",
      budget: "Sr · Description · Stakeholder · Budget · WO · Certified · Forecast · Steel/Cement/Tiles",
      cashflow: "Period · Planned · Actual · Progress (Chart / Forecast / Tracking sheets)",
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

  async function importWorkbook() {
    if (!workbookFile) return;
    setLocalBusy(true);
    onMessage?.("");
    try {
      const fd = new FormData();
      fd.append("file", workbookFile);
      if (/\.xls$/i.test(workbookFile.name) || /budget|arvind/i.test(workbookFile.name)) {
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
        fd.append("replace", "1");
        const out = await api<{ mbImported: number; bbsImported: number; mbSheets: number; bbsSheets: number; packages: string[] }>(
          `/api/cost/${projectId}/workbook/import`,
          { method: "POST", token, body: fd }
        );
        onMessage?.(
          `Imported ${out.mbSheets} MB tabs (${out.mbImported} rows) + ${out.bbsSheets} BBS tabs (${out.bbsImported} rows) — ${out.packages.join(", ")}`
        );
        onOpenTab("mb", out.packages[0] || "Dormitory Civil");
      }
      setWorkbookFile(null);
      await onChanged();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Workbook import failed");
    } finally {
      setLocalBusy(false);
    }
  }

  async function addStructure(e: React.FormEvent) {
    e.preventDefault();
    if (!structureFile) return;
    setLocalBusy(true);
    onMessage?.("");
    try {
      const fd = new FormData();
      fd.append("file", structureFile);
      fd.append("packageName", structureName.trim() || "Imported structure");
      await api(`/api/cost/${projectId}/structure/import`, { method: "POST", token, body: fd });
      onMessage?.(`Structure "${structureName}" BOQ imported — opening monitoring sheet.`);
      setStructureFile(null);
      await onChanged();
      onOpenTab("monitoring", structureName.trim() || "Imported structure");
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
        fd.append("replace", "0");
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

  function SheetUploadBtn({
    label,
    pkg,
    kind,
  }: {
    label: string;
    pkg: string;
    kind: "monitoring" | "mb" | "bbs";
  }) {
    const ref = useRef<HTMLInputElement>(null);
    if (!canEdit) return null;
    return (
      <>
        <input
          ref={ref}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadSheetForPackage(pkg, kind, f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={isBusy}
          title={`Upload ${label} for ${pkg}`}
          className="text-[10px] font-semibold text-brand px-1.5 py-0.5 rounded border border-brand/30 hover:bg-brand-soft disabled:opacity-50"
          onClick={() => ref.current?.click()}
        >
          ↑ {label}
        </button>
      </>
    );
  }

  return (
    <Card padding={false} className="register-panel-fill overflow-visible shrink-0">
      <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0">
        <h3 className="font-semibold text-sm text-ink">Cost sheet setup — SPDC format</h3>
        <p className="text-xs text-steel-muted mt-1 text-left max-w-4xl">
          One <strong>structure / package</strong> per discipline (Civil Dormitory, Electric, UGWT, …). Each structure has its own{" "}
          <strong>Monitoring BOQ</strong>, <strong>MB</strong>, and <strong>BBS</strong> sheet tabs matching{" "}
          <code className="font-mono text-[11px]">SPDC_Budget_Arvind 49.xls</code>. Load the server template or upload the full workbook.
        </p>
      </div>

      {canEdit && (
        <div className="px-4 py-3 border-b border-line grid lg:grid-cols-3 gap-4 shrink-0">
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-semibold text-steel-muted">1 · Full SPDC template</div>
            <p className="text-xs text-steel-muted">Budget WBS + all Monitoring + 14 MB + 5 BBS + rates + cashflow from server file.</p>
            <Button type="button" disabled={isBusy} onClick={() => void loadFullTemplate()}>
              {isBusy ? "Loading…" : "Load SPDC_Budget_Arvind 49.xls"}
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-semibold text-steel-muted">2 · MB + BBS workbook upload</div>
            <p className="text-xs text-steel-muted">Imports every MB/BBS tab with correct package names (replaces existing MB/BBS).</p>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setWorkbookFile(e.target.files?.[0] || null)} className="text-xs w-full" />
            <Button type="button" variant="secondary" disabled={isBusy || !workbookFile} onClick={() => void importWorkbook()}>
              Import all MB/BBS sheets
            </Button>
          </div>
          <form className="space-y-2" onSubmit={addStructure}>
            <div className="text-[10px] uppercase font-semibold text-steel-muted">3 · Add structure (BOQ only)</div>
            <p className="text-xs text-steel-muted">Creates monitoring lines under a new package name.</p>
            <Input placeholder="Structure / package name" value={structureName} onChange={(e) => setStructureName(e.target.value)} required />
            <input type="file" accept=".xlsx,.xls,.csv" required onChange={(e) => setStructureFile(e.target.files?.[0] || null)} className="text-xs w-full" />
            <Button type="submit" variant="secondary" disabled={isBusy || !structureFile}>
              Upload structure BOQ
            </Button>
          </form>
        </div>
      )}

      <div className="px-4 py-2 border-b border-line bg-brand-soft/30 text-[10px] text-steel-muted shrink-0 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <span><strong className="text-ink">MB:</strong> {spdcColumns.mb}</span>
        <span><strong className="text-ink">BBS:</strong> {spdcColumns.bbs}</span>
        <span><strong className="text-ink">Monitoring:</strong> {spdcColumns.monitoring}</span>
        <span><strong className="text-ink">Budget:</strong> {spdcColumns.budget}</span>
        <span><strong className="text-ink">Cashflow:</strong> {spdcColumns.cashflow}</span>
      </div>

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
              <th className="text-left min-w-[11rem]">Upload per structure</th>
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
                  <div className="flex flex-wrap gap-1">
                    <SheetUploadBtn label="Mon" pkg={s.packageName} kind="monitoring" />
                    <SheetUploadBtn label="MB" pkg={s.packageName} kind="mb" />
                    <SheetUploadBtn label="BBS" pkg={s.packageName} kind="bbs" />
                  </div>
                </td>
              </tr>
            ))}
            {!structures.length && (
              <tr>
                <td colSpan={6} className="empty text-left p-6">
                  {hasData ? "No structure rows" : (
                    <>
                      No cost sheets yet — click <strong>Load SPDC_Budget_Arvind 49.xls</strong> above, or see{" "}
                      <Link to={`/projects/${projectId}/cost?tab=boq`} className="text-brand font-semibold">Structure upload</Link>.
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

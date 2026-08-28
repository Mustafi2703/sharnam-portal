/**
 * BBS register — column order matches SPDC * BBS sheets (diagram in SHAPE OF BAR col).
 */
import { useEffect, useState } from "react";
import { api, apiBase } from "../api";
import { FilePickButton } from "./FilePickButton";
import { Button, Select } from "./ui";
import PdfMarkup from "./PdfMarkup";
import ImageMarkup from "./ImageMarkup";
import { formatQty } from "./BoqMonitoringEditor";
import { CostRegisterShell } from "./CostRegisterShell";
import { BBS_COLUMN_GROUPS, bbsColClass } from "../lib/costSheetColumns";
import { bbsBandEmpty, BBS_DATA_COLS } from "../lib/costBandRows";
import { bbsRowBandClass, bbsRowKind } from "../lib/costSheetRows";

function CellInput({
  value,
  disabled,
  type = "text",
  className = "",
  onCommit,
}: {
  value: string | number | null | undefined;
  disabled?: boolean;
  type?: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <input
      type={type}
      disabled={disabled}
      defaultValue={type === "number" ? formatQty(Number(value) || 0) : String(value ?? "")}
      className={`boq-cell-input ${className}`}
      step={type === "number" ? "any" : undefined}
      onBlur={(e) => {
        const next = e.target.value;
        const prev = type === "number" ? formatQty(Number(value) || 0) : String(value ?? "");
        if (next !== prev) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export type BbsRow = {
  id: string;
  packageName: string;
  barMark?: string | null;
  shapeCode?: string | null;
  itemCode?: string | null;
  sectionMark?: string | null;
  diameterMm?: number;
  shape?: string | null;
  lengthMm?: number;
  nos?: number;
  nosPerMember?: number;
  nosOfMember?: number;
  shapeLenA?: number;
  shapeLenB?: number;
  shapeLenC?: number;
  shapeLenD?: number;
  shapeLenE?: number;
  totalLength?: number;
  weightKg?: number;
  location?: string | null;
  rowKind?: string | null;
  shapeDiagramPath?: string | null;
  shapeDiagramUrl?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  rows: BbsRow[];
  singlePackage?: string;
  canUpload: boolean;
  canFullEdit: boolean;
  canSiteEdit: boolean;
  onChanged: () => void;
};

function fileHref(path?: string | null, shareUrl?: string | null) {
  if (shareUrl?.startsWith("http")) return shareUrl;
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${apiBase()}${path}`;
  return `${apiBase()}/uploads/onedrive/${path}`;
}

function rowLabel(row: BbsRow) {
  return row.barMark || row.location?.slice(0, 24) || row.id.slice(0, 8);
}

function fmtNum(v?: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function fmtKg(v: number) {
  return Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BbsEntryTable({ projectId, token, rows, singlePackage, canUpload, canFullEdit, canSiteEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markupRow, setMarkupRow] = useState<BbsRow | null>(null);
  const [shapeDraft, setShapeDraft] = useState<File | null>(null);
  const [shapePreview, setShapePreview] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [shapeMasters, setShapeMasters] = useState<{ shapeCode: string; name?: string | null }[]>([]);
  const canEditDims = canFullEdit || canSiteEdit;
  const colSpan = BBS_DATA_COLS + 1;

  function bbsRangeEmpty(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, i) => bbsBandEmpty(from + i, `bbs-b-${from + i}`));
  }

  useEffect(() => {
    void api<{ shapeCode: string; name?: string | null }[]>("/api/cost/shape-masters", { token })
      .then(setShapeMasters)
      .catch(() => setShapeMasters([]));
  }, [token]);

  async function patchLine(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/bbs/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLine(id: string) {
    if (!window.confirm("Delete this BBS line?")) return;
    setBusyId(id);
    try {
      await api(`/api/cost/${projectId}/bbs/${id}`, { method: "DELETE", token });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadShapeForRow(row: BbsRow, file: File) {
    setBusyId(row.id);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("packageName", row.packageName);
      fd.append("bbsLineId", row.id);
      if (row.barMark) fd.append("barMark", row.barMark);
      await api(`/api/cost/${projectId}/bbs/shape`, { method: "POST", token, body: fd });
      setMarkupRow(null);
      setShapeDraft(null);
      setShapePreview(null);
      setMsg(`Shape saved for mark ${rowLabel(row)}`);
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  function onPickForRow(row: BbsRow, files: File[]) {
    const file = files[0];
    if (!file) return;
    setMarkupRow(row);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setShapeDraft(file);
      setShapePreview(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      setShapeDraft(file);
      setShapePreview(URL.createObjectURL(file));
      return;
    }
    void uploadShapeForRow(row, file);
  }

  function closeMarkup() {
    setMarkupRow(null);
    setShapeDraft(null);
    if (shapePreview) URL.revokeObjectURL(shapePreview);
    setShapePreview(null);
  }

  const uploaded = rows.filter((r) => r.shapeDiagramPath || r.shapeDiagramUrl).length;
  const visibleRows = rows.filter((r) => {
    const loc = String(r.location || r.sectionMark || "");
    const mark = String(r.barMark || "");
    if (/^\s*(grand\s*)?total\b/i.test(loc) || /^\s*(grand\s*)?total\b/i.test(mark)) return false;
    if (/^dia\s*\d+(\.\d+)?(\s*mm)?$/i.test(loc)) return false;
    return true;
  });
  const dataRows = visibleRows.filter((r) => bbsRowKind(r) === "data");
  const totalNos = dataRows.reduce((s, r) => s + (Number(r.nos) || 0), 0);
  const totalLen = dataRows.reduce((s, r) => s + (Number(r.totalLength) || 0), 0);
  const totalWt = dataRows.reduce((s, r) => s + (Number(r.weightKg) || 0), 0);
  const byDia = new Map<number, { nos: number; length: number; weight: number }>();
  for (const r of dataRows) {
    const d = Number(r.diameterMm) || 0;
    if (d < 6) continue;
    const cur = byDia.get(d) || { nos: 0, length: 0, weight: 0 };
    cur.nos += Number(r.nos) || 0;
    cur.length += Number(r.totalLength) || 0;
    cur.weight += Number(r.weightKg) || 0;
    byDia.set(d, cur);
  }
  const diaTotals = [...byDia.entries()].sort((a, b) => a[0] - b[0]);

  async function addRow(kind: "section" | "subsection" | "data") {
    const pkg =
      singlePackage && singlePackage !== "All"
        ? singlePackage
        : rows[0]?.packageName || "Dormitory BBS";
    const sectionN = rows.filter((r) => bbsRowKind(r) === "section").length;
    const subN = rows.filter((r) => bbsRowKind(r) === "subsection").length;
    const body =
      kind === "section"
        ? {
            packageName: pkg,
            rowKind: "section",
            barMark: String.fromCharCode(65 + (sectionN % 26)),
            location: "New section",
          }
        : kind === "subsection"
          ? {
              packageName: pkg,
              rowKind: "subsection",
              barMark: String(subN + 1),
              location: "New subsection",
            }
          : {
              packageName: pkg,
              rowKind: "data",
              barMark: "",
              location: "New bar",
              nos: 1,
            };
    setBusyId("new");
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/bbs`, { method: "POST", token, body: JSON.stringify(body) });
      setMsg(kind === "data" ? "Bar entry added — fill dia, nos and lengths" : `${kind} added — edit the label in the sheet`);
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusyId(null);
    }
  }

  const canMutate = canFullEdit || canSiteEdit;

  function bandRow(b: BbsRow) {
    const kind = bbsRowKind(b);
    const label = b.location || b.sectionMark || "—";
    const labelClass =
      kind === "section" ? "boq-section-label" : kind === "subheader" ? "boq-subheader-label" : "boq-subsection-label";

    if (kind === "subheader") {
      return (
        <tr key={b.id} className={bbsRowBandClass(kind)}>
          {bbsBandEmpty(0, "p")}
          {bbsBandEmpty(1, "sr")}
          <td className={bbsColClass(2, { sticky: true, extra: "text-left uppercase tracking-wide text-[10px]" })}>
            <span className={labelClass}>{label}</span>
          </td>
          {bbsRangeEmpty(3, 15)}
          <td className="w-12">
            {canMutate && (
              <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                Del
              </Button>
            )}
          </td>
        </tr>
      );
    }

    return (
      <tr key={b.id} className={bbsRowBandClass(kind)}>
        {bbsBandEmpty(0, "p")}
        <td className={bbsColClass(1, { extra: "text-left font-semibold font-mono" })}>
          {canMutate ? (
            <CellInput value={b.barMark} onCommit={(v) => void patchLine(b.id, { barMark: v, rowKind: kind })} />
          ) : (
            b.barMark || "\u00a0"
          )}
        </td>
        <td className={bbsColClass(2, { sticky: true, extra: "text-left" })}>
          {canMutate ? (
            <CellInput
              value={label === "—" ? "" : label}
              onCommit={(v) => void patchLine(b.id, { location: v, rowKind: kind })}
            />
          ) : (
            <span className={labelClass}>
              {kind === "subsection" && b.barMark ? "" : b.barMark && kind !== "section" ? `${b.barMark} · ` : ""}
              {label}
            </span>
          )}
        </td>
        {bbsRangeEmpty(3, 15)}
        <td className="w-12">
          {canMutate && (
            <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
              Del
            </Button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <>
    <CostRegisterShell
      sheetKind="bbs"
      title={`Bar Bending Schedule (BBS)${singlePackage ? ` — ${singlePackage}` : ""}`}
      subtitle={`${visibleRows.length} lines · ${dataRows.length} bars · ${uploaded} shapes · total ${fmtKg(totalWt)} kg`}
      toolbar={
        canMutate ? (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            <Button type="button" variant="secondary" className="!text-xs" disabled={busyId === "new"} onClick={() => void addRow("section")}>
              + Section
            </Button>
            <Button type="button" variant="secondary" className="!text-xs" disabled={busyId === "new"} onClick={() => void addRow("subsection")}>
              + Subsection
            </Button>
            <Button type="button" className="!text-xs" disabled={busyId === "new"} onClick={() => void addRow("data")}>
              + Bar entry
            </Button>
            <span className="text-[11px] text-steel-muted">
              Section / subsection are sheet headings. Bar entry is a measured line (dia · nos · A–E · weight).
            </span>
          </div>
        ) : undefined
      }
      footer={
        <div className="bbs-sheet-totals px-4 py-2.5 text-sm grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-steel-muted">Bar entries</div>
            <div className="font-display font-semibold">{dataRows.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-steel-muted">Total nos of bars</div>
            <div className="font-display font-semibold tabular-nums">{fmtNum(totalNos)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-steel-muted">Total length</div>
            <div className="font-display font-semibold tabular-nums">{fmtNum(totalLen)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-steel-muted">Total weight</div>
            <div className="font-display font-semibold tabular-nums">{fmtKg(totalWt)} kg</div>
          </div>
          {diaTotals.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2 pt-1 border-t border-line">
              {diaTotals.map(([d, t]) => (
                <span key={d} className="text-xs rounded border border-line bg-paper px-2 py-1 tabular-nums">
                  Dia {d} mm · {fmtNum(t.nos)} nos · {fmtKg(t.weight)} kg
                </span>
              ))}
            </div>
          )}
          {msg ? <p className="sm:col-span-2 lg:col-span-4 text-sm text-brand-dark">{msg}</p> : null}
        </div>
      }
    >
        <table className="cube-register__table register-editor-pro cost-register-table min-w-[108rem]">
          <thead className="cost-register-thead">
            <tr className="cost-col-group-row">
              {BBS_COLUMN_GROUPS.map((g) => (
                <th key={g.key} colSpan={g.to - g.from + 1} className={`cost-col-group cost-col--${g.key}`}>
                  {g.label}
                </th>
              ))}
              <th rowSpan={3} />
            </tr>
            <tr>
              <th className={bbsColClass(0, { sticky: true, extra: "text-left" })} rowSpan={2}>Package</th>
              <th className={bbsColClass(1)} rowSpan={2}>SR. NO</th>
              <th className={bbsColClass(2)} rowSpan={2}>DESCRIPTION</th>
              <th className={bbsColClass(3, { extra: "min-w-[140px]" })} rowSpan={2}>SHAPE OF BAR</th>
              <th className={bbsColClass(4)} rowSpan={2}>DIA</th>
              <th className={bbsColClass(5)} rowSpan={2}>NO PER MEMBER</th>
              <th className={bbsColClass(6)} rowSpan={2}>NO OF MEMBER</th>
              <th className={bbsColClass(7)} rowSpan={2}>TOTAL NOS OF BARS</th>
              <th colSpan={5} className={`${bbsColClass(8)} text-center`}>SHAPE LENGTH</th>
              <th className={bbsColClass(13)} rowSpan={2}>Cutting Length</th>
              <th className={bbsColClass(14)} rowSpan={2}>Total LENGTH</th>
              <th className={bbsColClass(15)} rowSpan={2}>Weight kg</th>
            </tr>
            <tr>
              <th className={bbsColClass(8, { extra: "spdc-th-sub" })}>A</th>
              <th className={bbsColClass(9, { extra: "spdc-th-sub" })}>B</th>
              <th className={bbsColClass(10, { extra: "spdc-th-sub" })}>C</th>
              <th className={bbsColClass(11, { extra: "spdc-th-sub" })}>D</th>
              <th className={bbsColClass(12, { extra: "spdc-th-sub" })}>E</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((b) => {
              if (bbsRowKind(b) !== "data") {
                return bandRow(b);
              }
              const href = fileHref(b.shapeDiagramPath, b.shapeDiagramUrl);
              const hasDiagram = Boolean(href);
              const isImage = hasDiagram && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(href);
              return (
                <tr key={b.id} className={`boq-line-row ${busyId === b.id ? "opacity-60" : ""}`}>
                  <td className={bbsColClass(0, { sticky: true, extra: "wrap text-left align-top" })}>
                    {canFullEdit ? (
                      <CellInput value={b.packageName} onCommit={(v) => void patchLine(b.id, { packageName: v })} />
                    ) : (
                      b.packageName
                    )}
                  </td>
                  <td className={bbsColClass(1, { extra: "wrap font-medium text-left align-top" })}>
                    {canEditDims ? (
                      <CellInput value={b.barMark} onCommit={(v) => void patchLine(b.id, { barMark: v })} />
                    ) : (
                      b.barMark || "—"
                    )}
                  </td>
                  <td className={bbsColClass(2, { extra: "wrap min-w-[140px]" })}>
                    {canEditDims ? (
                      <CellInput
                        value={b.location || b.sectionMark || ""}
                        onCommit={(v) => void patchLine(b.id, { location: v })}
                      />
                    ) : (
                      b.location || b.sectionMark || "—"
                    )}
                  </td>
                  <td className={bbsColClass(3, { extra: "align-top" })}>
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                      {canEditDims && (
                        <Select
                          value={b.shapeCode || ""}
                          onChange={(e) => void patchLine(b.id, { shapeCode: e.target.value })}
                          className="!text-xs !py-1"
                        >
                          <option value="">Shape code…</option>
                          {shapeMasters.map((m) => (
                            <option key={m.shapeCode} value={m.shapeCode}>
                              {m.shapeCode}
                              {m.name ? ` · ${m.name}` : ""}
                            </option>
                          ))}
                        </Select>
                      )}
                      {b.shapeCode && !b.shapeDiagramPath && !b.shapeDiagramUrl && (
                        <span className="text-[10px] text-amber-700">Code {b.shapeCode} — upload diagram in Master or below</span>
                      )}
                      {hasDiagram ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-sm border border-line bg-paper overflow-hidden hover:border-brand/50"
                          title="Open bend diagram"
                        >
                          {isImage ? (
                            <img src={href} alt={`Shape ${rowLabel(b)}`} className="h-14 w-full object-contain bg-white" />
                          ) : (
                            <div className="h-14 flex items-center justify-center text-[10px] text-steel-muted px-2">
                              PDF diagram · click to open
                            </div>
                          )}
                        </a>
                      ) : (
                        <div className="h-14 rounded-sm border border-dashed border-amber-300/80 bg-amber-50/50 flex items-center justify-center text-[10px] text-amber-800 px-2 text-center">
                          Pending diagram
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        {hasDiagram && (
                          <>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand font-medium"
                            >
                              View
                            </a>
                            <button
                              type="button"
                              className="text-xs text-brand font-medium underline-offset-2 hover:underline"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(href);
                                  setMsg(`Share link copied for mark ${rowLabel(b)}`);
                                } catch {
                                  window.open(href, "_blank", "noopener,noreferrer");
                                }
                              }}
                            >
                              Share
                            </button>
                          </>
                        )}
                        {canUpload && (
                          <FilePickButton
                            accept="image/*,application/pdf"
                            onPick={(files) => onPickForRow(b, files)}
                            variant="ghost"
                            className="!text-xs !py-0.5 !px-1.5"
                          >
                            {busyId === b.id ? "…" : hasDiagram ? "Replace" : "Upload + markup"}
                          </FilePickButton>
                        )}
                        {!canUpload && !hasDiagram && <span className="text-steel-muted text-xs">—</span>}
                      </div>
                    </div>
                  </td>
                  <td className={bbsColClass(4)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.diameterMm}
                        onCommit={(v) => void patchLine(b.id, { diameterMm: Number(v) || 0 })}
                      />
                    ) : (
                      b.diameterMm ? `${b.diameterMm}` : "—"
                    )}
                  </td>
                  <td className={bbsColClass(5)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.nosPerMember}
                        onCommit={(v) => void patchLine(b.id, { nosPerMember: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.nosPerMember)
                    )}
                  </td>
                  <td className={bbsColClass(6)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.nosOfMember}
                        onCommit={(v) => void patchLine(b.id, { nosOfMember: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.nosOfMember)
                    )}
                  </td>
                  <td className={bbsColClass(7)}>
                    {canEditDims ? (
                      <CellInput type="number" value={b.nos} onCommit={(v) => void patchLine(b.id, { nos: Number(v) || 0 })} />
                    ) : (
                      fmtNum(b.nos)
                    )}
                  </td>
                  <td className={bbsColClass(8)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.shapeLenA}
                        onCommit={(v) => void patchLine(b.id, { shapeLenA: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.shapeLenA)
                    )}
                  </td>
                  <td className={bbsColClass(9)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.shapeLenB}
                        onCommit={(v) => void patchLine(b.id, { shapeLenB: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.shapeLenB)
                    )}
                  </td>
                  <td className={bbsColClass(10)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.shapeLenC}
                        onCommit={(v) => void patchLine(b.id, { shapeLenC: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.shapeLenC)
                    )}
                  </td>
                  <td className={bbsColClass(11)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.shapeLenD}
                        onCommit={(v) => void patchLine(b.id, { shapeLenD: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.shapeLenD)
                    )}
                  </td>
                  <td className={bbsColClass(12)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.shapeLenE}
                        onCommit={(v) => void patchLine(b.id, { shapeLenE: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.shapeLenE)
                    )}
                  </td>
                  <td className={bbsColClass(13)}>
                    {canEditDims ? (
                      <CellInput
                        type="number"
                        value={b.lengthMm}
                        onCommit={(v) => void patchLine(b.id, { lengthMm: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.lengthMm)
                    )}
                  </td>
                  <td className={bbsColClass(14)}>
                    {canFullEdit ? (
                      <CellInput
                        type="number"
                        value={b.totalLength}
                        onCommit={(v) => void patchLine(b.id, { totalLength: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.totalLength)
                    )}
                  </td>
                  <td className={bbsColClass(15)}>
                    {canFullEdit ? (
                      <CellInput
                        type="number"
                        value={b.weightKg}
                        onCommit={(v) => void patchLine(b.id, { weightKg: Number(v) || 0 })}
                      />
                    ) : (
                      fmtNum(b.weightKg)
                    )}
                  </td>
                  <td>
                    {canMutate && (
                      <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                        Del
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visibleRows.length && (
              <tr>
                <td colSpan={colSpan} className="empty text-left p-6">
                  No BBS rows — add a section, subsection, or bar entry, or upload a BBS sheet in setup.
                </td>
              </tr>
            )}
          </tbody>
          {dataRows.length > 0 && (
            <tfoot className="bbs-sheet-tfoot">
              <tr className="boq-total-row bbs-grand-total">
                <td className={bbsColClass(0)} />
                <td className={bbsColClass(1)} />
                <td className={bbsColClass(2, { extra: "text-left" })}>
                  <span className="boq-total-label">TOTAL</span>
                </td>
                <td className={bbsColClass(3)} />
                <td className={bbsColClass(4)} />
                <td className={bbsColClass(5)} />
                <td className={bbsColClass(6)} />
                <td className={`${bbsColClass(7)} tabular-nums font-semibold`}>{fmtNum(totalNos)}</td>
                <td className={bbsColClass(8)} />
                <td className={bbsColClass(9)} />
                <td className={bbsColClass(10)} />
                <td className={bbsColClass(11)} />
                <td className={bbsColClass(12)} />
                <td className={bbsColClass(13)} />
                <td className={`${bbsColClass(14)} tabular-nums font-semibold`}>{fmtNum(totalLen)}</td>
                <td className={`${bbsColClass(15)} tabular-nums font-semibold`}>{fmtKg(totalWt)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
    </CostRegisterShell>

      {markupRow && shapeDraft && (
        <div className="markup-modal" role="dialog" aria-modal="true" aria-label="BBS row shape markup">
          <div className="markup-modal__backdrop" onClick={closeMarkup} />
          <div className="markup-modal__panel max-w-4xl">
            <div className="markup-modal__head">
              <span>
                Mark {rowLabel(markupRow)} · Shape of bar · {markupRow.location || markupRow.packageName}
              </span>
              <button type="button" className="markup-modal__close" onClick={closeMarkup}>
                ×
              </button>
            </div>
            <div className="markup-modal__body">
              {shapeDraft.type === "application/pdf" || shapeDraft.name.toLowerCase().endsWith(".pdf") ? (
                <PdfMarkup
                  src={shapeDraft}
                  saveLabel="Save diagram in Shape of bar column"
                  onCancel={closeMarkup}
                  onSave={async (markedPages) => {
                    const file = markedPages[0]?.file || shapeDraft;
                    await uploadShapeForRow(markupRow, file);
                  }}
                />
              ) : (
                <ImageMarkup
                  src={shapePreview || shapeDraft}
                  saveLabel="Save diagram in Shape of bar column"
                  filename={`bbs-${rowLabel(markupRow)}`}
                  onCancel={closeMarkup}
                  onSave={async (file) => {
                    await uploadShapeForRow(markupRow, file);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

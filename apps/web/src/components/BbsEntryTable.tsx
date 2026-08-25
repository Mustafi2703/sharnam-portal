/**
 * BBS register — column order matches SPDC * BBS sheets (diagram in SHAPE OF BAR col).
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, apiBase } from "../api";
import { FilePickButton } from "./FilePickButton";
import { Button, Select } from "./ui";
import PdfMarkup from "./PdfMarkup";
import ImageMarkup from "./ImageMarkup";
import { formatQty } from "./BoqMonitoringEditor";
import { CostRegisterShell } from "./CostRegisterShell";

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
  if (v == null || !Number.isFinite(v) || v === 0) return "—";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function BbsEntryTable({ projectId, token, rows, singlePackage, canUpload, canFullEdit, canSiteEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markupRow, setMarkupRow] = useState<BbsRow | null>(null);
  const [shapeDraft, setShapeDraft] = useState<File | null>(null);
  const [shapePreview, setShapePreview] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [shapeMasters, setShapeMasters] = useState<{ shapeCode: string; name?: string | null }[]>([]);
  const canEditDims = canFullEdit || canSiteEdit;
  const hidePackage = Boolean(singlePackage);
  const colSpan = hidePackage ? 16 : 17;

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
  const grouped = useMemo(() => {
    const map = new Map<string, BbsRow[]>();
    for (const r of rows) {
      const key = r.sectionMark || r.packageName || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <>
    <CostRegisterShell
      title={`Bar Bending Schedule (BBS)${singlePackage ? ` — ${singlePackage}` : ""}`}
      subtitle={`${rows.length} lines · ${uploaded} shapes uploaded · SHAPE OF BAR column = bend diagram`}
      footer={msg ? <p className="text-sm text-brand-dark bg-brand-soft px-4 py-2">{msg}</p> : undefined}
    >
        <table className="cube-register__table register-editor-pro min-w-[104rem] bbs-entry-panel">
          <thead className="spdc-register-thead">
            <tr>
              {!hidePackage && <th className="text-left sticky-col" rowSpan={2}>Package</th>}
              <th rowSpan={2}>SR. NO</th>
              <th rowSpan={2}>DESCRIPTION</th>
              <th rowSpan={2} className="min-w-[140px]">SHAPE OF BAR</th>
              <th rowSpan={2}>DIA</th>
              <th rowSpan={2}>NO PER MEMBER</th>
              <th rowSpan={2}>NO OF MEMBER</th>
              <th rowSpan={2}>TOTAL NOS OF BARS</th>
              <th colSpan={5}>SHAPE LENGTH</th>
              <th rowSpan={2}>Cutting Length</th>
              <th rowSpan={2}>Total LENGTH</th>
              <th rowSpan={2}>Weight kg</th>
              <th rowSpan={2} />
            </tr>
            <tr>
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>D</th>
              <th>E</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([heading, items]) => (
              <Fragment key={heading}>
                <tr className="boq-section-row">
                  <td colSpan={colSpan} className="sticky-col">
                    <span className="boq-section-label">{heading}</span>
                  </td>
                </tr>
                {items.map((b) => {
              const href = fileHref(b.shapeDiagramPath, b.shapeDiagramUrl);
              const hasDiagram = Boolean(href);
              const isImage = hasDiagram && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(href);
              return (
                <tr key={b.id} className={`boq-line-row ${busyId === b.id ? "opacity-60" : ""}`}>
                  {!hidePackage && (
                  <td className="sticky-col wrap text-left align-top">
                    {canFullEdit ? (
                      <CellInput value={b.packageName} onCommit={(v) => void patchLine(b.id, { packageName: v })} />
                    ) : (
                      b.packageName
                    )}
                  </td>
                  )}
                  <td className="wrap font-medium text-left align-top">
                    {canEditDims ? (
                      <CellInput value={b.barMark} onCommit={(v) => void patchLine(b.id, { barMark: v })} />
                    ) : (
                      b.barMark || "—"
                    )}
                  </td>
                  <td className="wrap min-w-[140px]">
                    {canEditDims ? (
                      <CellInput
                        value={b.location || b.sectionMark || ""}
                        onCommit={(v) => void patchLine(b.id, { location: v })}
                      />
                    ) : (
                      b.location || b.sectionMark || "—"
                    )}
                  </td>
                  <td className="align-top">
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
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
                    {canEditDims ? (
                      <CellInput type="number" value={b.nos} onCommit={(v) => void patchLine(b.id, { nos: Number(v) || 0 })} />
                    ) : (
                      fmtNum(b.nos)
                    )}
                  </td>
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
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
                  <td>
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
                    {canFullEdit && (
                      <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                        Del
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
              </Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={colSpan} className="empty text-left p-6">
                  No BBS rows — upload a BBS sheet in setup or add via structure import.
                </td>
              </tr>
            )}
          </tbody>
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

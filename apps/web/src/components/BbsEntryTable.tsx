/**
 * BBS register — one shape diagram upload per bar-mark row (matches SPDC BBS sheet).
 */
import { useState } from "react";
import { api, apiBase } from "../api";
import { FilePickButton } from "./FilePickButton";
import PdfMarkup from "./PdfMarkup";
import ImageMarkup from "./ImageMarkup";

export type BbsRow = {
  id: string;
  packageName: string;
  barMark?: string | null;
  diameterMm?: number;
  shape?: string | null;
  lengthMm?: number;
  nos?: number;
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
  canUpload: boolean;
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

export function BbsEntryTable({ projectId, token, rows, canUpload, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markupRow, setMarkupRow] = useState<BbsRow | null>(null);
  const [shapeDraft, setShapeDraft] = useState<File | null>(null);
  const [shapePreview, setShapePreview] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

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

  return (
    <div className="sheet-register w-full space-y-2">
      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <div className="sheet-register__head">
        <span>Bar bending schedule — one diagram per mark (SPDC sheet)</span>
        <span className="text-steel-muted font-normal normal-case tracking-normal">
          {uploaded}/{rows.length} shared · use Upload + markup on each row
        </span>
      </div>

      <div className="sheet-register__scroll">
        <table className="sheet-register__table">
          <thead>
            <tr>
              {["Package", "Mark", "Dia mm", "Shape code", "Length", "Nos", "Total L", "Weight kg", "Location", "Diagram"].map(
                (h, i) => (
                  <th key={h} className={i === 0 ? "sticky-col" : undefined}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const href = fileHref(b.shapeDiagramPath, b.shapeDiagramUrl);
              const hasDiagram = Boolean(href);
              return (
                <tr key={b.id}>
                  <td className="sticky-col wrap">{b.packageName}</td>
                  <td className="wrap font-medium">{b.barMark || "—"}</td>
                  <td>{b.diameterMm ?? "—"}</td>
                  <td className="wrap">{b.shape || "—"}</td>
                  <td>{b.lengthMm ?? "—"}</td>
                  <td>{b.nos ?? "—"}</td>
                  <td>{b.totalLength ?? "—"}</td>
                  <td>{b.weightKg ?? "—"}</td>
                  <td className="wrap">{b.location || "—"}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {hasDiagram ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                            Saved
                          </span>
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
                      ) : (
                        <span className="text-xs text-amber-700">Pending</span>
                      )}
                      {canUpload && (
                        <FilePickButton
                          accept="image/*,application/pdf"
                          onPick={(files) => onPickForRow(b, files)}
                          variant="ghost"
                          className="!text-xs !py-1 !px-2"
                        >
                          {busyId === b.id ? "…" : hasDiagram ? "Replace" : "Upload + markup"}
                        </FilePickButton>
                      )}
                      {!canUpload && !hasDiagram && <span className="text-steel-muted text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="empty">
                  No BBS rows — import Excel above or run seed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {markupRow && shapeDraft && (
        <div className="markup-modal" role="dialog" aria-modal="true" aria-label="BBS row shape markup">
          <div className="markup-modal__backdrop" onClick={closeMarkup} />
          <div className="markup-modal__panel max-w-4xl">
            <div className="markup-modal__head">
              <span>
                Mark {rowLabel(markupRow)} · {markupRow.shape ? `shape ${markupRow.shape}` : "bend diagram"}
              </span>
              <button type="button" className="markup-modal__close" onClick={closeMarkup}>
                ×
              </button>
            </div>
            <div className="markup-modal__body">
              {shapeDraft.type === "application/pdf" || shapeDraft.name.toLowerCase().endsWith(".pdf") ? (
                <PdfMarkup
                  src={shapeDraft}
                  saveLabel="Save diagram for this mark"
                  onCancel={closeMarkup}
                  onSave={async (markedPages) => {
                    const file = markedPages[0] || shapeDraft;
                    await uploadShapeForRow(markupRow, file);
                  }}
                />
              ) : (
                <ImageMarkup
                  src={shapePreview || shapeDraft}
                  saveLabel="Save diagram for this mark"
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
    </div>
  );
}

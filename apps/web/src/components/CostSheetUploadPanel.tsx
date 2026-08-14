/**
 * Cost sheet upload — BBS / MB Excel import + BBS shape diagrams with PDF/image markup.
 */
import { FormEvent, useMemo, useState } from "react";
import { api, apiBase } from "../api";
import { Button, Card, Input, Select } from "./ui";
import { FilePickButton } from "./FilePickButton";
import PdfMarkup from "./PdfMarkup";
import ImageMarkup from "./ImageMarkup";

export type SheetFileRecord = {
  id: string;
  kind: string;
  packageName?: string;
  fileName: string;
  rowCount?: number;
  storagePath?: string;
  shareUrl?: string;
  provider?: string;
  barMark?: string;
  createdAt: string;
};

type Props = {
  projectId: string;
  token?: string | null;
  kind: "bbs" | "mb";
  packageName: string;
  packageOptions: string[];
  barMarks?: string[];
  files: SheetFileRecord[];
  canEdit: boolean;
  onChanged: () => void;
};

function fileHref(path?: string, shareUrl?: string) {
  if (shareUrl?.startsWith("http")) return shareUrl;
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${apiBase()}${path}`;
  return `${apiBase()}/uploads/onedrive/${path}`;
}

export function CostSheetUploadPanel({
  projectId,
  token,
  kind,
  packageName,
  packageOptions,
  barMarks = [],
  files,
  canEdit,
  onChanged,
}: Props) {
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [replacePkg, setReplacePkg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pkg, setPkg] = useState(packageName !== "All" ? packageName : packageOptions[0] || "Dormitory BBS");
  const [barMark, setBarMark] = useState("");
  const [shapeDraft, setShapeDraft] = useState<File | null>(null);
  const [shapePreview, setShapePreview] = useState<string | null>(null);

  const kindFiles = useMemo(
    () => files.filter((f) => f.kind === kind || (kind === "bbs" && f.kind === "bbs_shape")),
    [files, kind]
  );
  const sheetUploads = kindFiles.filter((f) => f.kind === kind);
  const shapeUploads = kindFiles.filter((f) => f.kind === "bbs_shape");

  async function uploadSheet(e: FormEvent) {
    e.preventDefault();
    if (!sheetFile || !canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", sheetFile);
      fd.append("packageName", pkg);
      if (replacePkg) fd.append("replace", "1");
      const r = await api<{ rowsImported: number; file?: { url?: string; sharePointUrl?: string } }>(
        `/api/cost/${projectId}/${kind}/import`,
        { method: "POST", token, body: fd }
      );
      setSheetFile(null);
      setMsg(
        `Imported ${r.rowsImported} rows → ${pkg}${
          r.file?.sharePointUrl ? " · SharePoint link ready" : " · saved to project library"
        }`
      );
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadShape(file: File) {
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("packageName", pkg);
      if (barMark.trim()) fd.append("barMark", barMark.trim());
      const r = await api<{ file?: { url?: string; sharePointUrl?: string } }>(
        `/api/cost/${projectId}/bbs/shape`,
        { method: "POST", token, body: fd }
      );
      setShapeDraft(null);
      setShapePreview(null);
      setMsg(`Shape diagram uploaded${barMark ? ` for mark ${barMark}` : ""}`);
      onChanged();
      if (r.file?.sharePointUrl) window.open(r.file.sharePointUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Shape upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onPickShape(files: File[]) {
    const file = files[0];
    if (!file) return;
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
    void uploadShape(file);
  }

  const folderHint =
    kind === "bbs"
      ? "07.06_Method_Statements… / BBS / {package} / sheets | shapes"
      : "09.02_Joint_Measurement / {package} / sheets";

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      {canEdit && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-sm mb-1">Upload {kind.toUpperCase()} Excel sheet</h3>
            <p className="text-xs text-steel-muted mb-3 font-mono break-all">{folderHint}</p>
            <form className="space-y-3" onSubmit={uploadSheet}>
              <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
                {(packageOptions.length ? packageOptions : ["Dormitory BBS", "Dormitory Civil"]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-xs text-steel-muted">
                <input type="checkbox" checked={replacePkg} onChange={(e) => setReplacePkg(e.target.checked)} />
                Replace existing lines for this package before import
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSheetFile(e.target.files?.[0] || null)}
              />
              <Button type="submit" disabled={!sheetFile || busy}>
                {busy ? "Importing…" : `Import ${kind.toUpperCase()} sheet`}
              </Button>
            </form>
          </Card>

          {kind === "bbs" && (
            <Card>
              <h3 className="font-semibold text-sm mb-1">Upload shape diagram (mark / bend)</h3>
              <p className="text-xs text-steel-muted mb-3">
                PDF or image — annotate with markup before upload. Links to bar mark optional.
              </p>
              <div className="space-y-3">
                <Select value={barMark} onChange={(e) => setBarMark(e.target.value)}>
                  <option value="">Bar mark (optional)…</option>
                  {barMarks.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Or type mark e.g. B1, C12"
                  value={barMark}
                  onChange={(e) => setBarMark(e.target.value)}
                />
                <FilePickButton accept="image/*,application/pdf" onPick={onPickShape}>
                  Pick PDF / image
                </FilePickButton>
              </div>
            </Card>
          )}
        </div>
      )}

      {kind === "bbs" && shapeDraft && (
        <div className="markup-modal" role="dialog" aria-modal="true" aria-label="BBS shape markup">
          <div className="markup-modal__backdrop" onClick={() => { setShapeDraft(null); setShapePreview(null); }} />
          <div className="markup-modal__panel max-w-4xl">
            <div className="markup-modal__head">
              <span>Annotate shape — {barMark || "general"}</span>
              <button type="button" className="markup-modal__close" onClick={() => { setShapeDraft(null); setShapePreview(null); }}>
                ×
              </button>
            </div>
            <div className="markup-modal__body">
              {shapeDraft.type === "application/pdf" || shapeDraft.name.toLowerCase().endsWith(".pdf") ? (
                <PdfMarkup
                  src={shapeDraft}
                  saveLabel="Upload marked shape to SharePoint"
                  onCancel={() => { setShapeDraft(null); setShapePreview(null); }}
                  onSave={async (markedPages) => {
                    const file = markedPages[0] || shapeDraft;
                    await uploadShape(file);
                  }}
                />
              ) : (
                <ImageMarkup
                  src={shapePreview || shapeDraft}
                  saveLabel="Upload marked shape to SharePoint"
                  filename={`bbs-shape-${barMark || "general"}`}
                  onCancel={() => { setShapeDraft(null); setShapePreview(null); }}
                  onSave={async (file) => {
                    await uploadShape(file);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <h3 className="font-semibold text-sm mb-2">Shared files ({kindFiles.length})</h3>
        <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
          {sheetUploads.map((f) => (
            <li key={f.id} className="border border-line px-3 py-2 rounded-sm flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{f.fileName}</div>
                <div className="text-xs text-steel-muted">
                  {f.rowCount ?? 0} rows · {new Date(f.createdAt).toLocaleString("en-IN")}
                  {f.provider ? ` · ${f.provider}` : ""}
                </div>
              </div>
              <a
                href={fileHref(f.storagePath, f.shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand font-medium"
              >
                Open / share
              </a>
            </li>
          ))}
          {kind === "bbs" &&
            shapeUploads.map((f) => (
              <li key={f.id} className="border border-line px-3 py-2 rounded-sm flex flex-wrap items-center justify-between gap-2 bg-sand/40">
                <div>
                  <div className="font-medium">
                    {f.barMark ? `Mark ${f.barMark} · ` : ""}
                    {f.fileName}
                  </div>
                  <div className="text-xs text-steel-muted">Shape diagram · {new Date(f.createdAt).toLocaleString("en-IN")}</div>
                </div>
                <a
                  href={fileHref(f.storagePath, f.shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand font-medium"
                >
                  Open / share
                </a>
              </li>
            ))}
          {!kindFiles.length && <li className="text-steel-muted text-xs">No uploads yet — import Excel or add shape diagrams above.</li>}
        </ul>
      </Card>
    </div>
  );
}

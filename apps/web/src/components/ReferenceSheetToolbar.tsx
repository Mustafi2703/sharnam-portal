import { useRef } from "react";
import { Button } from "./ui";

type ReferenceSheetToolbarProps = {
  sheetLabel: string;
  rowCount?: number;
  canEdit?: boolean;
  onAddRow?: () => void;
  onUpload?: (file: File) => void | Promise<void>;
  uploadTitle?: string;
  uploadHint?: string;
  onDownloadCsv?: () => void;
  onDownloadXlsx?: () => void;
  onDownloadHtml?: () => void;
  onPublishSharePoint?: () => void | Promise<void>;
  publishLabel?: string;
  sharePointUrl?: string | null;
  onGenerate?: () => void;
  generateLabel?: string;
  busy?: boolean;
  message?: string;
};

/** Compact register actions — upload, add row, load template. No overlay modal. */
export function ReferenceSheetToolbar({
  sheetLabel,
  rowCount,
  canEdit,
  onAddRow,
  onUpload,
  uploadHint,
  onDownloadCsv,
  onDownloadXlsx,
  onDownloadHtml,
  onPublishSharePoint,
  publishLabel = "Publish to SharePoint",
  sharePointUrl,
  onGenerate,
  generateLabel = "Generate pack",
  busy,
  message,
}: ReferenceSheetToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sheet-actions-bar shrink-0 flex flex-wrap items-center justify-between gap-2 px-1 py-1">
      <div className="min-w-0 text-left">
        <strong className="text-sm text-ink">{sheetLabel}</strong>
        {rowCount != null && <span className="text-xs text-steel-muted ml-2">{rowCount} rows</span>}
        {message && <p className="text-xs text-steel-muted mt-0.5">{message}</p>}
        {sharePointUrl && (
          <a href={sharePointUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand font-semibold ml-2">
            Open in SharePoint ↗
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {onDownloadXlsx && (
          <Button type="button" variant="secondary" onClick={onDownloadXlsx} disabled={busy}>
            Download XLSX
          </Button>
        )}
        {onDownloadHtml && (
          <Button type="button" variant="secondary" onClick={onDownloadHtml} disabled={busy}>
            Download PDF (HTML)
          </Button>
        )}
        {onPublishSharePoint && (
          <Button type="button" variant="secondary" onClick={() => void onPublishSharePoint()} disabled={busy}>
            {publishLabel}
          </Button>
        )}
        {canEdit && onUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              title={uploadHint || "Upload sheet"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(file);
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload sheet
            </Button>
          </>
        )}
        {canEdit && onAddRow && (
          <Button type="button" onClick={onAddRow} disabled={busy}>
            + Add row
          </Button>
        )}
        {onGenerate && (
          <Button type="button" onClick={onGenerate} disabled={busy}>
            {busy ? "Saving…" : generateLabel}
          </Button>
        )}
        {onDownloadCsv && (
          <Button type="button" variant="secondary" onClick={onDownloadCsv} disabled={busy}>
            CSV
          </Button>
        )}
      </div>
    </div>
  );
}

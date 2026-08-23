import { useState } from "react";
import { Button } from "./ui";
import { SheetUploadModal } from "./SheetUploadModal";

type ReferenceSheetToolbarProps = {
  sheetLabel: string;
  rowCount?: number;
  canEdit?: boolean;
  /** Opens add-row modal — inline form on page stays visible too */
  onAddRow?: () => void;
  onUpload?: (file: File) => void | Promise<void>;
  uploadTitle?: string;
  uploadHint?: string;
  onDownloadCsv?: () => void;
  onDownloadXlsx?: () => void;
  onGenerate?: () => void;
  generateLabel?: string;
  busy?: boolean;
  message?: string;
};

/** Shared toolbar — upload modal, add row, download client format. Mobile sticky bar. */
export function ReferenceSheetToolbar({
  sheetLabel,
  rowCount,
  canEdit,
  onAddRow,
  onUpload,
  uploadTitle,
  uploadHint,
  onDownloadCsv,
  onDownloadXlsx,
  onGenerate,
  generateLabel = "Generate pack",
  busy,
  message,
}: ReferenceSheetToolbarProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <div className="reference-sheet-toolbar mb-4">
        <div className="reference-sheet-toolbar__info">
          <span className="maker-toolbar__label">Reference sheet</span>
          <strong className="block text-sm text-ink">{sheetLabel}</strong>
          {rowCount != null && <span className="text-xs text-steel-muted">{rowCount} rows</span>}
          {message && <p className="text-xs text-steel-muted mt-1 w-full">{message}</p>}
        </div>
        <div className="reference-sheet-toolbar__actions">
          {canEdit && onUpload && (
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)} disabled={busy}>
              Upload sheet
            </Button>
          )}
          {canEdit && onAddRow && (
            <Button type="button" onClick={onAddRow} disabled={busy}>
              + Add row
            </Button>
          )}
          {onGenerate && (
            <Button type="button" onClick={onGenerate} disabled={busy}>
              {generateLabel}
            </Button>
          )}
          {onDownloadCsv && (
            <Button type="button" variant="secondary" onClick={onDownloadCsv} disabled={busy}>
              CSV
            </Button>
          )}
          {onDownloadXlsx && (
            <Button type="button" variant="secondary" onClick={onDownloadXlsx} disabled={busy}>
              XLSX
            </Button>
          )}
        </div>
      </div>

      {onUpload && (
        <SheetUploadModal
          open={uploadOpen}
          title={uploadTitle || `Upload — ${sheetLabel}`}
          sheetLabel={sheetLabel}
          hint={uploadHint}
          busy={busy}
          onClose={() => setUploadOpen(false)}
          onUpload={async (file) => {
            await onUpload(file);
            setUploadOpen(false);
          }}
        />
      )}
    </>
  );
}

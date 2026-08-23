import { Button } from "./ui";

type ReferenceSheetToolbarProps = {
  sheetLabel: string;
  rowCount?: number;
  canEdit?: boolean;
  onAddRow?: () => void;
  onResync?: () => void;
  onDownloadCsv?: () => void;
  onDownloadXlsx?: () => void;
  busy?: boolean;
  message?: string;
};

/** Shared toolbar for reference-sheet modules — add row, resync pack, download client format */
export function ReferenceSheetToolbar({
  sheetLabel,
  rowCount,
  canEdit,
  onAddRow,
  onResync,
  onDownloadCsv,
  onDownloadXlsx,
  busy,
  message,
}: ReferenceSheetToolbarProps) {
  return (
    <div className="maker-toolbar flex flex-wrap items-end gap-3 mb-4">
      <div className="maker-toolbar__field flex-[2] min-w-[200px]">
        <span className="maker-toolbar__label">Reference sheet</span>
        <strong className="block text-sm">{sheetLabel}</strong>
        {rowCount != null && <span className="text-xs text-steel-muted">{rowCount} rows</span>}
      </div>
      {canEdit && onAddRow && (
        <Button type="button" variant="secondary" onClick={onAddRow} disabled={busy}>
          + Add row
        </Button>
      )}
      {canEdit && onResync && (
        <Button type="button" variant="secondary" onClick={onResync} disabled={busy}>
          Resync from pack
        </Button>
      )}
      {onDownloadCsv && (
        <Button type="button" variant="secondary" onClick={onDownloadCsv} disabled={busy}>
          Download CSV
        </Button>
      )}
      {onDownloadXlsx && (
        <Button type="button" onClick={onDownloadXlsx} disabled={busy}>
          Download XLSX
        </Button>
      )}
      {message && <p className="text-xs text-steel-muted w-full">{message}</p>}
    </div>
  );
}

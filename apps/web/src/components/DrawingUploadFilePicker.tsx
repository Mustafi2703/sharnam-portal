import { useRef } from "react";
import { Button } from "./ui";
import { formatUiText } from "../lib/formatUiText";

export type MarkupPageDraft = { pageNumber: number; file: File };

export function DrawingUploadFilePicker({
  pdfFile,
  dwgFile,
  onPdfFile,
  onDwgFile,
  onMarkupPdf,
  markupPageCount = 0,
  disabled,
}: {
  pdfFile: File | null;
  dwgFile: File | null;
  onPdfFile: (f: File | null) => void;
  onDwgFile: (f: File | null) => void;
  onMarkupPdf?: () => void;
  markupPageCount?: number;
  disabled?: boolean;
}) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const dwgRef = useRef<HTMLInputElement>(null);

  const canMarkup =
    pdfFile &&
    (pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf"));

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
        {formatUiText("Revision files — PDF and DWG are stored separately")}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-sand/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">PDF</span>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs !py-1"
              disabled={disabled}
              onClick={() => pdfRef.current?.click()}
            >
              {pdfFile ? formatUiText("Replace") : formatUiText("Choose PDF")}
            </Button>
          </div>
          <p className="text-[11px] text-steel-muted">{formatUiText("View in portal")}</p>
          {pdfFile && (
            <div className="rounded border border-line bg-white px-2 py-1.5 text-xs font-mono truncate">{pdfFile.name}</div>
          )}
          {pdfFile && (
            <div className="flex flex-wrap gap-2">
              {canMarkup && onMarkupPdf && (
                <Button type="button" variant="secondary" className="!text-xs" onClick={onMarkupPdf}>
                  {formatUiText("Mark up PDF")}
                </Button>
              )}
              <Button type="button" variant="ghost" className="!text-xs" onClick={() => onPdfFile(null)}>
                {formatUiText("Clear PDF")}
              </Button>
            </div>
          )}
          {markupPageCount > 0 && (
            <p className="text-[11px] text-brand font-medium">
              {formatUiText(`${markupPageCount} marked page(s) ready to save`)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-line bg-sand/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">DWG</span>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs !py-1"
              disabled={disabled}
              onClick={() => dwgRef.current?.click()}
            >
              {dwgFile ? formatUiText("Replace") : formatUiText("Choose DWG")}
            </Button>
          </div>
          <p className="text-[11px] text-steel-muted">{formatUiText("Download only · no in-app preview")}</p>
          {dwgFile && (
            <>
              <div className="rounded border border-line bg-white px-2 py-1.5 text-xs font-mono truncate">{dwgFile.name}</div>
              <Button type="button" variant="ghost" className="!text-xs" onClick={() => onDwgFile(null)}>
                {formatUiText("Clear DWG")}
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={pdfRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => onPdfFile(e.target.files?.[0] || null)}
      />
      <input
        ref={dwgRef}
        type="file"
        accept=".dwg,application/acad,.dwg"
        className="hidden"
        onChange={(e) => onDwgFile(e.target.files?.[0] || null)}
      />

      {!pdfFile && !dwgFile && (
        <p className="text-xs text-steel-muted">
          {formatUiText("Add at least one file per revision. Both PDF and DWG can be uploaded together.")}
        </p>
      )}
    </div>
  );
}

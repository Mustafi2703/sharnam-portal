import { useRef } from "react";
import { Button } from "./ui";
import { formatUiText } from "../lib/formatUiText";

export type MarkupPageDraft = { pageNumber: number; file: File };

function isDwg(file: File) {
  return /\.dwg$/i.test(file.name);
}

export function DrawingUploadFilePicker({
  pdfFile,
  dwgFile,
  extraPdfFiles = [],
  onPdfFile,
  onDwgFile,
  onExtraPdfFiles,
  onMarkupPdf,
  markupPageCount = 0,
  disabled,
}: {
  pdfFile: File | null;
  dwgFile: File | null;
  extraPdfFiles?: File[];
  onPdfFile: (f: File | null) => void;
  onDwgFile: (f: File | null) => void;
  onExtraPdfFiles?: (files: File[]) => void;
  onMarkupPdf?: () => void;
  markupPageCount?: number;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  const canMarkup =
    pdfFile &&
    (pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf"));

  function takePrimary(files: File[]) {
    let nextPdf = pdfFile;
    let nextDwg = dwgFile;
    const extras = [...extraPdfFiles];
    for (const file of files) {
      if (isDwg(file)) {
        nextDwg = file;
        onDwgFile(file);
      } else if (!nextPdf) {
        nextPdf = file;
        onPdfFile(file);
      } else if (onExtraPdfFiles) {
        extras.push(file);
      } else {
        nextPdf = file;
        onPdfFile(file);
      }
    }
    if (onExtraPdfFiles && extras.length !== extraPdfFiles.length) onExtraPdfFiles(extras);
  }

  const chosen = [
    pdfFile ? { key: "pdf", name: pdfFile.name, clear: () => onPdfFile(null) } : null,
    dwgFile ? { key: "dwg", name: dwgFile.name, clear: () => onDwgFile(null) } : null,
  ].filter(Boolean) as { key: string; name: string; clear: () => void }[];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-sand/20 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{formatUiText("Drawing Files")}</span>
          <Button
            type="button"
            variant="secondary"
            className="!text-xs !py-1"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            {formatUiText(chosen.length ? "Choose DWG or PDF" : "Choose DWG or PDF")}
          </Button>
        </div>
        {chosen.map((file) => (
          <div key={file.key} className="flex items-center justify-between gap-2 rounded border border-line bg-white px-2 py-1.5 text-xs">
            <span className="font-mono truncate">{file.name}</span>
            <Button type="button" variant="ghost" className="!text-xs !py-1" onClick={file.clear}>
              {formatUiText("Remove")}
            </Button>
          </div>
        ))}
        {canMarkup && onMarkupPdf ? (
          <Button type="button" variant="secondary" className="!text-xs" onClick={onMarkupPdf}>
            {formatUiText("Markup")}
          </Button>
        ) : null}
        {onExtraPdfFiles ? (
          <div className="space-y-1">
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              disabled={disabled}
              onClick={() => extraRef.current?.click()}
            >
              {formatUiText("Upload More Drawings On This Revision")}
            </Button>
            {extraPdfFiles.map((file) => (
              <div key={`${file.name}-${file.size}`} className="rounded border border-line bg-white px-2 py-1 text-[11px] font-mono truncate">
                {file.name}
              </div>
            ))}
            {extraPdfFiles.length > 0 ? (
              <Button type="button" variant="ghost" className="!text-xs" onClick={() => onExtraPdfFiles([])}>
                {formatUiText("Clear Extra Files")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {markupPageCount > 0 ? (
          <p className="text-[11px] text-brand font-medium">
            {formatUiText(`${markupPageCount} marked page(s) ready to save`)}
          </p>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.dwg,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          takePrimary(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <input
        ref={extraRef}
        type="file"
        accept=".pdf,.dwg,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          if (picked.length) takePrimary(picked);
          e.target.value = "";
        }}
      />
    </div>
  );
}

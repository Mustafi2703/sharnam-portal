import { useRef } from "react";
import { Button } from "./ui";
import { formatUiText } from "../lib/formatUiText";

export type DrawingFileKind = "pdf" | "dwg";

export function DrawingUploadFilePicker({
  fileKind,
  onFileKind,
  file,
  onFile,
  onMarkup,
  disabled,
}: {
  fileKind: DrawingFileKind | null;
  onFileKind: (k: DrawingFileKind | null) => void;
  file: File | null;
  onFile: (f: File | null, kind: DrawingFileKind) => void;
  onMarkup?: () => void;
  disabled?: boolean;
}) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const dwgRef = useRef<HTMLInputElement>(null);

  function pick(kind: DrawingFileKind, f: File | null) {
    if (!f) {
      onFile(null, kind);
      return;
    }
    onFileKind(kind);
    onFile(f, kind);
  }

  const canMarkup =
    file &&
    fileKind === "pdf" &&
    (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted">{formatUiText("Upload type")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={fileKind === "pdf" ? "primary" : "secondary"}
          className="!text-xs !py-2.5"
          disabled={disabled}
          onClick={() => {
            onFileKind("pdf");
            pdfRef.current?.click();
          }}
        >
          PDF
          <span className="block text-[10px] font-normal opacity-80 mt-0.5">{formatUiText("View + optional markup")}</span>
        </Button>
        <Button
          type="button"
          variant={fileKind === "dwg" ? "primary" : "secondary"}
          className="!text-xs !py-2.5"
          disabled={disabled}
          onClick={() => {
            onFileKind("dwg");
            dwgRef.current?.click();
          }}
        >
          DWG
          <span className="block text-[10px] font-normal opacity-80 mt-0.5">{formatUiText("Download only · no preview")}</span>
        </Button>
      </div>

      <input
        ref={pdfRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => pick("pdf", e.target.files?.[0] || null)}
      />
      <input
        ref={dwgRef}
        type="file"
        accept=".dwg,application/acad,.dwg"
        className="hidden"
        onChange={(e) => pick("dwg", e.target.files?.[0] || null)}
      />

      {file && (
        <div className="rounded-lg border border-line bg-sand/30 px-3 py-2 text-sm">
          <div className="font-mono text-xs text-ink truncate">{file.name}</div>
          <div className="text-[11px] text-steel-muted mt-0.5">
            {fileKind === "dwg" ? formatUiText("DWG — stored for download") : formatUiText("PDF — ready to upload or mark up")}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {canMarkup && onMarkup && (
              <Button type="button" variant="secondary" className="!text-xs" onClick={onMarkup}>
                Mark up PDF
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="!text-xs"
              onClick={() => {
                onFileKind(null);
                onFile(null, fileKind || "pdf");
                if (pdfRef.current) pdfRef.current.value = "";
                if (dwgRef.current) dwgRef.current.value = "";
              }}
            >
              Clear file
            </Button>
          </div>
        </div>
      )}

      {!file && (
        <p className="text-xs text-steel-muted">{formatUiText("Choose PDF or DWG above — markup opens in a separate full-screen step.")}</p>
      )}
    </div>
  );
}

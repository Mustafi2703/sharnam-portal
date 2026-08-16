import { Button } from "./ui";
import type { DrawingPreview } from "../lib/drawingPreview";

type Props = {
  preview: DrawingPreview;
  variant?: "inline" | "modal";
  onClose?: () => void;
  className?: string;
};

/** PDF / image / DWG preview — inline pane or full-screen modal */
export function DrawingFileViewer({ preview, variant = "inline", onClose, className = "" }: Props) {
  const body = (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line bg-procore-navy text-white shrink-0">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{preview.title}</div>
          <div className="text-[11px] text-white/70 truncate">{preview.fileName || preview.fileUrl}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={preview.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-white/90">
            Open tab
          </a>
          {onClose && (
            <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-[280px] bg-sand/60">
        {preview.kind === "image" && (
          <img src={preview.fileUrl} alt={preview.title} className="max-h-[70vh] mx-auto object-contain p-4 w-full" />
        )}
        {preview.kind === "pdf" && (
          <iframe title={preview.title} src={preview.fileUrl} className="w-full h-[min(70vh,520px)] min-h-[320px] border-0" />
        )}
        {preview.kind === "dwg" && (
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-steel-muted max-w-md mx-auto">
              DWG is stored in SharePoint — open in AutoCAD or download from the link below.
            </p>
            <a
              href={preview.fileUrl}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-4 py-2 text-sm font-semibold"
              target="_blank"
              rel="noreferrer"
            >
              Download DWG →
            </a>
          </div>
        )}
        {preview.kind === "other" && (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-steel-muted">Preview not available. Download or open in a new tab.</p>
            <a href={preview.fileUrl} className="text-brand font-semibold" target="_blank" rel="noreferrer">
              Download / open file →
            </a>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-6">
        <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          {body}
        </div>
      </div>
    );
  }

  return <div className="rounded-xl border border-line bg-paper overflow-hidden shadow-sm h-full">{body}</div>;
}

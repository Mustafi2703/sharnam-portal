import { Button } from "./ui";

/** In-app preview for PDF and images — other types open in a new tab. */
export function DocumentPreviewModal({
  title,
  url,
  fileName,
  onClose,
}: {
  title: string;
  url: string;
  fileName?: string;
  onClose: () => void;
}) {
  const lower = (fileName || url).toLowerCase();
  const isPdf = lower.endsWith(".pdf") || url.includes("application/pdf");
  const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(lower);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-paper rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{title}</div>
            {fileName && <div className="text-[11px] text-steel-muted truncate">{fileName}</div>}
          </div>
          <div className="flex gap-2 shrink-0">
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
              Open in new tab
            </a>
            <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-2 bg-sand/30">
          {isPdf ? (
            <iframe title={title} src={url} className="w-full h-[70vh] rounded border border-line bg-white" />
          ) : isImage ? (
            <img src={url} alt={fileName || title} className="max-w-full max-h-[70vh] mx-auto block rounded" />
          ) : (
            <div className="text-sm text-steel-muted text-center py-12">
              Preview not available for this file type.{" "}
              <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">
                Download / open
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

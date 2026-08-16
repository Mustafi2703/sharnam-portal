import { useMemo, useState } from "react";
import { Button } from "./ui";
import type { DrawingPreview, DrawingRevisionPreview } from "../lib/drawingPreview";
import { latestMarkupByPage } from "../lib/drawingPreview";

type Props =
  | { preview: DrawingPreview; variant?: "inline" | "modal"; onClose?: () => void; className?: string }
  | {
      revision: DrawingRevisionPreview;
      variant?: "inline" | "modal";
      onClose?: () => void;
      className?: string;
    };

function fmtWhen(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RevisionViewer({ revision, onClose, className = "" }: { revision: DrawingRevisionPreview; onClose?: () => void; className?: string }) {
  const markupGroups = useMemo(() => latestMarkupByPage(revision.markupPages), [revision.markupPages]);
  const tabs = useMemo(() => {
    const t: { id: string; label: string }[] = [];
    if (revision.pdf) t.push({ id: "pdf", label: "Original PDF" });
    if (markupGroups.length) t.push({ id: "markup", label: `Markup (${markupGroups.length} pages)` });
    if (revision.dwg) t.push({ id: "dwg", label: "DWG" });
    return t;
  }, [revision, markupGroups.length]);

  const [tab, setTab] = useState(tabs[0]?.id || "pdf");
  const [markupPage, setMarkupPage] = useState(0);
  const [historyIdx, setHistoryIdx] = useState(0);

  const activeMarkup = markupGroups[markupPage];
  const activeHistory = activeMarkup?.history[historyIdx];

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line bg-procore-navy text-white shrink-0">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{revision.title}</div>
          <div className="text-[11px] text-white/70 truncate">
            {[revision.pdf?.fileName && "PDF", revision.dwg?.fileName && "DWG", markupGroups.length && `${markupGroups.length} marked pages`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {onClose && (
          <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b border-line bg-sand/40 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium border ${
                tab === t.id ? "bg-procore-navy text-white border-procore-navy" : "bg-paper text-ink border-line"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-[280px] bg-sand/60 overflow-auto">
        {tab === "pdf" && revision.pdf && (
          <iframe title={revision.title} src={revision.pdf.fileUrl} className="w-full h-[min(70vh,520px)] min-h-[320px] border-0" />
        )}

        {tab === "dwg" && revision.dwg && (
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-steel-muted max-w-md mx-auto">
              DWG is stored in SharePoint — open in AutoCAD or download from the link below.
            </p>
            <div className="text-xs font-mono text-steel-muted">{revision.dwg.fileName}</div>
            <a
              href={revision.dwg.fileUrl}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-4 py-2 text-sm font-semibold"
              target="_blank"
              rel="noreferrer"
            >
              Download DWG →
            </a>
          </div>
        )}

        {tab === "markup" && markupGroups.length > 0 && (
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-steel-muted uppercase tracking-wide">Page</span>
              {markupGroups.map((g, i) => (
                <button
                  key={g.pageNumber}
                  type="button"
                  onClick={() => {
                    setMarkupPage(i);
                    setHistoryIdx(0);
                  }}
                  className={`rounded px-2 py-1 text-xs font-mono border ${
                    i === markupPage ? "bg-brand text-white border-brand" : "bg-paper border-line"
                  }`}
                >
                  {g.pageNumber}
                </button>
              ))}
            </div>

            {activeMarkup && activeHistory && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-steel-muted">
                    Page {activeMarkup.pageNumber} · {activeHistory.fileName || "Markup"}
                    {activeHistory.uploadedBy?.fullName ? ` · ${activeHistory.uploadedBy.fullName}` : ""}
                    {activeHistory.createdAt ? ` · ${fmtWhen(activeHistory.createdAt)}` : ""}
                  </div>
                  {activeMarkup.history.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border border-line rounded disabled:opacity-40"
                        disabled={historyIdx >= activeMarkup.history.length - 1}
                        onClick={() => setHistoryIdx((i) => i + 1)}
                      >
                        Older
                      </button>
                      <span className="text-[10px] font-mono text-steel-muted">
                        {historyIdx + 1}/{activeMarkup.history.length}
                      </span>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border border-line rounded disabled:opacity-40"
                        disabled={historyIdx <= 0}
                        onClick={() => setHistoryIdx((i) => i - 1)}
                      >
                        Newer
                      </button>
                    </div>
                  )}
                </div>
                <img
                  src={activeHistory.fileUrl}
                  alt={`Markup page ${activeMarkup.pageNumber}`}
                  className="max-h-[65vh] mx-auto object-contain w-full rounded-lg border border-line bg-white"
                />
                <a href={activeHistory.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand font-semibold">
                  Open markup in new tab →
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleViewer({ preview, onClose, className = "" }: { preview: DrawingPreview; onClose?: () => void; className?: string }) {
  return (
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
}

/** PDF / image / DWG preview — inline pane or full-screen modal; revision mode shows PDF, DWG, and markup history */
export function DrawingFileViewer(props: Props) {
  const variant = props.variant ?? "inline";
  const body = "revision" in props ? (
    <RevisionViewer revision={props.revision} onClose={props.onClose} className={props.className} />
  ) : (
    <SimpleViewer preview={props.preview} onClose={props.onClose} className={props.className} />
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

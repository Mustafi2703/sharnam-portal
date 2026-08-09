import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ImageMarkup from "./ImageMarkup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * PdfMarkup — render a PDF page-by-page and let user annotate each page.
 * Annotated PDFs come back as PNGs (one per page); a "Save all" returns the array.
 */

type Props = {
  src: string | File | null;
  onSave?: (files: File[]) => void;
  onCancel?: () => void;
  saveLabel?: string;
};

export default function PdfMarkup({ src, onSave, onCancel, saveLabel = "Save annotated pages" }: Props) {
  const [pages, setPages] = useState<string[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [markedUp, setMarkedUp] = useState<Record<number, File>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!src) return;
    setLoading(true);
    setErr("");
    (async () => {
      try {
        const arrayBuffer = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const rendered: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push(canvas.toDataURL("image/png"));
        }
        setPages(rendered);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load PDF");
      } finally {
        setLoading(false);
      }
    })();
  }, [src]);

  function saveAll() {
    const files = pages.map((_, i) => markedUp[i]).filter((f): f is File => !!f);
    onSave?.(files);
  }

  if (loading) return <div className="text-sm text-steel-muted">Rendering PDF…</div>;
  if (err) return <div className="text-sm text-danger">{err}</div>;
  if (!pages.length) return <div className="text-sm text-steel-muted">Provide a PDF to annotate.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setPageIdx((i) => Math.max(0, i - 1))} disabled={pageIdx === 0} className="px-2 py-1 border border-line rounded bg-white disabled:opacity-30">‹ Prev</button>
        <span>Page {pageIdx + 1} / {pages.length}</span>
        <button type="button" onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))} disabled={pageIdx >= pages.length - 1} className="px-2 py-1 border border-line rounded bg-white disabled:opacity-30">Next ›</button>
        <span className="text-steel-muted ml-2">Marked: {Object.keys(markedUp).length}</span>
        <div className="ml-auto flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded border border-line bg-white">Cancel</button>}
          <button type="button" onClick={saveAll} className="px-3 py-1.5 rounded bg-ink text-white font-semibold">{saveLabel}</button>
        </div>
      </div>

      <ImageMarkup
        key={pageIdx}
        src={markedUp[pageIdx] || pages[pageIdx]}
        filename={`pdf-page-${pageIdx + 1}`}
        saveLabel="Keep markup"
        onSave={(f) => setMarkedUp((prev) => ({ ...prev, [pageIdx]: f }))}
      />
    </div>
  );
}

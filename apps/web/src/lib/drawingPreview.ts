import { apiBase } from "../api";

export type DrawingPreview = {
  title: string;
  fileUrl: string;
  fileName?: string;
  kind: "pdf" | "image" | "dwg" | "other";
};

export type DrawingMarkupPage = {
  id?: string;
  pageNumber: number;
  fileUrl: string;
  fileName?: string;
  createdAt?: string;
  uploadedBy?: { fullName?: string } | null;
};

export type DrawingRevisionPreview = {
  title: string;
  pdf?: { fileUrl: string; fileName?: string };
  dwg?: { fileUrl: string; fileName?: string };
  markupPages?: DrawingMarkupPage[];
};

export function resolveDrawingFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http")) return fileUrl;
  if (fileUrl.startsWith("/")) return `${apiBase()}${fileUrl}`;
  return `${apiBase()}/uploads/onedrive/${fileUrl}`;
}

export function drawingFileKind(nameOrUrl?: string | null): DrawingPreview["kind"] {
  const n = (nameOrUrl || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/.test(n)) return "image";
  if (/\.pdf(\?|$)/.test(n)) return "pdf";
  if (/\.dwg(\?|$)/.test(n)) return "dwg";
  return "other";
}

export function revisionPdfUrl(rev: {
  pdfFileUrl?: string | null;
  pdfFileName?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
}) {
  if (rev.pdfFileUrl) return { fileUrl: resolveDrawingFileUrl(rev.pdfFileUrl), fileName: rev.pdfFileName || undefined };
  if (drawingFileKind(rev.fileName || rev.fileUrl) === "pdf" && rev.fileUrl) {
    return { fileUrl: resolveDrawingFileUrl(rev.fileUrl), fileName: rev.fileName || undefined };
  }
  return null;
}

export function revisionDwgUrl(rev: {
  dwgFileUrl?: string | null;
  dwgFileName?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
}) {
  if (rev.dwgFileUrl) return { fileUrl: resolveDrawingFileUrl(rev.dwgFileUrl), fileName: rev.dwgFileName || undefined };
  if (drawingFileKind(rev.fileName || rev.fileUrl) === "dwg" && rev.fileUrl) {
    return { fileUrl: resolveDrawingFileUrl(rev.fileUrl), fileName: rev.fileName || undefined };
  }
  return null;
}

export function revisionPreviewFromRecord(
  d: { drawingNumber?: string; currentRev?: string },
  rev: {
    revisionNumber?: string;
    pdfFileUrl?: string | null;
    pdfFileName?: string | null;
    dwgFileUrl?: string | null;
    dwgFileName?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    markupPages?: DrawingMarkupPage[];
  }
): DrawingRevisionPreview {
  const pdf = revisionPdfUrl(rev);
  const dwg = revisionDwgUrl(rev);
  const markupPages = (rev.markupPages || []).map((p) => ({
    ...p,
    fileUrl: resolveDrawingFileUrl(p.fileUrl),
  }));
  return {
    title: `${d.drawingNumber} · ${rev.revisionNumber || d.currentRev || "—"}`,
    pdf: pdf || undefined,
    dwg: dwg || undefined,
    markupPages,
  };
}

export function latestMarkupByPage(pages: DrawingMarkupPage[] = []) {
  const map = new Map<number, DrawingMarkupPage[]>();
  for (const p of pages) {
    const list = map.get(p.pageNumber) || [];
    list.push(p);
    map.set(p.pageNumber, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, history]) => ({
      pageNumber,
      history: history.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
      latest: history[0],
    }));
}

type RevisionRecord = {
  id?: string;
  revisionNumber?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  pdfFileUrl?: string | null;
  pdfFileName?: string | null;
  dwgFileUrl?: string | null;
  dwgFileName?: string | null;
  markupPages?: DrawingMarkupPage[];
  createdAt?: string;
};

function revisionHasFile(rev?: RevisionRecord | null) {
  return !!(rev?.pdfFileUrl || rev?.fileUrl || rev?.dwgFileUrl);
}

export function latestDrawingRevision(drawing: { revisions?: RevisionRecord[] }) {
  const revs = drawing?.revisions || [];
  if (!revs.length) return null;
  return revs[revs.length - 1];
}

/** Prefer currentRev when it has files, else latest revision with a PDF/DWG. */
export function currentDrawingRevision(drawing: { currentRev?: string; revisions?: RevisionRecord[] }) {
  const revs = drawing?.revisions || [];
  if (!revs.length) return null;
  const byCurrent = drawing.currentRev ? revs.find((r) => r.revisionNumber === drawing.currentRev) : null;
  if (byCurrent && revisionHasFile(byCurrent)) return byCurrent;
  return [...revs].reverse().find(revisionHasFile) || revs[revs.length - 1];
}

export function drawingHasPreviewFile(drawing: { currentRev?: string; revisions?: RevisionRecord[] }) {
  return revisionHasFile(currentDrawingRevision(drawing));
}

export function drawingPreviewFromRecord(drawing: {
  drawingNumber?: string;
  title?: string;
  currentRev?: string;
  revisions?: RevisionRecord[];
}): DrawingPreview | null {
  const rev = currentDrawingRevision(drawing);
  if (!rev) return null;
  const pdf = revisionPdfUrl(rev);
  if (pdf) {
    return {
      title: `${drawing.drawingNumber || "Drawing"} — ${drawing.title || ""}`.trim(),
      fileUrl: pdf.fileUrl,
      fileName: pdf.fileName,
      kind: "pdf",
    };
  }
  const dwg = revisionDwgUrl(rev);
  if (dwg) {
    return {
      title: `${drawing.drawingNumber || "Drawing"} — ${drawing.title || ""}`.trim(),
      fileUrl: dwg.fileUrl,
      fileName: dwg.fileName,
      kind: "dwg",
    };
  }
  if (!rev.fileUrl) return null;
  const fileName = rev.fileName || rev.fileUrl;
  return {
    title: `${drawing.drawingNumber || "Drawing"} — ${drawing.title || ""}`.trim(),
    fileUrl: resolveDrawingFileUrl(rev.fileUrl),
    fileName,
    kind: drawingFileKind(fileName),
  };
}

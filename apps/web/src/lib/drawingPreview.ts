import { apiBase } from "../api";

export type DrawingPreview = {
  title: string;
  fileUrl: string;
  fileName?: string;
  kind: "pdf" | "image" | "dwg" | "other";
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

export function latestDrawingRevision(drawing: { revisions?: { fileUrl?: string; fileName?: string; createdAt?: string }[] }) {
  const revs = drawing?.revisions || [];
  if (!revs.length) return null;
  return revs[revs.length - 1];
}

export function drawingPreviewFromRecord(drawing: {
  drawingNumber?: string;
  title?: string;
  revisions?: { fileUrl?: string; fileName?: string }[];
}): DrawingPreview | null {
  const rev = latestDrawingRevision(drawing);
  if (!rev?.fileUrl) return null;
  const fileName = rev.fileName || rev.fileUrl;
  return {
    title: `${drawing.drawingNumber || "Drawing"} — ${drawing.title || ""}`.trim(),
    fileUrl: resolveDrawingFileUrl(rev.fileUrl),
    fileName,
    kind: drawingFileKind(fileName),
  };
}

import { api } from "../api";

export type MarkupPageDraft = { pageNumber: number; file: File };

export async function uploadDrawingMarkupPages(
  revisionId: string,
  pages: MarkupPageDraft[],
  token: string | null,
  note?: string
) {
  if (!pages.length) return;
  const fd = new FormData();
  pages.forEach((p) => fd.append("files", p.file));
  fd.append("pageNumbers", JSON.stringify(pages.map((p) => p.pageNumber)));
  if (note) fd.append("note", note);
  await api(`/api/drawings/revision/${revisionId}/markup-pages`, { method: "POST", token, body: fd });
}

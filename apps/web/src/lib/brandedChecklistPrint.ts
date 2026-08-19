import { apiBase } from "../api";

/** Download branded checklist HTML and open for Print → Save as PDF (no popup blocker). */
export async function downloadBrandedChecklistPrint(submissionId: string, token?: string | null) {
  const url = `${apiBase()}/api/checklist/submissions/${submissionId}/branded.html`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Branded download failed");
  }
  const html = await res.text();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match?.[1] || `checklist-${submissionId.slice(0, 8)}.html`;

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();

  const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (w) {
    w.addEventListener("load", () => {
      try {
        w.print();
      } catch {
        /* user can print manually */
      }
    });
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Download branded checklist Excel table. */
export async function downloadBrandedChecklistXlsx(submissionId: string, token?: string | null) {
  const url = `${apiBase()}/api/checklist/submissions/${submissionId}/branded.xlsx`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Branded Excel download failed");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match?.[1] || `checklist-${submissionId.slice(0, 8)}.xlsx`;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

/** @deprecated use downloadBrandedChecklistPrint */
export function openBrandedChecklistPrint(submission: { id?: string }) {
  if (submission?.id) {
    void downloadBrandedChecklistPrint(submission.id);
  }
}

/** GFC register helpers — map revisions by R0…Rn, not upload order. */

export function revNumIndex(revisionNumber?: string | null): number {
  const n = parseInt(String(revisionNumber || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : -1;
}

export function normalizeRevNumber(revisionNumber?: string | null): string {
  return String(revisionNumber || "").trim().toUpperCase();
}

/** Latest row per revision number (handles legacy duplicate uploads). */
export function gfcRevisionsByNumber(revisions: { revisionNumber?: string; createdAt?: string | Date }[]): any[] {
  const byNum = new Map<string, any>();
  for (const r of revisions) {
    const key = normalizeRevNumber(r.revisionNumber);
    if (!key) continue;
    const prev = byNum.get(key);
    if (!prev || new Date(r.createdAt || 0).getTime() > new Date(prev.createdAt || 0).getTime()) {
      byNum.set(key, r);
    }
  }
  return [...byNum.values()].sort((a, b) => revNumIndex(a.revisionNumber) - revNumIndex(b.revisionNumber));
}

export function gfcRevisionForSlot(revisions: any[], slotLabel: string): any | undefined {
  const slot = revNumIndex(slotLabel);
  if (slot < 0) return undefined;
  return gfcRevisionsByNumber(revisions).find((r) => revNumIndex(r.revisionNumber) === slot);
}

/** Columns only for revisions that exist. A new column appears after a new revision is saved. */
export function gfcRevSlots(drawings: { revisions?: { revisionNumber?: string }[] }[]): string[] {
  const nums = new Set<number>();
  for (const d of drawings) {
    for (const r of d.revisions || []) {
      const n = revNumIndex(r.revisionNumber);
      if (n >= 0) nums.add(n);
    }
  }
  return [...nums].sort((a, b) => a - b).map((n) => `R${n}`);
}

export function gfcNextRevisionNumber(revisions: { revisionNumber?: string }[]): string {
  const maxNum = (revisions || []).reduce((max, r) => Math.max(max, revNumIndex(r.revisionNumber)), -1);
  return `R${maxNum + 1}`;
}

export function gfcCurrentRevision(d: {
  currentRev?: string;
  revisions?: any[];
}): any | undefined {
  const revs = gfcRevisionsByNumber(d.revisions || []);
  if (!revs.length) return undefined;
  const byCurrent = revs.find((r) => normalizeRevNumber(r.revisionNumber) === normalizeRevNumber(d.currentRev));
  if (byCurrent) return byCurrent;
  const published = revs.filter((r) => r.published);
  if (published.length) {
    return published.sort((a, b) => revNumIndex(b.revisionNumber) - revNumIndex(a.revisionNumber))[0];
  }
  return revs[revs.length - 1];
}

/** Portal placeholder from a date-only GFC import — not a real PDF/DWG. */
export function isRealDrawingFile(url?: string | null): boolean {
  if (!url) return false;
  return !/\/pending\//i.test(url);
}

export function revisionUploadStatus(rev?: {
  pdfFileUrl?: string | null;
  dwgFileUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  pdfFileName?: string | null;
  dwgFileName?: string | null;
} | null): { pdf: boolean; dwg: boolean; pdfUrl: string | null; dwgUrl: string | null } {
  if (!rev) return { pdf: false, dwg: false, pdfUrl: null, dwgUrl: null };
  const pdfUrl = isRealDrawingFile(rev.pdfFileUrl) ? rev.pdfFileUrl! : null;
  const dwgUrl = isRealDrawingFile(rev.dwgFileUrl) ? rev.dwgFileUrl! : null;
  const fileUrl = isRealDrawingFile(rev.fileUrl) ? rev.fileUrl! : null;
  const name = `${rev.fileName || ""} ${rev.pdfFileName || ""} ${rev.dwgFileName || ""}`;
  const pdf = !!pdfUrl || (!!fileUrl && /\.pdf/i.test(name || fileUrl));
  const dwg = !!dwgUrl || (!!fileUrl && /\.dwg/i.test(name || fileUrl));
  return {
    pdf,
    dwg,
    pdfUrl: pdfUrl || (pdf ? fileUrl : null),
    dwgUrl: dwgUrl || (dwg ? fileUrl : null),
  };
}

export function drawingCheckFilled(drawing?: { revisions?: { preCheckSubmissionId?: string | null }[] } | null): boolean {
  return !!(drawing?.revisions || []).some((r) => r.preCheckSubmissionId);
}

export function gfcDateLabel(r?: {
  plannedDate?: string | Date | null;
  actualDate?: string | Date | null;
  createdAt?: string | Date | null;
}): string {
  if (!r) return "—";
  const fmt = (d?: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const planned = fmt(r.plannedDate);
  const actual = fmt(r.actualDate);
  if (planned || actual) {
    return `${planned ? `P:${planned}` : ""}${planned && actual ? " " : ""}${actual ? `A:${actual}` : ""}`.trim();
  }
  return fmt(r.createdAt) || "—";
}

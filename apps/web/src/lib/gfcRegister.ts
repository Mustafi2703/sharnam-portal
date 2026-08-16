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

export function gfcRevSlots(drawings: { revisions?: { revisionNumber?: string }[] }[]): string[] {
  let max = 5;
  for (const d of drawings) {
    for (const r of d.revisions || []) {
      max = Math.max(max, revNumIndex(r.revisionNumber));
    }
  }
  return Array.from({ length: max + 1 }, (_, i) => `R${i}`);
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

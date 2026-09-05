/** Rows that are real lesson entries vs Excel header / section labels. */
export function isContentLessonRow(row: {
  srNo?: number | null;
  description?: string | null;
  category?: string | null;
  wentWell?: string | null;
  notMetExpectation?: string | null;
  lessonsLearnt?: string | null;
  valueDifferentiator?: string | null;
}): boolean {
  const desc = (row.description || row.category || "").trim();
  if (!desc) return false;
  if (/^updated on /i.test(desc)) return false;
  if (/processors and packers/i.test(desc) && !row.wentWell?.trim() && !row.notMetExpectation?.trim() && !row.lessonsLearnt?.trim()) {
    return false;
  }
  if (/this document could be used and implemented/i.test(desc)) return false;

  const hasContent = !!(
    row.wentWell?.trim() ||
    row.notMetExpectation?.trim() ||
    row.lessonsLearnt?.trim() ||
    row.valueDifferentiator?.trim()
  );
  if (hasContent) return true;
  if (row.srNo != null && row.srNo > 0) return true;
  return false;
}

export function nextLessonSrNo(rows: { srNo?: number | null }[]): number {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.srNo) || 0), 0);
  return max + 1;
}

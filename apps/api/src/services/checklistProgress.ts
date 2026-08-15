/** Checklist fill progress — answered lines, evidence links, uploaded files */

export type LineResponsePayload = {
  answer?: string;
  remarks?: string;
  remark?: string;
  value?: string;
  evidenceLinks?: string[];
};

export function parseResponsesJson(raw?: string | null): Record<string, LineResponsePayload> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function computeChecklistProgress(
  itemCount: number,
  responsesJson: string,
  fileEvidenceCount = 0
) {
  const responses = parseResponsesJson(responsesJson);
  const entries = Object.values(responses);
  const answered = entries.filter((r) => String(r.answer || r.value || "").trim()).length;
  const linkEvidence = entries.reduce(
    (s, r) => s + (Array.isArray(r.evidenceLinks) ? r.evidenceLinks.filter((u) => String(u).trim()).length : 0),
    0
  );
  const totalItems = Math.max(itemCount, 0);
  const answerPct = totalItems ? Math.round((answered / totalItems) * 100) : 0;
  const evidenceCount = fileEvidenceCount + linkEvidence;

  return {
    totalItems,
    answered,
    unanswered: Math.max(totalItems - answered, 0),
    answerPct,
    evidenceCount,
    linkEvidence,
    fileEvidence: fileEvidenceCount,
    progressLabel: totalItems ? `${answered}/${totalItems}` : "0/0",
    statusHint:
      answered === 0
        ? "Not started"
        : answered >= totalItems
          ? "All items answered"
          : `${answerPct}% answered`,
  };
}

export function attachProgress<T extends { responsesJson: string; photos?: { id: string }[] }>(
  submission: T,
  itemCount: number
) {
  return {
    ...submission,
    progress: computeChecklistProgress(itemCount, submission.responsesJson, submission.photos?.length || 0),
  };
}

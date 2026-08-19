/** Branded Drawing Check / checklist fill — Excel table matching Sharnam header + item grid */
import XLSX from "../lib/xlsx.js";

type Submission = {
  status?: string | null;
  remarks?: string | null;
  createdAt?: Date | string | null;
  responsesJson?: string;
  submittedBy?: { fullName?: string | null; email?: string | null } | null;
  drawing?: { drawingNumber?: string | null; title?: string | null } | null;
  revisionNumber?: string | null;
  assignment?: {
    template?: {
      name?: string | null;
      checklistType?: string | null;
      items?: Array<{
        id: string;
        itemCode?: string | null;
        description?: string | null;
        instruction?: string | null;
        sortOrder?: number | null;
      }>;
    } | null;
  } | null;
};

export function buildBrandedChecklistXlsxBuffer(submission: Submission, project?: { name?: string; code?: string }) {
  const template = submission.assignment?.template;
  const items = [...(template?.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let responses: Record<string, { answer?: string; remarks?: string; remark?: string; value?: string }> = {};
  try {
    responses =
      typeof submission.responsesJson === "string"
        ? JSON.parse(submission.responsesJson || "{}")
        : (submission.responsesJson as unknown as typeof responses) || {};
  } catch {
    responses = {};
  }

  const wb = XLSX.utils.book_new();
  const meta: (string | number)[][] = [
    ["शरणम् — Sharnam PMC Portal"],
    ["Drawing Check / Checklist Fill — Branded Export"],
    [],
    ["Project", project?.name || project?.code || "—"],
    ["Project code", project?.code || "—"],
    ["Checklist", template?.name || "—"],
    ["Family", template?.checklistType || "—"],
    ["Drawing", submission.drawing ? `${submission.drawing.drawingNumber || ""} — ${submission.drawing.title || ""}`.trim() : "—"],
    ["Revision", submission.revisionNumber || "—"],
    ["Filled by", submission.submittedBy?.fullName || "—"],
    ["Email", submission.submittedBy?.email || "—"],
    ["Submitted", submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "—"],
    ["Status", submission.status || "—"],
    ["Overall remarks", submission.remarks || "—"],
    [],
    ["Sr", "Item code", "Check item", "Instruction", "Answer", "Remarks"],
  ];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const ans = responses[it.id] || responses[it.itemCode || ""] || {};
    const answer = typeof ans === "string" ? ans : ans.answer || ans.value || "";
    const remark = typeof ans === "object" ? ans.remarks || ans.remark || "" : "";
    meta.push([
      i + 1,
      it.itemCode || "",
      it.description || "",
      it.instruction || "",
      String(answer),
      String(remark),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(meta);
  ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 42 }, { wch: 28 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, "Checklist");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

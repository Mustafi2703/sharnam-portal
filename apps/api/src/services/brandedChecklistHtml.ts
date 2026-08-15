/** Branded checklist fill HTML — shared by API download and print view */

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBrandedChecklistHtml(submission: {
  status?: string | null;
  remarks?: string | null;
  createdAt?: Date | string | null;
  responsesJson?: string;
  submittedBy?: { fullName?: string | null } | null;
  drawing?: { drawingNumber?: string | null; title?: string | null } | null;
  assignment?: {
    template?: {
      name?: string | null;
      checklistType?: string | null;
      items?: Array<{
        id: string;
        itemCode?: string | null;
        description?: string | null;
        instruction?: string | null;
      }>;
    } | null;
  } | null;
}, logoUrl = "/logo.png") {
  const template = submission?.assignment?.template;
  const items = template?.items || [];
  let responses: Record<string, { answer?: string; remarks?: string; remark?: string; value?: string }> = {};
  try {
    responses =
      typeof submission.responsesJson === "string"
        ? JSON.parse(submission.responsesJson || "{}")
        : (submission.responsesJson as unknown as typeof responses) || {};
  } catch {
    responses = {};
  }

  const rows = items
    .map((it) => {
      const ans = responses[it.id] || responses[it.itemCode || ""] || {};
      const answer = typeof ans === "string" ? ans : ans.answer || ans.value || "—";
      const remark = typeof ans === "object" ? ans.remarks || ans.remark || "" : "";
      return `<tr>
        <td>${escapeHtml(it.itemCode || "")}</td>
        <td><div class="item">${escapeHtml(it.description || "")}</div>${it.instruction ? `<div class="hint">${escapeHtml(it.instruction)}</div>` : ""}</td>
        <td class="ans">${escapeHtml(String(answer))}</td>
        <td>${escapeHtml(String(remark))}</td>
      </tr>`;
    })
    .join("");

  const when = submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "—";
  const filledBy = submission.submittedBy?.fullName || "—";
  const drawing = submission.drawing
    ? `${submission.drawing.drawingNumber || ""} ${submission.drawing.title || ""}`.trim()
    : "—";
  const name = template?.name || "Checklist fill";
  const family = template?.checklistType || "Checklist";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name)} — Sharnam</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 0; background: #fff; }
    .sheet { max-width: 920px; margin: 0 auto; }
    .hero { background: linear-gradient(135deg,#0f1b2d,#1e3a5f 55%,#254a73); color: white; padding: 24px 28px; display:flex; gap:16px; align-items:center; }
    .hero img { height: 52px; background: white; border-radius: 8px; padding: 6px 10px; }
    h1 { margin: 0; font-size: 20px; }
    .meta { padding: 16px 28px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    .meta strong { display:block; color:#64748b; font-size:9px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align:left; background:#f8fafc; font-size:10px; text-transform:uppercase; color:#64748b; padding:8px 10px; border-bottom:1px solid #e2e8f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .item { font-weight: 600; }
    .hint { font-size: 11px; color: #64748b; margin-top: 3px; }
    .ans { font-weight: 600; color: #1e3a5f; }
    .foot { padding: 12px 28px 20px; font-size: 10px; color: #64748b; display:flex; justify-content:space-between; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <img src="${escapeHtml(logoUrl)}" alt="Sharnam" />
      <div>
        <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#fbbf24;margin-bottom:4px;">शरणम् · Sharnam PMC</div>
        <h1>${escapeHtml(name)}</h1>
        <div style="opacity:.85;margin-top:4px;font-size:12px;">${escapeHtml(family)} · filled record</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>Filled by</strong>${escapeHtml(filledBy)}</div>
      <div><strong>Submitted</strong>${escapeHtml(when)}</div>
      <div><strong>Drawing</strong>${escapeHtml(drawing)}</div>
      <div><strong>Status</strong>${escapeHtml(submission.status || "—")}</div>
      ${submission.remarks ? `<div style="grid-column:1/-1"><strong>Remarks</strong>${escapeHtml(submission.remarks)}</div>` : ""}
    </div>
    <table>
      <thead><tr><th>#</th><th>Item</th><th>Answer</th><th>Notes</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#64748b;">No line items</td></tr>`}</tbody>
    </table>
    <div class="foot">
      <span>Sharnam Portal · confidential project record</span>
      <span>${escapeHtml(new Date().toLocaleString())}</span>
    </div>
  </div>
</body>
</html>`;
}

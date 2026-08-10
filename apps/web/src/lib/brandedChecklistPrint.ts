/** Open a beautiful Sharnam-branded checklist fill for Print → Save as PDF */
export function openBrandedChecklistPrint(submission: any) {
  const template = submission?.assignment?.template;
  const items: any[] = template?.items || [];
  let responses: Record<string, any> = {};
  try {
    responses =
      typeof submission.responsesJson === "string"
        ? JSON.parse(submission.responsesJson || "{}")
        : submission.responsesJson || {};
  } catch {
    responses = {};
  }

  const rows = items
    .map((it) => {
      const ans = responses[it.id] || responses[it.itemCode] || {};
      const answer = typeof ans === "string" ? ans : ans.answer || ans.value || "—";
      const remark = typeof ans === "object" ? ans.remarks || ans.remark || ans.notes || "" : "";
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;width:48px;color:#64748b;font-size:12px;">${it.itemCode || ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(it.description || "")}</div>
          ${it.instruction ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(it.instruction)}</div>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-weight:600;color:#1e3a5f;">${escapeHtml(String(answer))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#64748b;font-size:13px;">${escapeHtml(String(remark))}</td>
      </tr>`;
    })
    .join("");

  const when = submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "—";
  const filledBy = submission.submittedBy?.fullName || "—";
  const drawing = submission.drawing
    ? `${submission.drawing.drawingNumber || ""} ${submission.drawing.title || ""}`.trim()
    : "—";
  const family = template?.checklistType || "Checklist";
  const name = template?.name || "Checklist fill";
  const origin = window.location.origin;
  const logo = `${origin}/logo.png`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name)} — Sharnam</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 0; background: #f8fafc; }
    .sheet { max-width: 900px; margin: 24px auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(15,27,45,.08); }
    .hero { background: linear-gradient(135deg,#0f1b2d,#1e3a5f 55%,#254a73); color: white; padding: 28px 32px; display:flex; gap:20px; align-items:center; }
    .hero img { height: 56px; width: auto; background: white; border-radius: 10px; padding: 6px 10px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
    .meta { padding: 20px 32px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .meta strong { display:block; color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; font-weight:600; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align:left; background:#f8fafc; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; padding:10px 12px; border-bottom:1px solid #e2e8f0; }
    .foot { padding: 16px 32px 28px; font-size: 11px; color: #64748b; display:flex; justify-content:space-between; gap:12px; }
    .actions { text-align:center; margin: 16px; }
    .actions button { background:#f59e0b; color:white; border:0; border-radius:10px; padding:10px 18px; font-weight:600; cursor:pointer; }
    @media print { .actions { display:none; } body { background:white; } .sheet { box-shadow:none; margin:0; border:0; } }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="hero">
      <img src="${logo}" alt="Sharnam" onerror="this.style.display='none'" />
      <div>
        <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#fbbf24;margin-bottom:6px;">शरणम् · Sharnam PMC</div>
        <h1>${escapeHtml(name)}</h1>
        <div style="opacity:.85;margin-top:6px;font-size:13px;">${escapeHtml(family)} checklist fill record</div>
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
      <tbody>${rows || `<tr><td colspan="4" style="padding:24px;text-align:center;color:#64748b;">No line items</td></tr>`}</tbody>
    </table>
    <div class="foot">
      <span>Generated from Sharnam Portal · confidential project record</span>
      <span>${escapeHtml(new Date().toLocaleString())}</span>
    </div>
  </div>
  <script>setTimeout(() => { try { window.print(); } catch(e) {} }, 400);</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

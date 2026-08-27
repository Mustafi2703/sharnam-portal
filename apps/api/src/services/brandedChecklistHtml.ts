/** Branded checklist fill HTML — SPDC form colours (navy bands, yellow inputs, OK/Fail/NA coding) */
import { checklistLogoDataUri, collectChecklistSignSlots } from "./checklistSignoff.js";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classifyAnswer(answer: string): "ok" | "fail" | "na" | "pending" | "other" {
  const a = String(answer || "")
    .trim()
    .toLowerCase();
  if (!a || a === "—" || a === "-") return "pending";
  if (/^(n\/?a|na|not applicable)$/i.test(a)) return "na";
  if (/^(ok|yes|y|pass|passed|compliant|satisfactory|cleared|s1|good|true|✓|✔)$/i.test(a)) return "ok";
  if (/^(not\s*ok|nok|no|n|fail|failed|non[- ]?compliant|unsatisfactory|reject|rejected|s3|s4|false|✗|✘)$/i.test(a))
    return "fail";
  if (/pending|open|partial|hold|s2|conditional/i.test(a)) return "pending";
  return "other";
}

function familyOf(type?: string | null) {
  const t = String(type || "").toLowerCase();
  if (t.includes("safety")) return { title: "SITE SAFETY INSPECTION CHECKLIST", doc: "SPDC/HSE/F-02  Rev. 0" };
  if (t.includes("drawing")) return { title: "DRAWING CHECK CHECKLIST", doc: "Drawing Check Master" };
  if (t.includes("rfi") || t.includes("information"))
    return { title: "REQUEST FOR INFORMATION (RFI)", doc: "SPDC/QMS/F-RFI-01" };
  return { title: "ACTIVITY INSPECTION CHECKLIST", doc: "SPDC/QA/F-02  Rev. 0" };
}

export function buildBrandedChecklistHtml(
  submission: {
    status?: string | null;
    remarks?: string | null;
    createdAt?: Date | string | null;
    responsesJson?: string;
    revisionNumber?: string | null;
    submittedBy?: { fullName?: string | null } | null;
    drawing?: { drawingNumber?: string | null; title?: string | null } | null;
    reviewedAt?: Date | string | null;
    photos?: { kind?: string | null; fileUrl?: string | null; caption?: string | null }[];
    revision?: {
      revisionNumber?: string | null;
      clientSignName?: string | null;
      clientSignUrl?: string | null;
      pmcSignName?: string | null;
      pmcSignUrl?: string | null;
      siteEngineerSignName?: string | null;
      siteEngineerSignUrl?: string | null;
      contractorSignName?: string | null;
      contractorSignUrl?: string | null;
    } | null;
    assignment?: {
      project?: { name?: string | null; code?: string | null; clientName?: string | null } | null;
      template?: {
        name?: string | null;
        checklistType?: string | null;
        category?: string | null;
        items?: Array<{
          id: string;
          itemCode?: string | null;
          description?: string | null;
          instruction?: string | null;
        }>;
      } | null;
    } | null;
  },
  logoUrl?: string
) {
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

  let ok = 0;
  let fail = 0;
  let na = 0;
  let pending = 0;

  const rows = items
    .map((it, i) => {
      const ans = responses[it.id] || responses[it.itemCode || ""] || {};
      const answer = typeof ans === "string" ? ans : ans.answer || ans.value || "";
      const remark = typeof ans === "object" ? ans.remarks || ans.remark || "" : "";
      const kind = classifyAnswer(String(answer));
      if (kind === "ok") ok += 1;
      else if (kind === "fail") fail += 1;
      else if (kind === "na") na += 1;
      else pending += 1;
      return `<tr>
        <td class="sr">${i + 1}</td>
        <td><div class="item">${escapeHtml(it.description || it.itemCode || "")}</div>${
          it.instruction ? `<div class="hint">${escapeHtml(it.instruction)}</div>` : ""
        }</td>
        <td class="ans ${kind}">${escapeHtml(String(answer || "—"))}</td>
        <td>${escapeHtml(String(remark))}</td>
      </tr>`;
    })
    .join("");

  const when = submission.createdAt ? new Date(submission.createdAt).toLocaleString("en-GB") : "—";
  const filledBy = submission.submittedBy?.fullName || "—";
  const drawing = submission.drawing
    ? `${submission.drawing.drawingNumber || ""} ${submission.drawing.title || ""}`.trim() +
      (submission.revisionNumber || submission.revision?.revisionNumber
        ? ` · ${submission.revisionNumber || submission.revision?.revisionNumber}`
        : "")
    : "—";
  const name = template?.name || "Checklist fill";
  const family = familyOf(template?.checklistType);
  const project = submission.assignment?.project;
  const logo = checklistLogoDataUri() || logoUrl || "";
  const signs = collectChecklistSignSlots(submission);
  const signHtml = signs
    .map(
      (s) => `<div class="sig">
        <div class="sig-role">${escapeHtml(s.role)}</div>
        ${s.dataUri ? `<img src="${s.dataUri}" alt="${escapeHtml(s.name)}"/>` : `<div class="sig-line"></div>`}
        <div class="sig-name">${escapeHtml(s.name)}</div>
        <div class="sig-date">${escapeHtml(s.date || "Date")}</div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name)} — SPDC</title>
  <style>
    @page { margin: 12mm; }
    body { font-family: Calibri, "Segoe UI", sans-serif; color: #111; margin: 0; background: #fff; }
    .sheet { max-width: 960px; margin: 0 auto; border: 1px solid #000; }
    .hero { display: grid; grid-template-columns: 220px 1fr 160px; border-bottom: 1px solid #000; }
    .brand { background: #f2f2f2; padding: 14px 16px; font-weight: 700; font-size: 12px; display:flex; gap:10px; align-items:center; }
    .brand img { height: 40px; background: #fff; padding: 3px 6px; }
    .title { padding: 14px 16px; font-size: 16px; font-weight: 700; }
    .doc { background: #d9d9d9; padding: 10px 12px; font-size: 11px; }
    .doc strong { display:block; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
    .band { background: #1f3864; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 12px; letter-spacing: .04em; }
    .meta { display: grid; grid-template-columns: 160px 1fr 140px 1fr; font-size: 12px; }
    .meta div { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px; }
    .lbl { background: #d9d9d9; font-weight: 600; }
    .val { background: #fff2cc; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #d9d9d9; font-size: 11px; padding: 7px 8px; border: 1px solid #000; }
    td { padding: 7px 8px; border: 1px solid #000; vertical-align: top; }
    .sr { width: 36px; text-align: center; }
    .item { font-weight: 600; }
    .hint { font-size: 11px; color: #555; margin-top: 3px; }
    .ans { font-weight: 700; text-align: center; width: 110px; }
    .ans.ok { background: #c6efce; color: #006100; }
    .ans.fail { background: #ffc7ce; color: #9c0006; }
    .ans.na { background: #ffeb9c; color: #9c5700; }
    .ans.pending, .ans.other { background: #ddebf7; color: #1f4e79; }
    .legend { display:flex; gap: 14px; padding: 8px 12px; font-size: 11px; border-top: 1px solid #000; }
    .sw { display:inline-block; width: 12px; height: 12px; border: 1px solid #000; margin-right: 5px; vertical-align: -2px; }
    .foot { padding: 8px 12px; font-size: 10px; color: #444; display:flex; justify-content:space-between; }
    .sign-band { background: #1f3864; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 12px; letter-spacing: .04em; }
    .signs { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #000; }
    .sig { border-right: 1px solid #000; padding: 8px 10px 12px; min-height: 118px; }
    .sig:last-child { border-right: 0; }
    .sig-role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #1f3864; margin-bottom: 8px; }
    .sig img { display: block; height: 48px; width: auto; max-width: 100%; background: #fff; border-bottom: 1px solid #111; object-fit: contain; }
    .sig-line { height: 48px; border-bottom: 1px solid #111; }
    .sig-name { font-size: 12px; font-weight: 600; margin-top: 6px; }
    .sig-date { font-size: 10px; color: #555; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div class="brand">
        ${logo ? `<img src="${escapeHtml(logo)}" alt="Sharnam" />` : ""}
        <div>SHARNAM PROJECT DEVELOPMENT CONSULTANTS &amp; CO. (SPDC)</div>
      </div>
      <div class="title">${escapeHtml(family.title)}<div style="font-size:12px;font-weight:600;margin-top:4px;">${escapeHtml(name)}</div></div>
      <div class="doc"><strong>Doc. No.</strong>${escapeHtml(family.doc)}</div>
    </div>
    <div class="band">PARTICULARS</div>
    <div class="meta">
      <div class="lbl">Project / Facility</div>
      <div class="val">${escapeHtml(project?.name || project?.code || "—")}</div>
      <div class="lbl">Checklist / IR No.</div>
      <div class="val">${escapeHtml(template?.checklistType || "—")}</div>
      <div class="lbl">Employer / Client</div>
      <div class="val">${escapeHtml(project?.clientName || "—")}</div>
      <div class="lbl">Date of check</div>
      <div class="val">${escapeHtml(when)}</div>
      <div class="lbl">Drawing</div>
      <div class="val">${escapeHtml(drawing)}</div>
      <div class="lbl">Filled by</div>
      <div class="val">${escapeHtml(filledBy)}</div>
      <div class="lbl">Status</div>
      <div class="val">${escapeHtml(submission.status || "—")}</div>
      <div class="lbl">OK / Not OK / NA</div>
      <div class="val">${ok} / ${fail} / ${na}${pending ? ` · ${pending} pending` : ""}</div>
      ${
        submission.remarks
          ? `<div class="lbl">Overall remarks</div><div class="val" style="grid-column:2/-1">${escapeHtml(submission.remarks)}</div>`
          : ""
      }
    </div>
    <table>
      <thead><tr><th>#</th><th>Check description</th><th>Status</th><th>Actual observation / remarks</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;padding:20px;">No line items</td></tr>`}</tbody>
    </table>
    <div class="sign-band">8. SIGNATURES</div>
    <div class="signs">${signHtml}</div>
    <div class="legend">
      <span><i class="sw" style="background:#c6efce"></i>OK / Yes / Pass</span>
      <span><i class="sw" style="background:#ffc7ce"></i>Not OK / No / Fail</span>
      <span><i class="sw" style="background:#ffeb9c"></i>NA</span>
      <span><i class="sw" style="background:#ddebf7"></i>Pending / other</span>
      <span><i class="sw" style="background:#fff2cc"></i>Fill-in cell</span>
    </div>
    <div class="foot">
      <span>Enclosure to IR (SPDC/QA/F-01) · Sharnam Portal project record</span>
      <span>${escapeHtml(new Date().toLocaleString("en-GB"))}</span>
    </div>
  </div>
</body>
</html>`;
}

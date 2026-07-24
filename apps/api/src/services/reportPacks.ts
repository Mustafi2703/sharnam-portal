// @ts-nocheck — HTML pack builders use nested Prisma includes; typed at call sites.
import { prisma } from "../prisma.js";

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Progress Reports checklist mapping:
 *  DrawingCheck → Drawing / GFC section
 *  QualityInspection → Quality / QI section
 *  Safety → Safety section
 *  SiteExecution → DPR daily site checklist activity
 */
function groupSubmissionsByType<
  T extends { assignment: { template: { checklistType: string; name: string } }; submittedBy: { fullName: string | null }; status: string }
>(submissions: T[]) {
  const buckets = {
    DrawingCheck: [] as T[],
    QualityInspection: [] as T[],
    Safety: [] as T[],
    SiteExecution: [] as T[],
    Other: [] as T[],
  };
  for (const s of submissions) {
    const t = s.assignment?.template?.checklistType || "Other";
    if (t in buckets) (buckets as any)[t].push(s);
    else buckets.Other.push(s);
  }
  return {
    buckets,
    counts: {
      drawingChecks: buckets.DrawingCheck.length,
      qualityChecks: buckets.QualityInspection.length,
      safetyChecks: buckets.Safety.length,
      siteChecks: buckets.SiteExecution.length,
      otherChecks: buckets.Other.length,
    },
  };
}

function checklistRowsHtml(
  rows: { assignment: { template: { name: string; checklistType: string } }; submittedBy: { fullName: string | null }; status: string }[]
) {
  return (
    rows
      .map(
        (s) =>
          `<tr><td>${esc(s.assignment.template.checklistType)}</td><td>${esc(s.assignment.template.name)}</td><td>${esc(s.submittedBy.fullName)}</td><td>${esc(s.status)}</td></tr>`
      )
      .join("") || "<tr><td colspan=4>None</td></tr>"
  );
}

export async function buildDprPack(projectId: string, dateInput?: string) {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const [diary, submissions, rfis, safety, photos, drawings, hindrances, qualityNcrs, cubes] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { projectId_logDate: { projectId, logDate: date } },
      include: { manpower: true, equipment: true, notes: true, photos: true },
    }),
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId }, createdAt: { gte: date, lt: next } },
      include: {
        assignment: { include: { template: true } },
        submittedBy: { select: { fullName: true } },
      },
    }),
    prisma.rfi.findMany({
      where: { projectId, OR: [{ status: "Open" }, { createdAt: { gte: date, lt: next } }] },
      take: 40,
      orderBy: { createdAt: "desc" },
    }),
    prisma.safetyRecord.findMany({
      where: { projectId, occurredAt: { gte: date, lt: next } },
      take: 20,
    }),
    prisma.projectPhoto.findMany({
      where: { projectId, createdAt: { gte: date, lt: next } },
      take: 24,
      orderBy: { createdAt: "desc" },
    }),
    prisma.drawing.findMany({ where: { projectId }, take: 30, orderBy: { updatedAt: "desc" } }),
    prisma.progressHindrance.findMany({
      where: { projectId, status: "Open" },
      take: 20,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.qualityNcr.findMany({ where: { projectId, status: "Open" }, take: 20 }),
    prisma.cubeTest.count({ where: { projectId } }),
  ]);

  const manpowerTotal = diary?.manpower.reduce((s: any, m: any) => s + m.workerCount, 0) || 0;
  const byType = groupSubmissionsByType(submissions);
  const pack = {
    type: "DPR" as const,
    generatedAt: new Date().toISOString(),
    date: date.toISOString(),
    project: {
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      designConsultant: project.designConsultant,
      contractorName: project.contractorName,
      location: project.location,
      pmc: "Sharnam Project Development Consultants & Co.",
    },
    kpis: {
      manpowerTotal,
      equipmentCount: diary?.equipment.length || 0,
      checklistsToday: submissions.length,
      ...byType.counts,
      openRfis: rfis.filter((r: any) => r.status === "Open").length,
      safetyEvents: safety.length,
      photosToday: photos.length,
      diaryStatus: diary?.status || "Missing",
      weather: diary?.weatherCondition || "—",
      openHindrances: hindrances.length,
      openQualityNcrs: qualityNcrs.length,
      cubeTests: cubes,
    },
    diary,
    submissions,
    submissionsByType: byType.buckets,
    rfis,
    safety,
    photos,
    drawings,
    hindrances,
    qualityNcrs,
    hindranceNotes: [
      ...(diary?.notes || []).map((n: any) => n.noteText),
      ...hindrances.map((h: any) => h.description),
    ],
  };
  return pack;
}

export async function buildWprPack(projectId: string, endInput?: string) {
  const end = endInput ? new Date(endInput) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const [
    diaries,
    submissions,
    meetings,
    drawings,
    rfis,
    safety,
    submittals,
    cashflow,
    budget,
    mbLines,
    ncrLike,
    milestones,
    hindrances,
    qualityNcrs,
    cubes,
    qap,
  ] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { projectId, logDate: { gte: start, lte: end } },
      include: { manpower: true, equipment: true, _count: { select: { notes: true } } },
      orderBy: { logDate: "asc" },
    }),
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId }, createdAt: { gte: start, lte: end } },
      include: { assignment: { include: { template: true } }, submittedBy: { select: { fullName: true } } },
    }),
    prisma.meeting.findMany({
      where: { projectId, meetingDate: { gte: start, lte: end } },
      include: { items: true },
    }),
    prisma.drawing.findMany({
      where: { projectId },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { drawingNumber: "asc" },
      take: 80,
    }),
    prisma.rfi.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.safetyRecord.findMany({ where: { projectId, occurredAt: { gte: start, lte: end } } }),
    prisma.submittal.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.costCashflowPeriod.findMany({ where: { projectId } }),
    prisma.costBudgetLine.findMany({ where: { projectId } }),
    prisma.costMbLine.findMany({ where: { projectId } }),
    prisma.qualityInspection.findMany({
      where: { projectId, status: { in: ["Open", "Failed", "Rework"] } },
      take: 30,
    }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 40 }),
    prisma.progressHindrance.findMany({ where: { projectId }, take: 30 }),
    prisma.qualityNcr.findMany({ where: { projectId }, take: 40 }),
    prisma.cubeTest.findMany({ where: { projectId }, take: 40, orderBy: { castDate: "desc" } }),
    prisma.qapActivity.findMany({ where: { projectId }, take: 40, orderBy: { weekLabel: "desc" } }),
  ]);

  const manpowerWeek = diaries.reduce(
    (s, d) => s + d.manpower.reduce((a: any, m: any) => a + m.workerCount, 0),
    0
  );
  const budgeted = budget.reduce((s: any, b: any) => s + b.budgetedAmount, 0);
  const certified = budget.reduce((s: any, b: any) => s + b.certifiedAmount, 0);
  const mbQty = mbLines.reduce((s: any, m: any) => s + (m.qty || 0), 0);
  const byType = groupSubmissionsByType(submissions);

  return {
    type: "WPR" as const,
    generatedAt: new Date().toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
    project: {
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      designConsultant: project.designConsultant,
      contractorName: project.contractorName,
      location: project.location,
      pmc: "Sharnam Project Development Consultants & Co.",
    },
    kpis: {
      diaryDays: diaries.length,
      manpowerWeek,
      checklistsSubmitted: submissions.length,
      checklistsApproved: submissions.filter((s: any) => s.status === "Approved").length,
      ...byType.counts,
      meetings: meetings.length,
      openMeetingItems: meetings.flatMap((m: any) => m.items).filter((i: any) => i.resolutionStatus === "Open").length,
      openRfis: rfis.filter((r: any) => r.status === "Open").length,
      drawings: drawings.length,
      publishedDrawings: drawings.filter((d: any) => d.isPublished).length,
      safetyEvents: safety.length,
      openSubmittals: submittals.filter((s: any) => !["Approved", "Rejected"].includes(s.status)).length,
      openQi: ncrLike.length,
      openQualityNcrs: qualityNcrs.filter((n: any) => n.status === "Open").length,
      cubeTests: cubes.length,
      qapOpen: qap.filter((q: any) => q.status === "Open").length,
      delayedMilestones: milestones.filter((m: any) => (m.varianceDays || 0) > 0).length,
      openHindrances: hindrances.filter((h: any) => h.status === "Open").length,
      budgeted,
      certified,
      mbQty,
      mbLines: mbLines.length,
    },
    diaries,
    submissions,
    submissionsByType: byType.buckets,
    meetings,
    drawings,
    rfis,
    safety,
    submittals,
    cashflow,
    budget,
    mbLines,
    qualityActions: ncrLike,
    qualityNcrs,
    cubes,
    qap,
    milestones,
    hindrances,
  };
}

export function renderDprHtml(pack: Awaited<ReturnType<typeof buildDprPack>>) {
  const p = pack.project;
  const rowsMan =
    pack.diary?.manpower
      .map(
        (m) =>
          `<tr><td>${esc(m.companyName)}</td><td>${m.workerCount}</td><td>${m.hoursWorked}</td><td>${esc(m.comments)}</td></tr>`
      )
      .join("") || `<tr><td colspan="4">No manpower logged</td></tr>`;
  const rowsEq =
    pack.diary?.equipment
      .map(
        (e) =>
          `<tr><td>${esc(e.companyName)}</td><td>${esc(e.equipmentType)}</td><td>${e.hoursUsed ?? "—"}</td><td>${esc(e.comments)}</td></tr>`
      )
      .join("") || `<tr><td colspan="4">No equipment logged</td></tr>`;
  const rowsRfi = pack.rfis
    .slice(0, 15)
    .map(
      (r) =>
        `<tr><td>${esc(r.number)}</td><td>${esc(r.subject)}</td><td>${esc(r.status)}</td><td>${fmtDate(r.dueDate)}</td></tr>`
    )
    .join("");
  const notes = pack.hindranceNotes.map((n: any) => `<li>${esc(n)}</li>`).join("") || "<li>None recorded</li>";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>DPR — ${esc(p.code)}</title>
<style>
  body{font-family:"IBM Plex Sans",Segoe UI,Helvetica,Arial,sans-serif;color:#16181C;margin:0;background:#F0F1F2}
  .sheet{width:100%;max-width:1000px;margin:16px auto;background:#fff;border:1px solid #D8DCE3;box-shadow:0 8px 24px rgba(20,30,50,.08)}
  .bar{background:#3D4450;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .bar h1{margin:0;font-size:clamp(16px,2.5vw,20px);letter-spacing:.02em}.bar .sub{opacity:.75;font-size:12px;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:14px 20px;border-bottom:1px solid #e6e9ef;font-size:13px}
  .meta b{color:#64748b;font-weight:600;display:inline-block;min-width:110px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;padding:14px 20px;background:#fafbfc;border-bottom:1px solid #e6e9ef}
  .kpi{border:1px solid #e6e9ef;border-radius:6px;padding:10px;background:#fff}
  .kpi .n{font-size:20px;font-weight:700;color:#C45C26}.kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
  section{padding:16px 20px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#3D4450;border-bottom:2px solid #C45C26;padding-bottom:6px;margin:0 0 10px}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;border-collapse:collapse;font-size:12px;min-width:480px} th,td{border:1px solid #e6e9ef;padding:8px;text-align:left} th{background:#f0f2f5;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
  .foot{padding:12px 20px;font-size:11px;color:#64748b;border-top:1px solid #e6e9ef;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  @media (max-width:640px){.meta{grid-template-columns:1fr}.sheet{margin:0;border:none;box-shadow:none}}
  @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;border:none;max-width:none}}
</style></head><body>
<div class="sheet">
  <div class="bar"><div><div class="sub">शरणम् · Sharnam PMC</div><h1>Daily Progress Report (DPR)</h1></div>
  <div style="text-align:right"><div class="sub">Report date</div><div style="font-size:18px;font-weight:600">${fmtDate(pack.date)}</div></div></div>
  <div class="meta">
    <div><b>Project</b> ${esc(p.name)}</div><div><b>Code</b> ${esc(p.code)}</div>
    <div><b>Client</b> ${esc(p.clientName)}</div><div><b>Location</b> ${esc(p.location)}</div>
    <div><b>Design consultant</b> ${esc(p.designConsultant)}</div><div><b>Contractor</b> ${esc(p.contractorName)}</div>
    <div><b>PMC</b> ${esc(p.pmc)}</div><div><b>Weather / diary</b> ${esc(pack.kpis.weather)} · ${esc(pack.kpis.diaryStatus)}</div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="n">${pack.kpis.manpowerTotal}</div><div class="l">Manpower</div></div>
    <div class="kpi"><div class="n">${pack.kpis.equipmentCount}</div><div class="l">Equipment</div></div>
    <div class="kpi"><div class="n">${pack.kpis.siteChecks}</div><div class="l">Site checklists</div></div>
    <div class="kpi"><div class="n">${pack.kpis.drawingChecks}</div><div class="l">Drawing checks</div></div>
    <div class="kpi"><div class="n">${pack.kpis.qualityChecks}</div><div class="l">QI fills</div></div>
    <div class="kpi"><div class="n">${pack.kpis.safetyChecks}</div><div class="l">Safety fills</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openRfis}</div><div class="l">Open RFIs</div></div>
  </div>
  <section><h2>Manpower</h2><div class="table-wrap"><table><thead><tr><th>Company</th><th>Workers</th><th>Hours</th><th>Comments</th></tr></thead><tbody>${rowsMan}</tbody></table></div></section>
  <section><h2>Equipment</h2><div class="table-wrap"><table><thead><tr><th>Company</th><th>Type</th><th>Hours</th><th>Comments</th></tr></thead><tbody>${rowsEq}</tbody></table></div></section>
  <section><h2>Hindrance / site notes</h2><ul>${notes}</ul></section>
  <section><h2>Hindrance register (open)</h2><div class="table-wrap"><table><thead><tr><th>Description</th><th>Location</th><th>Category</th><th>Days</th></tr></thead><tbody>
  ${
    (pack.hindrances || [])
      .map(
        (h) =>
          `<tr><td>${esc(h.description)}</td><td>${esc(h.location)}</td><td>${esc(h.category)}</td><td>${h.daysImpacted}</td></tr>`
      )
      .join("") || "<tr><td colspan=4>None open</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>Open / today's RFIs (concern register)</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Subject</th><th>Status</th><th>Due</th></tr></thead><tbody>${rowsRfi || "<tr><td colspan=4>None</td></tr>"}</tbody></table></div></section>
  <section><h2>Site execution checklists (Progress)</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.SiteExecution)}</tbody></table></div></section>
  <section><h2>Drawing check fills</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.DrawingCheck)}</tbody></table></div></section>
  <section><h2>Quality inspection fills</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.QualityInspection)}</tbody></table></div></section>
  <section><h2>Safety checklist fills</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.Safety)}</tbody></table></div></section>
  <div class="foot"><span>Generated ${fmtDate(pack.generatedAt)} · Sharnam Portal</span><span>Confidential — client pack</span></div>
</div></body></html>`;
}

export function renderWprHtml(pack: Awaited<ReturnType<typeof buildWprPack>>) {
  const p = pack.project;
  const drawingRows = pack.drawings
    .slice(0, 40)
    .map((d: any) => {
      const rev = d.revisions?.[0];
      return `<tr><td>${esc(d.drawingNumber)}</td><td>${esc(d.title)}</td><td>${esc(d.discipline)}</td><td>${esc(rev?.revisionNumber || d.currentRev)}</td><td>${d.isPublished ? "Published" : "Draft"}</td></tr>`;
    })
    .join("");
  const subRows = pack.submittals
    .map(
      (s) =>
        `<tr><td>${esc(s.number)}</td><td>${esc(s.title)}</td><td>${esc(s.submittalType)}</td><td>${esc(s.status)}</td><td>${esc(s.ballInCourt)}</td></tr>`
    )
    .join("");
  const safetyRows = pack.safety
    .map(
      (s) =>
        `<tr><td>${esc(s.recordType)}</td><td>${esc(s.title)}</td><td>${esc(s.status)}</td><td>${fmtDate(s.occurredAt)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>WPR — ${esc(p.code)}</title>
<style>
  body{font-family:"IBM Plex Sans",Segoe UI,Helvetica,Arial,sans-serif;color:#16181C;margin:0;background:#F0F1F2}
  .sheet{width:100%;max-width:1140px;margin:16px auto;background:#fff;border:1px solid #D8DCE3;box-shadow:0 8px 24px rgba(20,30,50,.08)}
  .bar{background:#3D4450;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .bar h1{margin:0;font-size:clamp(16px,2.5vw,20px)}.bar .sub{opacity:.75;font-size:12px;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:14px 20px;border-bottom:1px solid #e6e9ef;font-size:13px}
  .meta b{color:#64748b;font-weight:600;display:inline-block;min-width:110px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;padding:14px 20px;background:#fafbfc;border-bottom:1px solid #e6e9ef}
  .kpi{border:1px solid #e6e9ef;border-radius:6px;padding:10px;background:#fff}
  .kpi .n{font-size:20px;font-weight:700;color:#C45C26}.kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
  section{padding:16px 20px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#3D4450;border-bottom:2px solid #C45C26;padding-bottom:6px;margin:0 0 10px}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;border-collapse:collapse;font-size:12px;min-width:520px} th,td{border:1px solid #e6e9ef;padding:8px;text-align:left} th{background:#f0f2f5;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
  .foot{padding:12px 20px;font-size:11px;color:#64748b;border-top:1px solid #e6e9ef;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  @media (max-width:640px){.meta{grid-template-columns:1fr}.sheet{margin:0;border:none;box-shadow:none}}
  @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;border:none;max-width:none}}
</style></head><body>
<div class="sheet">
  <div class="bar"><div><div class="sub">शरणम् · Sharnam PMC</div><h1>Weekly Progress Report (WPR)</h1></div>
  <div style="text-align:right"><div class="sub">Week ending</div><div style="font-size:16px;font-weight:600">${fmtDate(pack.end)}</div></div></div>
  <div class="meta">
    <div><b>Project</b> ${esc(p.name)}</div><div><b>Code</b> ${esc(p.code)}</div>
    <div><b>Client</b> ${esc(p.clientName)}</div><div><b>Location</b> ${esc(p.location)}</div>
    <div><b>Design consultant</b> ${esc(p.designConsultant)}</div><div><b>Contractor</b> ${esc(p.contractorName)}</div>
    <div><b>PMC</b> ${esc(p.pmc)}</div><div><b>Period</b> ${fmtDate(pack.start)} → ${fmtDate(pack.end)}</div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="n">${pack.kpis.diaryDays}</div><div class="l">Diary days</div></div>
    <div class="kpi"><div class="n">${pack.kpis.manpowerWeek}</div><div class="l">Manpower</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openRfis}</div><div class="l">Open RFIs</div></div>
    <div class="kpi"><div class="n">${pack.kpis.publishedDrawings}</div><div class="l">Published dwgs</div></div>
    <div class="kpi"><div class="n">${pack.kpis.drawingChecks}</div><div class="l">Drawing checks</div></div>
    <div class="kpi"><div class="n">${pack.kpis.qualityChecks}</div><div class="l">QI fills</div></div>
    <div class="kpi"><div class="n">${pack.kpis.safetyChecks}</div><div class="l">Safety fills</div></div>
    <div class="kpi"><div class="n">${pack.kpis.siteChecks}</div><div class="l">Site checks</div></div>
    <div class="kpi"><div class="n">${Math.round(pack.kpis.budgeted / 100000) / 10}</div><div class="l">Budget ₹L</div></div>
    <div class="kpi"><div class="n">${Math.round(pack.kpis.certified / 100000) / 10}</div><div class="l">Certified ₹L</div></div>
    <div class="kpi"><div class="n">${Math.round(pack.kpis.mbQty)}</div><div class="l">MB qty</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openHindrances}</div><div class="l">Open hindrance</div></div>
  </div>
  <section><h2>Cost flow (cashflow)</h2><div class="table-wrap"><table><thead><tr><th>Period</th><th>Package</th><th>Planned</th><th>Actual</th></tr></thead><tbody>
  ${
    pack.cashflow
      .map(
        (c) =>
          `<tr><td>${esc(c.periodLabel)}</td><td>${esc(c.packageName)}</td><td>${Math.round(c.plannedAmount).toLocaleString("en-IN")}</td><td>${Math.round(c.actualAmount).toLocaleString("en-IN")}</td></tr>`
      )
      .join("") || "<tr><td colspan=4>No cashflow rows</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>Budget WBS (top)</h2><div class="table-wrap"><table><thead><tr><th>Sr</th><th>Description</th><th>Stakeholder</th><th>Budgeted</th><th>Certified</th></tr></thead><tbody>
  ${
    (pack.budget || [])
      .slice(0, 12)
      .map(
        (b) =>
          `<tr><td>${esc(b.srNo)}</td><td>${esc(b.description)}</td><td>${esc(b.stakeholder)}</td><td>${Math.round(b.budgetedAmount).toLocaleString("en-IN")}</td><td>${Math.round(b.certifiedAmount).toLocaleString("en-IN")}</td></tr>`
      )
      .join("") || "<tr><td colspan=5>No budget</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>Drawing checklist fills (DrawingCheck)</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.DrawingCheck)}</tbody></table></div></section>
  <section><h2>Quality checklist fills (QualityInspection)</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.QualityInspection)}</tbody></table></div></section>
  <section><h2>Quality NCR / CAR</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Description</th><th>Status</th></tr></thead><tbody>
  ${
    (pack.qualityNcrs || [])
      .slice(0, 15)
      .map(
        (n) =>
          `<tr><td>${esc(n.number)}</td><td>${esc(n.ncrType)}</td><td>${esc(n.description).slice(0, 120)}</td><td>${esc(n.status)}</td></tr>`
      )
      .join("") || "<tr><td colspan=4>None</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>Cube register (sample)</h2><div class="table-wrap"><table><thead><tr><th>Sr</th><th>Description</th><th>Grade</th><th>Strength</th><th>Result</th></tr></thead><tbody>
  ${
    (pack.cubes || [])
      .slice(0, 12)
      .map(
        (c) =>
          `<tr><td>${esc(c.srNo)}</td><td>${esc(c.description)}</td><td>${esc(c.grade)}</td><td>${c.strength ?? "—"}</td><td>${esc(c.result)}</td></tr>`
      )
      .join("") || "<tr><td colspan=5>None</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>GFC / drawings</h2><div class="table-wrap"><table><thead><tr><th>No</th><th>Title</th><th>Discipline</th><th>Rev</th><th>Status</th></tr></thead><tbody>${drawingRows || "<tr><td colspan=5>None</td></tr>"}</tbody></table></div></section>
  <section><h2>Milestones</h2><div class="table-wrap"><table><thead><tr><th>Code</th><th>Activity</th><th>Plan/Act days</th><th>Status</th></tr></thead><tbody>
  ${
    pack.milestones
      .slice(0, 15)
      .map(
        (m) =>
          `<tr><td>${esc(m.code)}</td><td>${esc(m.activity)}</td><td>${m.plannedDays}/${m.actualDays}</td><td>${esc(m.status)}</td></tr>`
      )
      .join("") || "<tr><td colspan=4>None</td></tr>"
  }
  </tbody></table></div></section>
  <section><h2>Submittals</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Status</th><th>Ball</th></tr></thead><tbody>${subRows || "<tr><td colspan=5>None</td></tr>"}</tbody></table></div></section>
  <section><h2>Safety checklist fills</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>${checklistRowsHtml(pack.submissionsByType.Safety)}</tbody></table></div></section>
  <section><h2>Safety records</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Date</th></tr></thead><tbody>${safetyRows || "<tr><td colspan=4>None</td></tr>"}</tbody></table></div></section>
  <div class="foot"><span>Generated ${fmtDate(pack.generatedAt)} · Sharnam Portal</span><span>Confidential — client weekly pack</span></div>
</div></body></html>`;
}
/** Role may respond/close RFIs if on communication matrix (or Sharnam office). */
export async function roleOnRfiMatrix(projectId: string, role: string) {
  if (role === "admin" || role === "office") return true;
  const rows = await prisma.communicationMatrix.findMany({
    where: { projectId, isActive: true },
  });
  if (!rows.length) return role === "admin" || role === "office";
  const rfiRows = rows.filter(
    (m) => /rfi/i.test(m.communicationType) || /rfi/i.test(m.channel) || /concern/i.test(m.communicationType)
  );
  const pool = rfiRows.length ? rfiRows : rows;
  return pool.some((m) => m.fromRole === role || m.toRole === role);
}

/**
 * Who may fill a checklist assignment:
 * - admin / office always
 * - open DrawingChecklist / QualityInspection RFI linked to this assignment/template:
 *   matrix parties, assigned user, or vendor on that RFI
 * - otherwise site / employee / vendor (assigned checklists stay fillable)
 */
export async function canFillChecklistAssignment(opts: {
  projectId: string;
  assignmentId: string;
  templateId: string;
  user: { id: string; role: string; email?: string | null };
}) {
  const { projectId, assignmentId, templateId, user } = opts;
  if (user.role === "admin" || user.role === "office") return { ok: true as const, via: "office" };

  const openRfis = await prisma.rfi.findMany({
    where: {
      projectId,
      status: { in: ["Open", "Answered"] },
      rfiKind: { in: ["DrawingChecklist", "QualityInspection", "SafetyChecklist"] },
      OR: [{ linkedAssignmentId: assignmentId }, { linkedChecklistItemId: templateId }],
    },
    include: { vendor: { select: { id: true, email: true } } },
  });

  if (openRfis.length) {
    if (openRfis.some((r) => r.assignedToId === user.id)) return { ok: true as const, via: "assignee" };
    const onMatrix = await roleOnRfiMatrix(projectId, user.role);
    if (onMatrix) return { ok: true as const, via: "matrix" };
    if (user.role === "vendor") {
      const email = (user.email || "").toLowerCase();
      const vendorHit = openRfis.some(
        (r) =>
          r.responsibleVendorId &&
          (r.vendor?.email || "").toLowerCase() === email
      );
      if (vendorHit || openRfis.some((r) => r.responsibleVendorId)) {
        // Vendor role on portal with a responsible vendor set on the RFI
        if (openRfis.some((r) => r.responsibleVendorId)) return { ok: true as const, via: "vendor" };
      }
    }
    return {
      ok: false as const,
      reason: "Only Communication Matrix parties, the RFI assignee, or the responsible vendor can fill this checklist.",
    };
  }

  if (["site_employee", "employee", "vendor"].includes(user.role)) {
    return { ok: true as const, via: "role" };
  }
  return { ok: false as const, reason: "You cannot fill this checklist." };
}


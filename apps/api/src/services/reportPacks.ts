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

export async function buildDprPack(projectId: string, dateInput?: string) {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const [diary, submissions, rfis, safety, photos, drawings] = await Promise.all([
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
  ]);

  const manpowerTotal = diary?.manpower.reduce((s, m) => s + m.workerCount, 0) || 0;
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
      openRfis: rfis.filter((r) => r.status === "Open").length,
      safetyEvents: safety.length,
      photosToday: photos.length,
      diaryStatus: diary?.status || "Missing",
      weather: diary?.weatherCondition || "—",
    },
    diary,
    submissions,
    rfis,
    safety,
    photos,
    drawings,
    hindranceNotes: (diary?.notes || []).map((n) => n.noteText),
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
  const [diaries, submissions, meetings, drawings, rfis, safety, submittals, cashflow, ncrLike] = await Promise.all([
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
    prisma.qualityInspection.findMany({
      where: { projectId, status: { in: ["Open", "Failed", "Rework"] } },
      take: 30,
    }),
  ]);

  const manpowerWeek = diaries.reduce(
    (s, d) => s + d.manpower.reduce((a, m) => a + m.workerCount, 0),
    0
  );

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
      checklistsApproved: submissions.filter((s) => s.status === "Approved").length,
      meetings: meetings.length,
      openMeetingItems: meetings.flatMap((m) => m.items).filter((i) => i.resolutionStatus === "Open").length,
      openRfis: rfis.filter((r) => r.status === "Open").length,
      drawings: drawings.length,
      publishedDrawings: drawings.filter((d) => d.isPublished).length,
      safetyEvents: safety.length,
      openSubmittals: submittals.filter((s) => !["Approved", "Rejected"].includes(s.status)).length,
      openQi: ncrLike.length,
    },
    diaries,
    submissions,
    meetings,
    drawings,
    rfis,
    safety,
    submittals,
    cashflow,
    qualityActions: ncrLike,
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
  const notes = pack.hindranceNotes.map((n) => `<li>${esc(n)}</li>`).join("") || "<li>None recorded</li>";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>DPR — ${esc(p.code)}</title>
<style>
  body{font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1f2c;margin:0;background:#f4f5f7}
  .sheet{max-width:960px;margin:24px auto;background:#fff;border:1px solid #d8dce3;box-shadow:0 8px 24px rgba(20,30,50,.08)}
  .bar{background:#1C2B3A;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:flex-end}
  .bar h1{margin:0;font-size:20px;letter-spacing:.02em}.bar .sub{opacity:.75;font-size:12px;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;padding:16px 24px;border-bottom:1px solid #e6e9ef;font-size:13px}
  .meta b{color:#5a6577;font-weight:600;display:inline-block;min-width:120px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 24px;background:#fafbfc;border-bottom:1px solid #e6e9ef}
  .kpi{border:1px solid #e6e9ef;border-radius:6px;padding:12px;background:#fff}
  .kpi .n{font-size:22px;font-weight:700;color:#E4632A}.kpi .l{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5a6577}
  section{padding:18px 24px} h2{font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:#1C2B3A;border-bottom:2px solid #E4632A;padding-bottom:6px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e6e9ef;padding:8px;text-align:left} th{background:#f0f2f5;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  .foot{padding:12px 24px;font-size:11px;color:#5a6577;border-top:1px solid #e6e9ef;display:flex;justify-content:space-between}
  @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;border:none}}
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
    <div class="kpi"><div class="n">${pack.kpis.checklistsToday}</div><div class="l">Checklists</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openRfis}</div><div class="l">Open RFIs</div></div>
  </div>
  <section><h2>Manpower</h2><table><thead><tr><th>Company</th><th>Workers</th><th>Hours</th><th>Comments</th></tr></thead><tbody>${rowsMan}</tbody></table></section>
  <section><h2>Equipment</h2><table><thead><tr><th>Company</th><th>Type</th><th>Hours</th><th>Comments</th></tr></thead><tbody>${rowsEq}</tbody></table></section>
  <section><h2>Hindrance / site notes</h2><ul>${notes}</ul></section>
  <section><h2>Open / today's RFIs (concern register)</h2><table><thead><tr><th>#</th><th>Subject</th><th>Status</th><th>Due</th></tr></thead><tbody>${rowsRfi || "<tr><td colspan=4>None</td></tr>"}</tbody></table></section>
  <section><h2>Checklist activity</h2><table><thead><tr><th>Template</th><th>By</th><th>Status</th></tr></thead><tbody>
  ${
    pack.submissions
      .map(
        (s) =>
          `<tr><td>${esc(s.assignment.template.name)}</td><td>${esc(s.submittedBy.fullName)}</td><td>${esc(s.status)}</td></tr>`
      )
      .join("") || "<tr><td colspan=3>None today</td></tr>"
  }
  </tbody></table></section>
  <div class="foot"><span>Generated ${fmtDate(pack.generatedAt)} · Sharnam Portal</span><span>Confidential — client pack</span></div>
</div></body></html>`;
}

export function renderWprHtml(pack: Awaited<ReturnType<typeof buildWprPack>>) {
  const p = pack.project;
  const drawingRows = pack.drawings
    .slice(0, 40)
    .map((d) => {
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>WPR — ${esc(p.code)}</title>
<style>
  body{font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1f2c;margin:0;background:#f4f5f7}
  .sheet{max-width:1100px;margin:24px auto;background:#fff;border:1px solid #d8dce3;box-shadow:0 8px 24px rgba(20,30,50,.08)}
  .bar{background:#1C2B3A;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:flex-end}
  .bar h1{margin:0;font-size:20px}.bar .sub{opacity:.75;font-size:12px;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;padding:16px 24px;border-bottom:1px solid #e6e9ef;font-size:13px}
  .meta b{color:#5a6577;font-weight:600;display:inline-block;min-width:130px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 24px;background:#fafbfc;border-bottom:1px solid #e6e9ef}
  .kpi{border:1px solid #e6e9ef;border-radius:6px;padding:10px;background:#fff}
  .kpi .n{font-size:20px;font-weight:700;color:#0B6A78}.kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5a6577}
  section{padding:16px 24px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#1C2B3A;border-bottom:2px solid #0B6A78;padding-bottom:6px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #e6e9ef;padding:7px;text-align:left} th{background:#f0f2f5;font-size:10px;text-transform:uppercase}
  .foot{padding:12px 24px;font-size:11px;color:#5a6577;border-top:1px solid #e6e9ef;display:flex;justify-content:space-between}
  @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;border:none}}
</style></head><body>
<div class="sheet">
  <div class="bar"><div><div class="sub">शरणम् · Sharnam PMC · Weekly pack</div><h1>Weekly Progress Report (WPR)</h1></div>
  <div style="text-align:right"><div class="sub">Period</div><div style="font-size:15px;font-weight:600">${fmtDate(pack.start)} – ${fmtDate(pack.end)}</div></div></div>
  <div class="meta">
    <div><b>Project</b> ${esc(p.name)}</div><div><b>Code</b> ${esc(p.code)}</div>
    <div><b>Client</b> ${esc(p.clientName)}</div><div><b>PMC</b> ${esc(p.pmc)}</div>
    <div><b>Design consultant</b> ${esc(p.designConsultant)}</div><div><b>Contractor</b> ${esc(p.contractorName)}</div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="n">${pack.kpis.diaryDays}</div><div class="l">Diary days</div></div>
    <div class="kpi"><div class="n">${pack.kpis.manpowerWeek}</div><div class="l">Manpower (week)</div></div>
    <div class="kpi"><div class="n">${pack.kpis.checklistsSubmitted}</div><div class="l">Checklists</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openRfis}</div><div class="l">Open RFIs</div></div>
    <div class="kpi"><div class="n">${pack.kpis.publishedDrawings}/${pack.kpis.drawings}</div><div class="l">Drawings pub.</div></div>
    <div class="kpi"><div class="n">${pack.kpis.meetings}</div><div class="l">Meetings</div></div>
    <div class="kpi"><div class="n">${pack.kpis.openSubmittals}</div><div class="l">Open submittals</div></div>
    <div class="kpi"><div class="n">${pack.kpis.safetyEvents}</div><div class="l">Safety</div></div>
  </div>
  <section><h2>Master / site drawing register (snapshot)</h2><table><thead><tr><th>No.</th><th>Title</th><th>Discipline</th><th>Rev</th><th>Status</th></tr></thead><tbody>${drawingRows || "<tr><td colspan=5>None</td></tr>"}</tbody></table></section>
  <section><h2>Submittals register</h2><table><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Status</th><th>BIC</th></tr></thead><tbody>${subRows || "<tr><td colspan=5>None</td></tr>"}</tbody></table></section>
  <section><h2>Safety / observations</h2><table><thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Date</th></tr></thead><tbody>${safetyRows || "<tr><td colspan=4>None this week</td></tr>"}</tbody></table></section>
  <section><h2>Meetings & open actions</h2><p style="font-size:12px">Meetings: <b>${pack.kpis.meetings}</b> · Open MoM items: <b>${pack.kpis.openMeetingItems}</b> · QI / NCR-like open: <b>${pack.kpis.openQi}</b></p></section>
  <div class="foot"><span>Generated ${fmtDate(pack.generatedAt)} · Sharnam Portal</span><span>Aligned to WPR pack structure · Confidential</span></div>
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

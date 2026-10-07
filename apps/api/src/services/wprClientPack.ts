/**
 * Client WPR workbook — fills `WPR File.xlsx` / `WPR-File.xlsx` template tabs
 * from live portal data (separate from the 26-section WPR Maker pack in wprXlsx.ts).
 */
import fs from "fs";
import { findWorkbook } from "../lib/excelRoot.js";
import path from "path";
import XLSX from "../lib/xlsx.js";
import type { WorkBook, WorkSheet } from "xlsx";
import type { PrismaClient } from "@prisma/client";
import type { WprSections } from "./wprXlsx.js";
import { activityWeekRollup, qualityWeekStats, rollupFor } from "./wprWeekRollup.js";

function isoDate(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function ddmmyyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function excelSerial(d: Date | null | undefined): number | "" {
  if (!d || Number.isNaN(d.getTime())) return "";
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return Math.floor((d.getTime() - epoch.getTime()) / 86400000);
}

/**
 * The client's week workbook ("WPR 23 July to 29 July" = WPR-Client-Week-Template.xlsx) first, then the older
 * combined WPR File — searched across every known folder, so the choice does not depend on the working directory.
 */
function resolveWprClientTemplate(): string | null {
  if (process.env.SHARNAM_EXCEL_ROOT) {
    const own = path.join(process.env.SHARNAM_EXCEL_ROOT, "WPR File.xlsx");
    if (fs.existsSync(own)) return own;
  }
  return (
    findWorkbook(["WPR-Client-Week-Template.xlsx", "WPR  23 July to 29 July.xlsx"]) ||
    findWorkbook(["WPR-File.xlsx", "WPR File.xlsx"])
  );
}

function findSheet(wb: WorkBook, pattern: RegExp) {
  return wb.SheetNames.find((n: string) => pattern.test(n)) || "";
}

/** Every value written per sheet, replayed onto the styled template at the end (SheetJS drops cell styles). */
const writesBySheet = new WeakMap<WorkSheet, { r: number; c: number; v: string | number }[]>();
type Block = { start: number; end: number; minCol: number; maxCol: number; clearTo?: number; overrideFormulas?: boolean };
/** Data blocks written per sheet — stale template rows directly below each block are cleared on replay. */
const blocksBySheet = new WeakMap<WorkSheet, Block[]>();

/**
 * Write rows at 0-based sheet coordinates (row startRow, column 0 = A).
 * opts.clearTo: clear the block columns down to this row (exclusive) instead of "until the first blank row".
 * opts.overrideFormulas: write over template formulas in this block (default keeps them).
 */
function writeRows(ws: WorkSheet, startRow: number, rows: unknown[][], opts?: { clearTo?: number; overrideFormulas?: boolean }) {
  const log = writesBySheet.get(ws) || [];
  writesBySheet.set(ws, log);
  const blocks = blocksBySheet.get(ws) || [];
  blocksBySheet.set(ws, blocks);
  const cols = rows.flatMap((r) => (r || []).map((v, c) => (v === "" || v == null ? -1 : c))).filter((c) => c >= 0);
  blocks.push({
    start: startRow,
    end: startRow + rows.length,
    minCol: cols.length ? Math.min(...cols) : 0,
    maxCol: cols.length ? Math.max(...cols) : 0,
    ...opts,
  });
  let maxR = startRow;
  let maxC = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length; c++) {
      const v = r[c];
      if (v === "" || v == null) continue;
      const addr = XLSX.utils.encode_cell({ r: startRow + i, c });
      ws[addr] = typeof v === "number" ? { t: "n", v } : { t: "s", v: String(v) };
      log.push({ r: startRow + i, c, v: typeof v === "number" ? v : String(v) });
      maxR = Math.max(maxR, startRow + i);
      maxC = Math.max(maxC, c);
    }
  }
  const cur = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  ws["!ref"] = XLSX.utils.encode_range({
    s: cur.s,
    e: { r: Math.max(cur.e.r, maxR), c: Math.max(cur.e.c, maxC) },
  });
}

export async function buildWprClientWorkbook(
  prisma: PrismaClient,
  projectId: string,
  weekStart: Date,
  weekEnd: Date,
  sections?: WprSections
): Promise<Buffer> {
  const template = resolveWprClientTemplate();
  if (!template) throw new Error("WPR File.xlsx template not found — sync reference sheets.");

  const wb = XLSX.readFile(template);

  const [
    registerLines,
    hindrances,
    legal,
    milestones,
    cubes,
    ncrs,
    manpower,
    cashflow,
    plannedActual,
    risks,
    safetyWeek,
    safetyAll,
    dprSnaps,
    activityLines,
    sorStats,
    valueAdditions,
    procurementLines,
  ] = await Promise.all([
    prisma.drawingRegisterLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 80 }),
    prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" }, take: 50 }),
    prisma.progressLegalApproval.findMany({ where: { projectId }, take: 40 }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 60 }),
    // Cube Test sheet shows 7-day results: specimens tested this week (cast ~7 days earlier).
    prisma.cubeTest.findMany({
      where: {
        projectId,
        strength7: { not: null },
        OR: [
          { testDate7: { gte: weekStart, lte: weekEnd } },
          { testDate7: null, castDate: { gte: new Date(weekStart.getTime() - 7 * 86400000), lte: new Date(weekEnd.getTime() - 7 * 86400000) } },
        ],
      },
      orderBy: [{ testDate7: "asc" }, { srNo: "asc" }],
      take: 30,
    }),
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { issueDate: "desc" }, take: 40 }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 20 }),
    prisma.costCashflowPeriod.findMany({
      where: { projectId, NOT: { packageName: "COP-day" } },
      orderBy: { periodDate: "asc" },
      take: 60,
    }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, take: 40 }),
    prisma.progressRisk.findMany({ where: { projectId }, take: 40 }),
    prisma.safetyRecord.findMany({
      where: { projectId, occurredAt: { gte: weekStart, lte: weekEnd } },
      orderBy: { occurredAt: "desc" },
      take: 80,
    }),
    prisma.safetyRecord.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" }, take: 200 }),
    prisma.dprSnapshot.findMany({
      where: { projectId, logDate: { gte: weekStart, lte: weekEnd } },
      orderBy: { logDate: "asc" },
    }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 250 }),
    prisma.progressSorStat.findMany({ where: { projectId }, take: 20 }),
    prisma.progressValueAddition.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 30 }),
    prisma.progressProcurementLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 30 }),
  ]);

  const masterKey = findSheet(wb, /Master Drawing Register/i);
  if (masterKey && registerLines.length) {
    writeRows(
      wb.Sheets[masterKey],
      6,
      registerLines.map((l) => [
        l.srNo ?? "",
        l.projectPackage ?? "",
        l.building ?? "",
        l.discipline ?? "",
        l.drawingNumber.replace(/\s·\s*\d+$/, ""),
        l.drawingTitle,
        l.drawingType ?? "",
        l.consultantName ?? "",
        l.revisionNumber ?? "",
        l.revisionDate ? isoDate(l.revisionDate) : "",
        l.revisionDescription ?? "",
        l.latestRevision ?? "",
        l.plannedSubmissionDate ? isoDate(l.plannedSubmissionDate) : "",
        l.actualSubmissionDate ? isoDate(l.actualSubmissionDate) : "",
        l.submissionDelayDays ?? "",
        l.delayResponsibility ?? "",
        l.issuedTo ?? "",
        l.issueDate ? isoDate(l.issueDate) : "",
        l.copiesCount ?? "",
        l.criticalDrawing ?? "",
        l.remarks ?? "",
      ])
    );
  }

  const hindKey = findSheet(wb, /Hinderance Register/i);
  if (hindKey && hindrances.length) {
    writeRows(
      wb.Sheets[hindKey],
      2,
      hindrances.map((h, i) => [
        i + 1,
        h.description ?? "",
        h.location ?? "",
        h.activity ?? "",
        h.correspondence ?? "",
        h.category ?? "",
        h.type ?? "",
        h.occurredAt ? excelSerial(h.occurredAt) : "",
      ])
    );
  }

  const legalKey = findSheet(wb, /Legal Approval/i);
  if (legalKey && legal.length) {
    writeRows(
      wb.Sheets[legalKey],
      1,
      // Client columns: Sr · Approvals · Authority · Action Taken · Action Required · Due date · Approval Date · Risk · Status
      legal.map((r, i) => [
        i + 1,
        r.description ?? "",
        r.authority ?? "",
        r.remarks ?? "",
        "",
        r.requiredBy ? excelSerial(r.requiredBy) : "",
        r.receivedDate ? excelSerial(r.receivedDate) : "",
        "",
        /approved|done|received/i.test(r.status || "") ? "Done" : "Not done",
      ])
    );
  }

  const mileKey = findSheet(wb, /Milestone Dashboard/i);
  if (mileKey && milestones.length) {
    writeRows(
      wb.Sheets[mileKey],
      2,
      milestones.map((m) => [m.code ?? "", m.activity ?? "", m.plannedDays ?? 0, m.actualDays ?? 0, m.varianceDays ?? 0, m.status ?? ""])
    );
  }

  // Cube Test: header C2, data from C3 — sample no., 7-day strength, IS lower limit.
  const cubeKey = findSheet(wb, /^Cube Test$/i);
  if (cubeKey && cubes.length) {
    writeRows(
      wb.Sheets[cubeKey],
      2,
      cubes.slice(0, 20).map((c, i) => ["", "", i + 1, c.strength7 ?? 0, 17])
    );
  }

  const carKey = findSheet(wb, /CAR register/i);
  if (carKey && ncrs.length) {
    writeRows(
      wb.Sheets[carKey],
      2,
      ncrs.slice(0, 25).map((n) => [
        (n.number ?? "").replace(/^(NCR|CAR)-?/i, "") || n.number || "",
        n.issueDate ? excelSerial(n.issueDate) : "",
        n.ncrType ?? "",
        n.contractor ?? "",
        (n.description ?? "").slice(0, 500),
        n.location ?? "",
        n.plannedClosure ? excelSerial(n.plannedClosure) : "",
        n.actualClosure ? excelSerial(n.actualClosure) : "",
        n.status ?? "",
      ])
    );
  }

  // Weekly Manpower: fixed 20-row trade table B4:E23 (Total row 24 sums it). The template derives C/D from its
  // daily tables, so this block writes the register values over those formulas.
  const mpKey = findSheet(wb, /Weekly Manpower/i);
  if (mpKey && manpower.length) {
    writeRows(
      wb.Sheets[mpKey],
      3,
      manpower.slice(0, 20).map((m) => ["", m.trade ?? "", m.required ?? 0, m.available ?? 0, m.shortage ?? 0]),
      { clearTo: 23, overrideFormulas: true }
    );
  }

  // Project Cashflow: header B3 (Month · RA · Budgeted · Planned · Actual), data from B4.
  const cfKey = findSheet(wb, /Project Cashflow/i);
  if (cfKey && cashflow.length) {
    writeRows(
      wb.Sheets[cfKey],
      3,
      cashflow.map((c) => ["", c.periodLabel ?? "", c.packageName ?? "", "", Math.round(c.plannedAmount ?? 0), Math.round(c.actualAmount ?? 0)])
    );
  }

  // Client "Planned Vs Actual" sheet: activity quantities (header row 6, data from row 7). Inputs only —
  // the template's own formulas (balance, cumulative, %) stay in place on replay.
  const pvaKey = findSheet(wb, /Planned Vs Actual/i);
  if (pvaKey && activityLines.length) {
    const ws = wb.Sheets[pvaKey];
    const rollup = await activityWeekRollup(prisma, projectId, weekStart, weekEnd);
    const prevDay = new Date(weekStart.getTime() - 86400000);
    writeRows(ws, 2, [[`Planned Vs Actual Previous Week to Current Week\n(Date: ${ddmmyyyy(weekStart)} to ${ddmmyyyy(weekEnd)})`]]);
    writeRows(ws, 5, [["", "", "", "", "", "", "", "", `Executed qty till ${ddmmyyyy(prevDay)}`]]);
    writeRows(
      ws,
      6,
      activityLines.map((a, i) => {
        const dpr = rollupFor(rollup, a.activity, a.unit);
        const wkAct = rollup ? dpr?.weekQty ?? 0 : Number(a.weeklyActual || 0);
        const tillDate = dpr ? dpr.tillDate : Number(a.executedQty || 0);
        const tillPrev = Math.round((tillDate - wkAct) * 1000) / 1000;
        const gfc = Number(a.gfcQty || 0);
        return [
          i + 1,
          a.tower ?? "",
          a.activity,
          excelSerial(a.plannedStart),
          excelSerial(a.plannedEnd),
          a.unit ?? "",
          a.boqQty ?? 0,
          gfc,
          tillPrev,
          gfc ? Math.round((gfc - tillPrev) * 1000) / 1000 : "",
          a.weeklyPlanned ?? 0,
          wkAct,
          tillDate,
        ];
      })
    );
  }

  const riskKey = findSheet(wb, /Risk Register/i);
  if (riskKey && risks.length) {
    writeRows(
      wb.Sheets[riskKey],
      2,
      risks.map((r) => [r.code ?? "", r.category ?? "", r.name ?? "", r.probability ?? 0, r.consequence ?? 0, r.severity ?? 0, r.status ?? ""])
    );
  }

  const siteInst = safetyAll.filter((r) => r.recordType === "Site Instruction");
  const unsafeActs = safetyAll.filter((r) => r.recordType === "Observation");
  const ncrsSafety = safetyAll.filter((r) => /ncr/i.test(r.recordType) || /ncr/i.test(r.title || ""));

  const writeSafetyRegister = (pattern: RegExp, rows: typeof safetyAll, start: number) => {
    const key = findSheet(wb, pattern);
    if (!key || !rows.length) return;
    writeRows(
      wb.Sheets[key],
      start,
      rows.slice(0, 30).map((r, i) => [
        i + 1,
        r.location ?? "",
        r.responsibleParty ?? "Sharnam PMC",
        r.issuedTo ?? "",
        r.occurredAt ? excelSerial(r.occurredAt) : "",
        (r.description ?? r.title ?? "").slice(0, 200),
        r.category ?? "",
        r.correctiveAction ?? r.actionTaken ?? "",
      ])
    );
  };

  writeSafetyRegister(/Site Instruction/i, siteInst, 9);
  writeSafetyRegister(/Unsafe Act Summary/i, unsafeActs, 9);
  writeSafetyRegister(/NCR Summary/i, ncrsSafety, 9);

  const safetyHoursKey = findSheet(wb, /Safety Hours/i);
  if (safetyHoursKey) {
    const tbt = safetyWeek.filter((s) => /toolbox/i.test(s.recordType + s.title)).length;
    const incidents = safetyWeek.filter((s) => /incident|near miss/i.test(s.recordType)).length;
    const instructions = siteInst.length;
    writeRows(wb.Sheets[safetyHoursKey], 8, [
      [1, "Safe-manhours", 7670, 1350, 9020],
      [3, "Toolbox Talk", 32, tbt, 32 + tbt],
      [7, "Site safety Instructions", 91, instructions, 91 + instructions],
      [6, "Reported Incident/Accident", 1, incidents, 1 + incidents],
    ]);
  }

  if (dprSnaps.length) {
    const dprKey = findSheet(wb, /Quality SOR Log/i);
    if (dprKey) {
      const rows: unknown[][] = [];
      let sr = 1;
      for (const snap of dprSnaps) {
        const lines = JSON.parse(snap.linesJson || "[]") as { description?: string; qtyToday?: number; unit?: string }[];
        for (const ln of lines) {
          if (!Number(ln.qtyToday)) continue;
          rows.push([sr++, isoDate(snap.logDate), snap.discipline, ln.description ?? "", ln.qtyToday ?? 0, ln.unit ?? ""]);
        }
      }
      if (rows.length) writeRows(wb.Sheets[dprKey], 2, rows);
    }
    const sorKey = findSheet(wb, /^SOR Log$/i);
    if (sorKey && sorStats.length) {
      writeRows(
        wb.Sheets[sorKey],
        2,
        sorStats.map((s, i) => [
          i + 1,
          s.observation ?? "",
          s.total ?? 0,
          s.openCount ?? 0,
          s.closedCount ?? 0,
          s.closureRate ?? 0,
        ])
      );
    }
  }

  const siteKey = findSheet(wb, /Site Drawing Register/i);
  if (siteKey && registerLines.length) {
    const siteLines = registerLines.filter((l) => /site|issued|gfc/i.test(String(l.drawingType || l.remarks || "")));
    const rows = (siteLines.length ? siteLines : registerLines).slice(0, 40);
    writeRows(
      wb.Sheets[siteKey],
      3,
      rows.map((l, i) => [
        i + 1,
        l.drawingTitle ?? "",
        l.discipline ?? "",
        l.drawingNumber ?? "",
        l.revisionNumber ?? "",
        l.issueDate ? isoDate(l.issueDate) : "",
        l.issuedTo ?? "",
        l.remarks ?? "",
      ])
    );
  }

  // "As per drawing status" = Weekly Executed Plan: header A5, data from A6 — this week's qty from the DPRs.
  const drawStatusKey = findSheet(wb, /As per drawing status/i);
  if (drawStatusKey && activityLines.length) {
    const rollup = await activityWeekRollup(prisma, projectId, weekStart, weekEnd);
    writeRows(
      wb.Sheets[drawStatusKey],
      5,
      activityLines.map((a, i) => {
        const dpr = rollupFor(rollup, a.activity, a.unit);
        return [
          i + 1,
          a.tower ?? "",
          a.activity ?? "",
          a.unit ?? "",
          a.boqQty ?? 0,
          a.gfcQty ?? 0,
          a.weeklyPlanned ?? 0,
          rollup ? dpr?.weekQty ?? 0 : a.weeklyActual ?? 0,
          dpr ? dpr.tillDate : a.executedQty ?? 0,
        ];
      }),
      // The template links these cells to fixed rows of its own Planned Vs Actual sheet; write the values instead.
      { overrideFormulas: true }
    );
  }

  const vaKey = findSheet(wb, /Value Addition/i);
  if (vaKey && valueAdditions.length) {
    writeRows(
      wb.Sheets[vaKey],
      2,
      valueAdditions.map((v, i) => [
        i + 1,
        v.block ?? "",
        v.packageName ?? "",
        v.planning ?? "",
        v.suggestions ?? "",
        v.valueEngineeringPoints ?? "",
        v.cost ?? 0,
        v.timeImpact ?? "",
        v.qualityImpact ?? "",
        v.approvalAuthority ?? "",
        "",
        "",
        v.earlierQuoted ?? 0,
        v.finalPrice ?? 0,
        v.savings ?? 0,
      ])
    );
  }

  const procKey = findSheet(wb, /^Procurement tracker$/i);
  if (procKey && procurementLines.length) {
    writeRows(
      wb.Sheets[procKey],
      1,
      procurementLines.map((p, i) => [
        i + 1,
        p.workPackage ?? "",
        p.itemDescription ?? "",
        p.responsibleStakeholder ?? "",
        p.contractorName ?? "",
        p.targetInquiryDate ? excelSerial(p.targetInquiryDate) : "",
        p.vendorAppointmentDate ? excelSerial(p.vendorAppointmentDate) : "",
        p.leadTimeDays ?? "",
        p.priorityLevel ?? "",
        p.vendorAppointed ? "Yes" : "No",
      ])
    );
  }

  const qualStatKey = findSheet(wb, /Quality Statistic/i);
  const liveQuality = await qualityWeekStats(prisma, projectId, weekStart, weekEnd);
  if (qualStatKey && (liveQuality.length || sorStats.length)) {
    // Header B2, data from B3 (F = D - E is the template's formula).
    writeRows(
      wb.Sheets[qualStatKey],
      2,
      liveQuality.length
        ? liveQuality.map((q, i) => ["", i + 1, q.label, q.total, q.open, q.closed])
        : sorStats.map((s, i) => ["", i + 1, s.observation ?? "", s.total ?? 0, s.openCount ?? 0, s.closedCount ?? 0])
    );
  }

  // HSE Statistic: Up to previous week (PW) · Current week (CW) · Cumulative — daily safety log + safety records.
  const hseKey = findSheet(wb, /HSE Statistic/i);
  if (hseKey) {
    const { safetyDays, safetyCumulative } = await import("./safetyWeek.js");
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const prevKey = key(new Date(weekStart.getTime() - 86400000));
    const [cwDays, cumPrev, cumNow, records] = await Promise.all([
      safetyDays(projectId, key(weekStart), key(weekEnd)),
      safetyCumulative(projectId, prevKey),
      safetyCumulative(projectId, key(weekEnd)),
      prisma.safetyRecord.findMany({
        where: { projectId, occurredAt: { lte: weekEnd } },
        select: { recordType: true, status: true, occurredAt: true, closedAt: true },
      }),
    ]);
    const sum = (k: string) => cwDays.reduce((n, d) => n + (Number((d as Record<string, unknown>)[k]) || 0), 0);
    const rec = (re: RegExp) => {
      const all = records.filter((r) => re.test(r.recordType || ""));
      const prev = all.filter((r) => r.occurredAt < weekStart).length;
      return [prev, all.length - prev, all.length];
    };
    const tbt = rec(/tool/i);
    const ind = rec(/induct/i);
    const lines: [string, number[]][] = [
      ["Safe-manhours", [cumPrev.safeManHours, sum("safeManHours"), cumNow.safeManHours]],
      ["Safe-man-days", [cumPrev.safeManDays, cwDays.filter((d) => d.manpower > 0 || d.safeManHours > 0).length, cumNow.safeManDays]],
      ["Toolbox Talk", [cumPrev.toolboxTalks + tbt[0], sum("toolboxTalks") + tbt[1], cumNow.toolboxTalks + tbt[2]]],
      ["HSE induction", [cumPrev.inductions + ind[0], sum("inductions") + ind[1], cumNow.inductions + ind[2]]],
      ["HSE trainings", rec(/training/i)],
      ["Reported Incident/Accident", rec(/incident|accident|lti/i)],
      ["Site safety Instructions", rec(/instruction/i)],
      ["NCN Raised", rec(/ncn/i)],
      ["SOR Raised", rec(/\bsor\b/i)],
      ["FAC", rec(/\bfac\b|first aid/i)],
      ["Near Miss", rec(/near miss/i)],
    ];
    // Header B2, data B3:F13 (left) and I3:M5 (right); the app's figures replace the template's formulas.
    writeRows(wb.Sheets[hseKey], 2, lines.map(([label, v], i) => ["", i + 1, label, v[0], v[1], v[2]]), { overrideFormulas: true });
    const isClosed = (r: { status: string | null; closedAt: Date | null }) =>
      r.closedAt ? r.closedAt <= weekEnd : /clos|resolved|done/i.test(r.status || "");
    const obs = (["Unsafe act", "Unsafe condition", "NCR"] as const).map((label, i) => {
      const re = label === "NCR" ? /\bncr\b|\bncn\b|safety ncr/i : new RegExp(`^${label}`, "i");
      const all = records.filter((r) => re.test(r.recordType || ""));
      const closed = all.filter(isClosed).length;
      return ["", "", "", "", "", "", "", "", i + 1, label, all.length, all.length - closed, closed];
    });
    writeRows(wb.Sheets[hseKey], 2, obs, { overrideFormulas: true });
  }

  // Design status (client sheet: header row 7, data from row 8) — same discipline status as the WPR.
  const designKey = findSheet(wb, /^Design status$/i);
  const designRows = sections?.designStatus?.rows || [];
  if (designKey && designRows.length) {
    writeRows(
      wb.Sheets[designKey],
      7,
      designRows.map((r, i) => {
        const pct = Number(String(r[3] ?? "").replace("%", ""));
        return [i + 1, r[1] ?? "", Number.isFinite(pct) ? pct / 100 : "", "", r[4] ?? r[2] ?? ""];
      })
    );
  }

  // Project / Client / Consultants / PMC header lines on every sheet carry the template project — use this one.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, clientName: true, designConsultant: true },
  });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws["!ref"]) continue;
    const origin = XLSX.utils.decode_range(ws["!ref"]).s; // sheet_to_json rows start at the used range
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    grid.slice(0, 8).forEach((row, i) => {
      const r = origin.r + i;
      const pad = Array(origin.c).fill("");
      const label = String(row[0] ?? "").trim();
      if (/^project\s*:/i.test(label)) writeRows(ws, r, [[...pad, `Project: ${project?.name || ""}`]]);
      else if (/^client\s*:/i.test(label) && project?.clientName) writeRows(ws, r, [[...pad, "", project.clientName]]);
      else if (/^consultants?\s*:/i.test(label) && project?.designConsultant) writeRows(ws, r, [[...pad, "", project.designConsultant]]);
      else if (/^pmc\s*:/i.test(label)) writeRows(ws, r, [[...pad, "", "Sharnam Project Development Consultants & Co."]]);
    });
  }

  return replayOntoStyledTemplate(template, wb);
}

/**
 * ExcelJS cannot re-save a workbook whose shared formulas lose their master, so give every
 * shared-formula cell its own (translated) formula before writing.
 */
function unshareFormulas(wb: import("exceljs").Workbook) {
  wb.eachSheet((ws) => {
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        const v = cell.value as { sharedFormula?: string; shareType?: string; formula?: string; result?: unknown } | null;
        if (!v || typeof v !== "object" || (!v.sharedFormula && v.shareType !== "shared")) return;
        const formula = cell.formula;
        cell.value = (formula ? { formula, result: v.result } : (v.result ?? null)) as import("exceljs").CellValue;
      })
    );
  });
}

/**
 * Open the client template with ExcelJS (keeps fills, borders, fonts, widths, merges, logos)
 * and write the same values the SheetJS pass computed. Falls back to the SheetJS buffer if the
 * template cannot be opened.
 */
async function replayOntoStyledTemplate(template: string, wb: WorkBook): Promise<Buffer> {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const styled = new ExcelJS.Workbook();
    await styled.xlsx.readFile(template);
    unshareFormulas(styled);
    for (const name of wb.SheetNames) {
      const writes = writesBySheet.get(wb.Sheets[name]);
      const ws = styled.getWorksheet(name);
      if (!writes?.length || !ws) continue;
      // Clear the template's own rows below each data block (block columns only) so another week/project never
      // shows template figures: down to clearTo, else to the first blank or "Total" row. Formulas stay unless
      // the block overrides them; merged group cells inside the data area are unmerged first.
      const written = new Set(writes.map((w) => `${w.r}:${w.c}`));
      const blocks = blocksBySheet.get(wb.Sheets[name]) || [];
      const merges: string[] = [...(((ws as unknown as { model: { merges?: string[] } }).model.merges) || [])];
      for (const b of blocks) {
        if (b.clearTo == null && b.end - b.start < 2 && b.minCol === b.maxCol) continue; // single title / header cells
        const last = b.clearTo ?? b.end + 400;
        for (const m of merges) {
          const [tl, br] = m.split(":");
          const top = Number(ws.getCell(tl).row) - 1;
          const bottom = Number(ws.getCell(br || tl).row) - 1;
          const left = Number(ws.getCell(tl).col) - 1;
          const right = Number(ws.getCell(br || tl).col) - 1;
          if (top >= b.start && bottom < last && left >= b.minCol && right <= b.maxCol) {
            try { ws.unMergeCells(m); } catch { /* already split */ }
          }
        }
        for (let r = b.end; r < last; r++) {
          const row = ws.getRow(r + 1);
          let any = false;
          let total = false;
          for (let c = b.minCol; c <= b.maxCol; c++) {
            const v = row.getCell(c + 1).value;
            if (v != null && v !== "") any = true;
            if (typeof v === "string" && /^\s*total/i.test(v)) total = true;
          }
          if (b.clearTo == null && (!any || total)) break;
          for (let c = b.minCol; c <= b.maxCol; c++) {
            const cell = row.getCell(c + 1);
            if (written.has(`${r}:${c}`) || (cell.formula && !b.overrideFormulas)) continue;
            cell.value = null;
          }
        }
      }
      const overridden = (r: number, c: number) =>
        blocks.some((b) => b.overrideFormulas && r >= b.start && r < b.end && c >= b.minCol && c <= b.maxCol);
      for (const w of writes) {
        const cell = ws.getCell(w.r + 1, w.c + 1);
        if (cell.isMerged && cell.master !== cell) continue;
        if (cell.formula && !overridden(w.r, w.c)) continue; // the template computes this cell from our inputs
        cell.value = w.v;
      }
    }
    // The client's charts (ExcelJS drops them) go back on, reading the filled cells.
    const { restoreTemplateCharts } = await import("../lib/xlsxCharts.js");
    return restoreTemplateCharts(fs.readFileSync(template), Buffer.from(await styled.xlsx.writeBuffer()));
  } catch (err) {
    console.warn("[wpr-client] styled template write failed — plain workbook:", err instanceof Error ? err.message : err);
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}

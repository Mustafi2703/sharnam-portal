/**
 * Client WPR workbook — fills `WPR File.xlsx` / `WPR-File.xlsx` template tabs
 * from live portal data (separate from the 26-section WPR Maker pack in wprXlsx.ts).
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import type { WorkBook, WorkSheet } from "xlsx";
import type { PrismaClient } from "@prisma/client";

function isoDate(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function excelSerial(d: Date | null | undefined): number | "" {
  if (!d || Number.isNaN(d.getTime())) return "";
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return Math.floor((d.getTime() - epoch.getTime()) / 86400000);
}

function resolveWprClientTemplate(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT ? path.join(process.env.SHARNAM_EXCEL_ROOT, "WPR File.xlsx") : "",
    path.join(process.cwd(), "templates", "WPR-File.xlsx"),
    path.join(process.cwd(), "seed", "data", "WPR File.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findSheet(wb: WorkBook, pattern: RegExp) {
  return wb.SheetNames.find((n: string) => pattern.test(n)) || "";
}

function writeRows(ws: WorkSheet, startRow: number, rows: unknown[][]) {
  let maxR = startRow;
  let maxC = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length; c++) {
      const v = r[c];
      if (v === "" || v == null) continue;
      const addr = XLSX.utils.encode_cell({ r: startRow + i, c });
      ws[addr] = typeof v === "number" ? { t: "n", v } : { t: "s", v: String(v) };
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
  weekEnd: Date
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
  ] = await Promise.all([
    prisma.drawingRegisterLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 80 }),
    prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" }, take: 50 }),
    prisma.progressLegalApproval.findMany({ where: { projectId }, take: 40 }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 60 }),
    prisma.cubeTest.findMany({
      where: { projectId, OR: [{ castDate: { gte: weekStart, lte: weekEnd } }, { castDate: null }] },
      orderBy: { castDate: "desc" },
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
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 120 }),
    prisma.progressSorStat.findMany({ where: { projectId }, take: 40 }),
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
      2,
      legal.map((r) => [
        r.approvalId ?? "",
        r.category ?? "",
        r.authority ?? "",
        r.description ?? "",
        r.requiredBy ? excelSerial(r.requiredBy) : "",
        r.status ?? "",
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

  const cubeKey = findSheet(wb, /^Cube Test$/i);
  if (cubeKey && cubes.length) {
    writeRows(
      wb.Sheets[cubeKey],
      1,
      cubes.slice(0, 20).map((c, i) => [i + 1, c.strength ?? 0, 17])
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

  const mpKey = findSheet(wb, /Weekly Manpower/i);
  if (mpKey && manpower.length) {
    writeRows(
      wb.Sheets[mpKey],
      2,
      manpower.map((m) => [
        m.trade ?? "",
        m.required ?? 0,
        m.available ?? 0,
        m.shortage ?? 0,
        m.shortagePct ?? 0,
        m.rank ?? "",
      ])
    );
  }

  const cfKey = findSheet(wb, /Project Cashflow/i);
  if (cfKey && cashflow.length) {
    writeRows(
      wb.Sheets[cfKey],
      2,
      cashflow.map((c) => [c.periodLabel ?? "", c.packageName ?? "", c.plannedAmount ?? 0, c.actualAmount ?? 0, (c.actualAmount ?? 0) - (c.plannedAmount ?? 0)])
    );
  }

  const pvaKey = findSheet(wb, /Planned Vs Actual/i);
  if (pvaKey && plannedActual.length) {
    writeRows(
      wb.Sheets[pvaKey],
      2,
      plannedActual.map((r) => [r.periodLabel ?? "", r.packageName ?? "", r.plannedPct ?? 0, r.actualPct ?? 0, (r.actualPct ?? 0) - (r.plannedPct ?? 0)])
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

  const drawStatusKey = findSheet(wb, /As per drawing status/i);
  if (drawStatusKey && activityLines.length) {
    writeRows(
      wb.Sheets[drawStatusKey],
      3,
      activityLines.map((a) => [
        a.srNo ?? "",
        a.tower ?? "",
        a.activity ?? "",
        a.unit ?? "",
        a.boqQty ?? 0,
        a.gfcQty ?? 0,
        a.executedQty ?? 0,
        a.balanceQty ?? 0,
        a.weeklyPlanned ?? 0,
        a.weeklyActual ?? 0,
        a.cumulativeQty ?? a.executedQty ?? 0,
        a.pctComplete ?? 0,
      ])
    );
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

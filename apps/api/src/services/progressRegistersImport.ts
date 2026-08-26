/**
 * Import Progress Excel formats onto a project: milestones, hindrance, risk, legal.
 * Column layouts match client SPDC workbooks (Milestone tracking, Hindrance, Risk, Legal).
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { resolveExcelRoot } from "../lib/excelRoot.js";
import { MS_PROJECT_SOURCE } from "./msProjectSchedule.js";

function firstExisting(root: string, names: string[]) {
  for (const name of names) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const num = Number(v);
  if (!Number.isFinite(num) || num < 20000) return null;
  const ms = (num - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sheetRows(file: string, picker: (names: string[]) => string | undefined) {
  const wb = XLSX.readFile(file);
  const key = picker(wb.SheetNames);
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown[][];
}

export function resolveMilestonePath() {
  return firstExisting(resolveExcelRoot(), ["Milestone tracking.xlsx", "Progress Overview.xlsx"]);
}

export function resolveHindrancePath() {
  return firstExisting(resolveExcelRoot(), [
    "HInderance Register Dashboard (1).xlsx",
    "HInderance Register Dashboard.xlsx",
    "Progress Overview.xlsx",
  ]);
}

export function resolveRiskPath() {
  return firstExisting(resolveExcelRoot(), [
    "Risk Register - Dashboard 1.xlsx",
    "Risk Register - Dashboard.xlsx",
    "Progress Overview.xlsx",
  ]);
}

export function resolveLegalPath() {
  return firstExisting(resolveExcelRoot(), [
    "Legal Approvals - Dashboard.xlsx",
    "Legal Approvals - Dashboard (1).xlsx",
    "Progress Overview.xlsx",
  ]);
}

export function resolveProgressOverviewPath() {
  return firstExisting(resolveExcelRoot(), ["Progress Overview.xlsx"]);
}

export async function syncMilestonesFromTemplate(projectId: string, opts?: { force?: boolean }) {
  const file = resolveMilestonePath();
  if (!file) throw new Error("Milestone tracking.xlsx not found");
  const existing = await prisma.progressMilestone.count({
    where: { projectId, NOT: { category: MS_PROJECT_SOURCE } },
  });
  if (existing >= 5 && !opts?.force) return { imported: 0, skipped: true, source: path.basename(file) };

  if (opts?.force) {
    await prisma.progressMilestone.deleteMany({
      where: { projectId, NOT: { category: MS_PROJECT_SOURCE } },
    });
  }

  const rows = sheetRows(file, (names) => names.find((n) => /data input/i.test(n)) || names[0]);
  let imported = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const code = s(row[0], 40);
    const activity = s(row[2], 300);
    if (!code || !activity || !/^M\d+/i.test(code)) continue;
    const plannedDays = n(row[5]);
    const actualDays = n(row[8]);
    const delays = n(row[14]);
    const pct = n(row[10]);
    await prisma.progressMilestone.create({
      data: {
        projectId,
        code,
        category: s(row[1], 80) || null,
        activity,
        plannedStart: excelDate(row[3]),
        plannedEnd: excelDate(row[4]),
        plannedDays,
        actualStart: excelDate(row[6]),
        actualEnd: excelDate(row[7]),
        actualDays: actualDays > 0 ? actualDays : 0,
        varianceDays: delays || actualDays - plannedDays,
        weightage: n(row[9]),
        pctComplete: pct > 1 ? pct / 100 : pct,
        stakeholder: s(row[11], 80) || null,
        zone: s(row[12], 40) || null,
        status: s(row[13], 40) || "Planned",
      },
    });
    imported++;
  }
  return { imported, skipped: false, source: path.basename(file) };
}

export async function syncHindranceFromTemplate(projectId: string, opts?: { force?: boolean }) {
  const file = resolveHindrancePath();
  if (!file) throw new Error("Hindrance register workbook not found");
  const existing = await prisma.progressHindrance.count({ where: { projectId } });
  if (existing >= 1 && !opts?.force) return { imported: 0, skipped: true, source: path.basename(file) };
  if (opts?.force) await prisma.progressHindrance.deleteMany({ where: { projectId } });

  const rows = sheetRows(file, (names) => names.find((n) => /hinder/i.test(n)));
  let imported = 0;
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = s(row[1], 500);
    if (!description) continue;
    await prisma.progressHindrance.create({
      data: {
        projectId,
        description,
        location: s(row[2], 120) || null,
        activity: s(row[3], 120) || null,
        correspondence: s(row[4], 120) || null,
        category: s(row[5], 80) || null,
        type: s(row[6], 200) || null,
        occurredAt: excelDate(row[7]),
        resolvedAt: excelDate(row[8]),
        daysImpacted: n(row[9]),
        baselineStart: excelDate(row[10]),
        scheduleImpact: n(row[11]),
        delayType: s(row[12], 80) || null,
        accountable: s(row[13], 80) || null,
        status: s(row[14], 40) || "Open",
        resolutionDescription: s(row[15], 500) || null,
        remarks: s(row[16], 500) || null,
      },
    });
    imported++;
  }
  return { imported, skipped: false, source: path.basename(file) };
}

export async function syncRiskFromTemplate(projectId: string, opts?: { force?: boolean }) {
  const dedicated = resolveRiskPath();
  const overview = resolveProgressOverviewPath();
  const file =
    dedicated && path.basename(dedicated).includes("Risk Register") ? dedicated : overview || dedicated;
  if (!file) return { imported: 0, skipped: true, source: null };
  const existing = await prisma.progressRisk.count({ where: { projectId } });
  if (existing >= 1 && !opts?.force) return { imported: 0, skipped: true, source: path.basename(file) };
  if (opts?.force) await prisma.progressRisk.deleteMany({ where: { projectId } });

  const useDedicated = path.basename(file).includes("Risk Register");
  const rows = sheetRows(file, (names) =>
    useDedicated ? names.find((n) => /risk register/i.test(n)) : names.find((n) => /risk/i.test(n))
  );
  let imported = 0;
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const code = s(row[0], 20);
    const name = s(row[3], 200);
    if (!code || !name || !/^R\d+/i.test(code)) continue;
    const probability = Math.min(5, Math.max(1, Math.round(n(row[5]) || 1)));
    const consequence = Math.min(5, Math.max(1, Math.round(n(row[6]) || 1)));
    const statusRaw = s(row[16], 80);
    await prisma.progressRisk.create({
      data: {
        projectId,
        code,
        category: s(row[1], 80) || null,
        opportunityThreat: s(row[2], 40) || "Threat",
        name,
        description: s(row[4], 1000) || null,
        probability,
        consequence,
        severity: n(row[7]) || probability * consequence,
        probabilityPct: n(row[8]),
        costImpact: n(row[9]),
        weeksLikely: n(row[10]),
        urgency: s(row[11], 40) || null,
        responseCategory: s(row[12], 80) || null,
        impactNotes: s(row[13], 2000) || null,
        riskOwner: s(row[14], 120) || null,
        contingencyPlan: s(row[15], 2000) || null,
        status: statusRaw || "Open",
        dateLastUpdated: excelDate(row[17]),
        trackingComments: s(row[18], 500) || null,
      },
    });
    imported++;
  }
  return { imported, skipped: false, source: path.basename(file) };
}

export async function syncLegalFromTemplate(projectId: string, opts?: { force?: boolean }) {
  const file = resolveLegalPath();
  if (!file) return { imported: 0, skipped: true, source: null };
  const existing = await prisma.progressLegalApproval.count({ where: { projectId } });
  if (existing >= 1 && !opts?.force) return { imported: 0, skipped: true, source: path.basename(file) };
  if (opts?.force) await prisma.progressLegalApproval.deleteMany({ where: { projectId } });

  const rows = sheetRows(file, (names) => names.find((n) => /legal/i.test(n)));
  let imported = 0;
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const approvalId = s(row[0], 40);
    const description = s(row[3], 400);
    if (!approvalId || !description) continue;
    await prisma.progressLegalApproval.create({
      data: {
        projectId,
        approvalId,
        category: s(row[1], 80) || null,
        authority: s(row[2], 120) || null,
        description,
        packageName: s(row[4], 120) || null,
        submissionDate: excelDate(row[5]),
        requiredBy: excelDate(row[6]),
        receivedDate: excelDate(row[7]),
        status: s(row[8], 40) || "Submitted",
        delayDays: n(row[9]),
        responsible: s(row[10], 80) || null,
        remarks: s(row[11], 300) || null,
      },
    });
    imported++;
  }
  return { imported, skipped: false, source: path.basename(file) };
}

export async function syncProgressRegisterPack(projectId: string, opts?: { force?: boolean }) {
  const milestones = await syncMilestonesFromTemplate(projectId, opts);
  const hindrance = await syncHindranceFromTemplate(projectId, opts).catch((err) => ({
    imported: 0,
    skipped: false,
    source: null as string | null,
    error: err instanceof Error ? err.message : String(err),
  }));
  const risk = await syncRiskFromTemplate(projectId, opts);
  const legal = await syncLegalFromTemplate(projectId, opts);
  return { milestones, hindrance, risk, legal };
}

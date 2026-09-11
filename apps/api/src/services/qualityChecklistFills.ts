/**
 * Seed checklist fills from Quality Dashboard Sheet2
 * (Civil 10, ELV 6, Safety 5, … Grand Total 52).
 */
import type { PrismaClient } from "@prisma/client";
import { loadQualityDashboardWorkbook, type ChecklistDisciplineRow } from "./qualityDashboardSheets.js";

export const WEEK_DASHBOARD_FILL_REMARK = "seed-week-dashboard";

function normCat(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function dayInWeek(weekStart: Date, index: number) {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + (index % 7));
  d.setHours(9 + (index % 7), (index * 7) % 60, 0, 0);
  return d;
}

export function loadChecklistFillTargets(): ChecklistDisciplineRow[] {
  const workbook = loadQualityDashboardWorkbook();
  return (workbook?.checklistByDiscipline || []).filter(
    (row) => row.filled > 0 && !/^grand\s*total$/i.test(row.discipline)
  );
}

export function checklistFillSummary(rows = loadChecklistFillTargets()) {
  return {
    source: loadQualityDashboardWorkbook()?.source || "Quality Dashboard.xlsx",
    total: rows.reduce((n, r) => n + r.filled, 0),
    byDiscipline: rows.map((r) => ({ discipline: r.discipline.trim(), filled: r.filled })),
  };
}

async function responsesForTemplate(prisma: PrismaClient, templateId: string) {
  const items = await prisma.checklistItem.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
  const responses: Record<string, { answer: string; remarks: string }> = {};
  for (const item of items) {
    responses[item.id] = {
      answer: "Yes",
      remarks: item.section ? `${item.section} — verified on site` : "Verified",
    };
  }
  return JSON.stringify(responses);
}

export async function seedChecklistFillsFromDashboard(
  prisma: PrismaClient,
  projectId: string,
  submittedById: string,
  weekStart: Date,
  opts?: { drawingId?: string | null; revisionId?: string | null; revisionNumber?: string | null }
) {
  const targets = loadChecklistFillTargets();
  const summary = checklistFillSummary(targets);

  await prisma.checklistSubmission.deleteMany({
    where: {
      assignment: { projectId },
      OR: [
        { remarks: { startsWith: WEEK_DASHBOARD_FILL_REMARK } },
        { remarks: { startsWith: "seed-report" } },
      ],
    },
  });

  const assignments = await prisma.checklistAssignment.findMany({
    where: { projectId },
    include: { template: true },
  });
  const byCat = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const key = normCat(assignment.template.category || "");
    const list = byCat.get(key) || [];
    list.push(assignment);
    byCat.set(key, list);
  }

  const drawingId = opts?.drawingId || null;
  const revisionId = opts?.revisionId || null;
  const revisionNumber = opts?.revisionNumber || null;

  const created: Array<{ discipline: string; filled: number; templatesUsed: number }> = [];
  let total = 0;
  let fillIndex = 0;

  for (const target of targets) {
    const key = normCat(target.discipline);
    let pool = byCat.get(key) || [];
    if (!pool.length) {
      pool = assignments.filter(
        (a) =>
          normCat(a.template.category) === key ||
          normCat(a.template.name).includes(key) ||
          (key === "workpermits" && /permit/i.test(a.template.category + a.template.name))
      );
    }
    if (!pool.length || target.filled <= 0) {
      created.push({ discipline: target.discipline.trim(), filled: 0, templatesUsed: 0 });
      continue;
    }

    const cache = new Map<string, string>();
    for (let i = 0; i < target.filled; i++) {
      const assignment = pool[i % pool.length];
      let responsesJson = cache.get(assignment.templateId);
      if (!responsesJson) {
        responsesJson = await responsesForTemplate(prisma, assignment.templateId);
        cache.set(assignment.templateId, responsesJson);
      }
      const createdAt = dayInWeek(weekStart, fillIndex);
      const isSafety = /safety|workpermit/i.test(assignment.template.checklistType + assignment.template.category);
      await prisma.checklistSubmission.create({
        data: {
          assignmentId: assignment.id,
          submittedById,
          status: isSafety ? "Submitted" : "Approved",
          purpose: "Fill",
          remarks: `${WEEK_DASHBOARD_FILL_REMARK}:${target.discipline.trim()}`,
          responsesJson,
          drawingId,
          revisionId,
          revisionNumber,
          createdAt,
          reviewedAt: isSafety ? null : createdAt,
        },
      });
      fillIndex += 1;
      total += 1;
    }
    created.push({
      discipline: target.discipline.trim(),
      filled: target.filled,
      templatesUsed: Math.min(pool.length, target.filled),
    });
  }

  return { ...summary, created: total, byDiscipline: created, drawingLinked: Boolean(drawingId) };
}

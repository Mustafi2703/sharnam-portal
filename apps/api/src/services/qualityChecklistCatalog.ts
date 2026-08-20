/**
 * Quality Dashboard.xlsx · Sheet1 catalog — onboard every checklist type
 * into Quality / Safety master and assign to the project for fill logs + DPR.
 */
import { prisma } from "../prisma.js";
import { loadQualityDashboardWorkbook, type ChecklistCatalogRow } from "./qualityDashboardSheets.js";

function familyForCategory(category: string): "QualityInspection" | "Safety" {
  const c = category.trim().toLowerCase();
  if (c === "safety" || c === "workpermits" || c === "work permit" || c === "workpermits") return "Safety";
  return "QualityInspection";
}

export function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function ensureTemplate(row: ChecklistCatalogRow) {
  const checklistType = familyForCategory(row.category);
  const existingQi = await prisma.checklistTemplate.findFirst({
    where: { name: row.name, checklistType },
  });
  if (existingQi) return { template: existingQi, created: false, skipped: false };

  const other = await prisma.checklistTemplate.findFirst({
    where: { name: row.name, checklistType: { not: checklistType } },
  });
  if (other) return { template: other, created: false, skipped: true };

  const template = await prisma.checklistTemplate.create({
    data: {
      name: row.name,
      category: row.category || "General",
      checklistType,
      source: "Quality Dashboard.xlsx · Sheet1",
      requirePhotosMin: 3,
      instructions: "Minimum 3 observation photos. Fill on site; branded sheet downloads on submit for DPR/WPR.",
      items: {
        create: [
          { itemCode: "1", description: `${row.name} — preliminary checks`, sortOrder: 1, section: "Pre-checks", requirePhoto: true },
          { itemCode: "2", description: "Materials / method as per QAP / specification", sortOrder: 2, section: "Execution" },
          { itemCode: "3", description: "Workmanship acceptable to PMC", sortOrder: 3, section: "Execution" },
          { itemCode: "4", description: "HSE precautions observed", sortOrder: 4, section: "Safety" },
          { itemCode: "5", description: "Ready for next activity / sign-off", sortOrder: 5, section: "Close-out", requirePhoto: true },
        ],
      },
    },
  });
  return { template, created: true, skipped: false };
}

export async function syncQualityChecklistCatalog(projectId: string) {
  const workbook = loadQualityDashboardWorkbook();
  const catalog = workbook?.checklistCatalog || [];
  if (!catalog.length) throw new Error("Quality Dashboard.xlsx Sheet1 catalog not found");

  let created = 0;
  let assigned = 0;
  let skipped = 0;
  for (const row of catalog) {
    const out = await ensureTemplate(row);
    if (out.created) created++;
    if (out.skipped) skipped++;
    await prisma.checklistAssignment.upsert({
      where: { projectId_templateId: { projectId, templateId: out.template.id } },
      create: { projectId, templateId: out.template.id },
      update: {},
    });
    assigned++;
  }
  return { catalog: catalog.length, created, assigned, skipped, source: workbook?.source || "Quality Dashboard.xlsx" };
}

export type CatalogStatusRow = ChecklistCatalogRow & {
  family: "QualityInspection" | "Safety";
  onboarded: boolean;
  templateId: string | null;
  itemCount: number;
  assigned: boolean;
  assignmentId: string | null;
  fillCount: number;
  lastFilledAt: string | null;
  lastStatus: string | null;
};

export async function buildQualityCatalogStatus(projectId: string, catalog: ChecklistCatalogRow[]): Promise<CatalogStatusRow[]> {
  const names = catalog.map((c) => c.name);
  const templates = await prisma.checklistTemplate.findMany({
    where: { name: { in: names } },
    include: { _count: { select: { items: true } } },
  });
  const byName = new Map(templates.map((t) => [t.name, t]));
  const assignments = await prisma.checklistAssignment.findMany({
    where: { projectId, templateId: { in: templates.map((t) => t.id) } },
    include: {
      submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, status: true } },
      _count: { select: { submissions: true } },
    },
  });
  const assignByTemplate = new Map(assignments.map((a) => [a.templateId, a]));

  return catalog.map((row) => {
    const family = familyForCategory(row.category);
    const t = byName.get(row.name);
    const a = t ? assignByTemplate.get(t.id) : undefined;
    return {
      ...row,
      family,
      onboarded: !!t,
      templateId: t?.id || null,
      itemCount: t?._count.items || 0,
      assigned: !!a,
      assignmentId: a?.id || null,
      fillCount: a?._count.submissions || 0,
      lastFilledAt: a?.submissions[0]?.createdAt ? a.submissions[0].createdAt.toISOString() : null,
      lastStatus: a?.submissions[0]?.status || null,
    };
  });
}

export function fillBuckets(dates: Date[]) {
  const byDay: Record<string, number> = {};
  const byWeek: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  for (const d of dates) {
    const day = d.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    const w = isoWeekLabel(d);
    byWeek[w] = (byWeek[w] || 0) + 1;
    const m = monthLabel(d);
    byMonth[m] = (byMonth[m] || 0) + 1;
  }
  const toChart = (map: Record<string, number>, take: number) =>
    Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-take)
      .map(([label, value]) => ({ label, value }));
  return {
    fillsByDay: toChart(byDay, 14),
    fillsByWeek: toChart(byWeek, 12),
    fillsByMonth: toChart(byMonth, 12),
  };
}

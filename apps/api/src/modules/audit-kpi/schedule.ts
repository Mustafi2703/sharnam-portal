/**
 * Daily KPI refresh at 18:30 IST, then a Friday snapshot at 18:45 IST.
 * Same once-per-day interval pattern as startSharePointDayClose.
 */
import { prisma } from "../../prisma.js";
import { refreshProjectSubjects } from "./subjectSources.js";
import { istParts, snapshotTrendWeek } from "./snapshot.js";

const ACTIVE = { status: { notIn: ["Archived", "Lost", "Closed"] } };

async function activeProjects() {
  return prisma.project.findMany({
    where: ACTIVE,
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
}

export async function refreshAllActiveProjects() {
  const projects = await activeProjects();
  const results: { code: string; ok: boolean; updated?: number; error?: string }[] = [];
  for (const project of projects) {
    try {
      const out = await refreshProjectSubjects(project.id);
      results.push({ code: project.code, ok: true, updated: out.updated });
      console.log(`[audit-kpi] refresh ${project.code}: ${out.updated} of ${out.subjects}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ code: project.code, ok: false, error });
      console.warn(`[audit-kpi] refresh ${project.code} failed:`, error);
    }
  }
  return { at: new Date().toISOString(), projects: results };
}

export async function snapshotAllActiveProjects() {
  const projects = await activeProjects();
  for (const project of projects) {
    try {
      await refreshProjectSubjects(project.id);
      const out = await snapshotTrendWeek(project.id);
      console.log(`[audit-kpi] friday snapshot ${project.code} ${out.weekEnding} ${out.ok ? "written" : "kept typed row"}`);
    } catch (err) {
      console.warn(`[audit-kpi] friday snapshot ${project.code} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

let lastRefreshKey = "";
let lastSnapshotKey = "";

export function startAuditKpiSchedule() {
  const hour = Number(process.env.AUDIT_KPI_REFRESH_HOUR || 18);
  setInterval(() => {
    const now = istParts();
    if (now.hour === hour && now.minute === 30 && lastRefreshKey !== now.day) {
      lastRefreshKey = now.day;
      console.log(`[audit-kpi] daily refresh ${now.day}`);
      void refreshAllActiveProjects().catch((err) =>
        console.warn("[audit-kpi] daily refresh failed:", err instanceof Error ? err.message : err)
      );
    }
    if (now.weekday.startsWith("Fri") && now.hour === hour && now.minute === 45 && lastSnapshotKey !== now.day) {
      lastSnapshotKey = now.day;
      console.log(`[audit-kpi] friday snapshot ${now.day}`);
      void snapshotAllActiveProjects().catch((err) =>
        console.warn("[audit-kpi] friday snapshot failed:", err instanceof Error ? err.message : err)
      );
    }
  }, 60_000);
  console.log(`[audit-kpi] refresh scheduled at ${hour}:30 Asia/Kolkata, snapshot Fridays at ${hour}:45`);
}

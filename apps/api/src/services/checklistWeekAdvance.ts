import { prisma } from "../prisma.js";

function weekNumber(label: string | null | undefined) {
  const n = parseInt(String(label || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isoWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** After a fill, copy QAP into the next week and republish dashboards so counts stay live. */
export async function advanceProjectWeeksAfterFill(opts: {
  projectId: string;
  userId: string;
  checklistType?: string | null;
}) {
  const labels = await prisma.qapActivity.findMany({
    where: { projectId: opts.projectId },
    select: { weekLabel: true },
    distinct: ["weekLabel"],
  });
  const nums = labels.map((r) => weekNumber(r.weekLabel)).filter((n) => n > 0);
  const current = nums.length ? Math.max(...nums) : isoWeekNumber();
  const nextLabel = `Week ${current + 1}`;
  const sourceLabel = labels.find((r) => weekNumber(r.weekLabel) === current)?.weekLabel || labels[0]?.weekLabel;
  let qapCopied = 0;

  const already = await prisma.qapActivity.count({
    where: { projectId: opts.projectId, weekLabel: nextLabel },
  });
  if (!already) {
    const source = sourceLabel
      ? await prisma.qapActivity.findMany({ where: { projectId: opts.projectId, weekLabel: sourceLabel } })
      : [];
    if (source.length) {
      const unique = new Map<string, (typeof source)[number]>();
      for (const r of source) {
        const key = `${r.srNo || ""}|${r.section || ""}|${r.activity}|${r.description || ""}`;
        if (!unique.has(key)) unique.set(key, r);
      }
      const rows = [...unique.values()];
      await prisma.qapActivity.createMany({
        data: rows.map((r) => ({
          projectId: opts.projectId,
          weekLabel: nextLabel,
          srNo: r.srNo,
          section: r.section,
          activity: r.activity,
          description: r.description,
          frequency: r.frequency,
          codeOfConformance: r.codeOfConformance,
          testAgency: r.testAgency,
          contractorPerformer: r.contractorPerformer,
          contractorChecker: r.contractorChecker,
          discipline: r.discipline,
          pmcRole: r.pmcRole,
          clientRole: r.clientRole,
          records: r.records,
          remarks: null,
          dailyChecks: null,
          contractorOk: false,
          pmcOk: false,
          clientOk: false,
          status: "Open",
        })),
      });
      qapCopied = rows.length;
    }
  }

  let driveFiles = 0;
  try {
    const { publishQualityPackToDrive } = await import("./registerWorkbookPublish.js");
    const published = await publishQualityPackToDrive(opts.projectId, opts.userId, nextLabel);
    driveFiles = published.length;
  } catch (err) {
    console.warn("[checklist] week dashboard publish:", err instanceof Error ? err.message : err);
  }

  return {
    nextWeek: nextLabel,
    qapCopied,
    driveFiles,
    checklistType: opts.checklistType || null,
  };
}

/** Republish QAP + cube + quality dashboard after a fill, review, or RFI close — no extra week copy. */
export async function refreshQualityPackAfterChange(projectId: string, userId: string) {
  try {
    const { publishQualityPackToDrive } = await import("./registerWorkbookPublish.js");
    const published = await publishQualityPackToDrive(projectId, userId);
    return published.length;
  } catch (err) {
    console.warn("[checklist] quality pack refresh:", err instanceof Error ? err.message : err);
    return 0;
  }
}

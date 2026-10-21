/**
 * Drawing Check gate routing: which DrawingCheck template a discipline uses,
 * the auto report number (DC/<PROJECT>/<DISC>/<NNN>) and the discipline backfill.
 */
import type { PrismaClient } from "@prisma/client";

/** Template name prefix -> discipline. Order matters: the first match wins. */
const NAME_RULES: { test: RegExp; discipline: string }[] = [
  { test: /^\s*(\d+\.\s*)?civil\s*&\s*structural\b/i, discipline: "Structural" },
  { test: /^\s*(\d+\.\s*)?multi[- ]?discipline\b.*\bclash\b/i, discipline: "Multi-discipline" },
  { test: /^\s*(\d+\.\s*)?mepf\b/i, discipline: "MEPF" },
  { test: /^\s*(\d+\.\s*)?peb\b/i, discipline: "PEB" },
  { test: /^\s*(\d+\.\s*)?infrastructure\b/i, discipline: "Infrastructure" },
  { test: /^\s*(\d+\.\s*)?architectural\b/i, discipline: "Architecture" },
];

/** Discipline for a seeded Drawing Check template name, or null when the name is ambiguous / unknown. */
export function disciplineForDrawingCheckName(name: string): string | null {
  const n = String(name || "");
  // "Architectural / Civil Drawing Review Checklist" (legacy) spans two disciplines: leave it for a human.
  if (/^\s*architectural\b/i.test(n) && /\bcivil\b/i.test(n)) return null;
  return NAME_RULES.find((r) => r.test.test(n))?.discipline ?? null;
}

const DISCIPLINE_CODES: Record<string, string> = {
  architecture: "ARC",
  architectural: "ARC",
  structural: "STR",
  "civil & structural": "STR",
  mepf: "MEPF",
  mep: "MEP",
  peb: "PEB",
  infrastructure: "INF",
  "multi-discipline": "MDC",
};

export function disciplineCode(discipline: string): string {
  const key = String(discipline || "").trim().toLowerCase();
  if (DISCIPLINE_CODES[key]) return DISCIPLINE_CODES[key];
  const letters = key.replace(/[^a-z0-9]/g, "").toUpperCase();
  return letters.slice(0, 4) || "GEN";
}

function projectCodeSegment(code: string): string {
  return String(code || "PRJ").trim().toUpperCase().replace(/\s+/g, "-");
}

export function drawingCheckReportPrefix(projectCode: string, discipline: string): string {
  return `DC/${projectCodeSegment(projectCode)}/${disciplineCode(discipline)}/`;
}

export function noDrawingCheckTemplateMessage(discipline: string) {
  return `No Drawing Check template for ${discipline}. Add one in Checklist Manager.`;
}

/**
 * Active DrawingCheck template for a discipline:
 *  a) assigned to this project, else
 *  b) any active template with that discipline.
 * Never falls back to another discipline.
 */
export async function resolveDrawingCheckTemplate(db: PrismaClient, projectId: string, discipline: string) {
  const include = { items: { orderBy: { sortOrder: "asc" as const } } };
  const base = { checklistType: "DrawingCheck", isActive: true, discipline };
  const assigned = await db.checklistTemplate.findFirst({
    where: { ...base, assignments: { some: { projectId } } },
    include,
    orderBy: { createdAt: "asc" },
  });
  if (assigned) return assigned;
  const named = await db.checklistTemplate.findFirst({ where: base, include, orderBy: { createdAt: "asc" } });
  if (named) return named;

  // Deploy window: the column exists but is still null until the backfill script runs.
  // Infer from the template name. Never use another discipline's checklist.
  const want = discipline.trim().toLowerCase();
  const unnamed = await db.checklistTemplate.findMany({
    where: { checklistType: "DrawingCheck", isActive: true, OR: [{ discipline: null }, { discipline: "" }] },
    include,
    orderBy: { createdAt: "asc" },
  });
  const matches = unnamed.filter((t) => disciplineForDrawingCheckName(t.name)?.toLowerCase() === want);
  if (!matches.length) return null;
  const assignedIds = new Set(
    (
      await db.checklistAssignment.findMany({
        where: { projectId, templateId: { in: matches.map((t) => t.id) } },
        select: { templateId: true },
      })
    ).map((a) => a.templateId),
  );
  return matches.find((t) => assignedIds.has(t.id)) || matches[0];
}

/** Report numbers already used on submitted Drawing Checks for this project and prefix. */
async function takenReportNumbers(db: PrismaClient, projectId: string, prefix: string): Promise<Set<number>> {
  const needle = JSON.stringify(prefix).slice(1, -1);
  const rows = await db.checklistSubmission.findMany({
    where: {
      purpose: "PreUploadDrawing",
      status: { not: "Draft" },
      assignment: { projectId },
      responsesJson: { contains: needle },
    },
    select: { responsesJson: true },
  });
  const taken = new Set<number>();
  for (const r of rows) {
    try {
      const reportNo = String(JSON.parse(r.responsesJson || "{}")?._meta?.reportNo || "");
      if (!reportNo.startsWith(prefix)) continue;
      const n = Number(reportNo.slice(prefix.length));
      if (Number.isInteger(n) && n > 0) taken.add(n);
    } catch {
      /* skip unreadable rows */
    }
  }
  return taken;
}

function formatReportNo(prefix: string, n: number) {
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function nextDrawingCheckReportNo(db: PrismaClient, projectId: string, projectCode: string, discipline: string) {
  const prefix = drawingCheckReportPrefix(projectCode, discipline);
  const taken = await takenReportNumbers(db, projectId, prefix);
  const max = taken.size ? Math.max(...taken) : 0;
  return formatReportNo(prefix, max + 1);
}

/** Keep the number the user saw when it is still free; otherwise issue the next one. */
export async function confirmDrawingCheckReportNo(
  db: PrismaClient,
  projectId: string,
  projectCode: string,
  discipline: string,
  requested?: string | null,
) {
  const prefix = drawingCheckReportPrefix(projectCode, discipline);
  const taken = await takenReportNumbers(db, projectId, prefix);
  const want = String(requested || "").trim();
  if (want.startsWith(prefix)) {
    const n = Number(want.slice(prefix.length));
    if (Number.isInteger(n) && n > 0 && !taken.has(n)) return { reportNo: formatReportNo(prefix, n), reissued: false };
  }
  const max = taken.size ? Math.max(...taken) : 0;
  return { reportNo: formatReportNo(prefix, max + 1), reissued: Boolean(want) };
}

/** Idempotent: set discipline on DrawingCheck templates where it is still null, by template name. */
export async function backfillDrawingCheckDisciplines(
  db: PrismaClient,
  log: (line: string) => void = console.log,
): Promise<{ updated: number; skipped: string[] }> {
  const rows = await db.checklistTemplate.findMany({
    where: { checklistType: "DrawingCheck", discipline: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  let updated = 0;
  const skipped: string[] = [];
  for (const t of rows) {
    const discipline = disciplineForDrawingCheckName(t.name);
    if (!discipline) {
      skipped.push(t.name);
      log(`[drawing-check discipline] skipped "${t.name}" (no rule matches)`);
      continue;
    }
    const res = await db.checklistTemplate.updateMany({
      where: { id: t.id, discipline: null },
      data: { discipline },
    });
    if (res.count) {
      updated += 1;
      log(`[drawing-check discipline] "${t.name}" -> ${discipline}`);
    }
  }
  log(`[drawing-check discipline] ${updated} template(s) updated, ${skipped.length} skipped.`);
  return { updated, skipped };
}
